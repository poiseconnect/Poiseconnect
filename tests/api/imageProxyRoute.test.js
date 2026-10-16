import { beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";

const mockState = vi.hoisted(() => ({
  responses: [],
  resolvedAddresses: {},
  connections: [],
}));

vi.mock("node:dns/promises", () => ({
  default: {
    lookup: vi.fn(async (hostname) =>
      mockState.resolvedAddresses[hostname] || [
        { address: "93.184.216.34", family: 4 },
      ],
    ),
  },
}));

vi.mock("node:https", () => ({
  default: {
    request: vi.fn((options, onResponse) => {
      const request = new EventEmitter();
      request.end = () => {
        options.lookup(options.hostname, {}, (error, address, family) => {
          if (error) {
            request.emit("error", error);
            return;
          }

          mockState.connections.push({ hostname: options.hostname, address, family });
          const configured = mockState.responses.shift() || {};
          const response = new Readable({ read() {} });
          response.statusCode = configured.statusCode || 200;
          response.headers = configured.headers || {
            "content-type": "image/png",
          };
          queueMicrotask(() => {
            onResponse(response);
            response.push(configured.body ?? PNG_SIGNATURE);
            response.push(null);
          });
        });
      };
      return request;
    }),
  },
}));

import { GET } from "../../app/api/image-proxy/route.js";

const PNG_SIGNATURE = Buffer.from([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0,
]);

function requestFor(url) {
  return new Request(
    `https://app.mypoise.de/api/image-proxy?url=${encodeURIComponent(url)}`,
  );
}

describe("image proxy SSRF protection", () => {
  beforeEach(() => {
    mockState.responses = [];
    mockState.resolvedAddresses = {};
    mockState.connections = [];
  });

  it("returns validated image bytes from an approved profile-image origin", async () => {
    const response = await GET(
      requestFor("https://mypoise.de/wp-content/uploads/profile.png"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(Buffer.from(await response.arrayBuffer())).toEqual(PNG_SIGNATURE);
    expect(mockState.connections).toEqual([
      { hostname: "mypoise.de", address: "93.184.216.34", family: 4 },
    ]);
  });

  it.each([
    "http://mypoise.de/profile.png",
    "https://evil.example/profile.png",
    "https://mypoise.de.evil.example/profile.png",
    "https://user@mypoise.de/profile.png",
    "https://mypoise.de:8443/profile.png",
    "https://127.0.0.1/profile.png",
  ])("rejects unapproved URL %s before making a request", async (url) => {
    const response = await GET(requestFor(url));

    expect(response.status).toBe(400);
    expect(mockState.connections).toHaveLength(0);
  });

  it.each([
    ["loopback IPv4", "127.0.0.1", 4],
    ["private IPv4", "10.4.5.6", 4],
    ["link-local IPv4", "169.254.10.20", 4],
    ["IPv4-mapped loopback", "::ffff:127.0.0.1", 6],
    ["IPv6 loopback", "::1", 6],
    ["IPv6 link-local", "fe80::1", 6],
  ])("rejects a DNS answer resolving to %s", async (_label, address, family) => {
    mockState.resolvedAddresses["mypoise.de"] = [{ address, family }];

    const response = await GET(
      requestFor("https://mypoise.de/wp-content/uploads/profile.png"),
    );

    expect(response.status).toBe(400);
    expect(mockState.connections).toHaveLength(0);
  });

  it("pins the validated DNS answer when opening the HTTPS connection", async () => {
    mockState.resolvedAddresses["mypoise.de"] = [
      { address: "203.0.113.10", family: 4 },
      { address: "93.184.216.34", family: 4 },
    ];

    const response = await GET(
      requestFor("https://mypoise.de/wp-content/uploads/profile.png"),
    );

    expect(response.status).toBe(400);
    expect(mockState.connections).toHaveLength(0);

    mockState.resolvedAddresses["mypoise.de"] = [
      { address: "93.184.216.34", family: 4 },
    ];
    const validResponse = await GET(
      requestFor("https://mypoise.de/wp-content/uploads/profile.png"),
    );

    expect(validResponse.status).toBe(200);
    expect(mockState.connections[0]).toEqual({
      hostname: "mypoise.de",
      address: "93.184.216.34",
      family: 4,
    });
  });

  it("validates each redirect and rejects redirects to unapproved origins", async () => {
    mockState.responses = [
      {
        statusCode: 302,
        headers: { location: "https://169.254.169.254/latest/meta-data" },
      },
    ];

    const response = await GET(
      requestFor("https://mypoise.de/wp-content/uploads/profile.png"),
    );

    expect(response.status).toBe(400);
    expect(mockState.connections).toHaveLength(1);
  });

  it("allows an approved redirect only after resolving and pinning its host", async () => {
    mockState.responses = [
      {
        statusCode: 301,
        headers: { location: "https://www.mypoise.de/profile.png" },
      },
      { statusCode: 200, headers: { "content-type": "image/png" } },
    ];

    const response = await GET(
      requestFor("https://mypoise.de/profile.png"),
    );

    expect(response.status).toBe(200);
    expect(mockState.connections.map(({ hostname }) => hostname)).toEqual([
      "mypoise.de",
      "www.mypoise.de",
    ]);
  });

  it("does not return bodies that are not a supported image matching their MIME type", async () => {
    mockState.responses = [
      {
        statusCode: 200,
        headers: { "content-type": "image/svg+xml" },
        body: Buffer.from("<svg></svg>"),
      },
    ];

    const response = await GET(
      requestFor("https://mypoise.de/profile.svg"),
    );

    expect(response.status).toBe(400);
    expect(await response.text()).toBe("Image fetch failed");
  });
});
