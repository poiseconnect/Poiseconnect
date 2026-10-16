import dns from "node:dns/promises";
import https from "node:https";
import { isIP } from "node:net";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const APPROVED_HOSTS = new Set(["mypoise.de", "www.mypoise.de"]);
const MAX_REDIRECTS = 3;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const IMAGE_SIGNATURES = {
  "image/png": (data) =>
    data.length >= 8 &&
    data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  "image/jpeg": (data) =>
    data.length >= 3 &&
    data[0] === 0xff &&
    data[1] === 0xd8 &&
    data[2] === 0xff,
  "image/gif": (data) =>
    data.length >= 6 &&
    ["GIF87a", "GIF89a"].includes(data.subarray(0, 6).toString("ascii")),
  "image/webp": (data) =>
    data.length >= 12 &&
    data.subarray(0, 4).toString("ascii") === "RIFF" &&
    data.subarray(8, 12).toString("ascii") === "WEBP",
  "image/avif": (data) =>
    data.length >= 12 &&
    data.subarray(4, 8).toString("ascii") === "ftyp" &&
    ["avif", "avis"].includes(data.subarray(8, 12).toString("ascii")),
  "image/bmp": (data) =>
    data.length >= 2 && data.subarray(0, 2).toString("ascii") === "BM",
  "image/x-icon": (data) =>
    data.length >= 4 && data.readUInt32LE(0) === 0x00010000,
  "image/vnd.microsoft.icon": (data) =>
    data.length >= 4 && data.readUInt32LE(0) === 0x00010000,
};

function isUnsafeIpv4(address) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => part < 0 || part > 255)) {
    return true;
  }

  const value =
    ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
  const inRange = (network, mask) => ((value & mask) >>> 0) === network;

  return (
    inRange(0x00000000, 0xff000000) || // current network
    inRange(0x0a000000, 0xff000000) || // private
    inRange(0x64400000, 0xffc00000) || // shared address space
    inRange(0x7f000000, 0xff000000) || // loopback
    inRange(0xa9fe0000, 0xffff0000) || // link-local
    inRange(0xac100000, 0xfff00000) || // private
    inRange(0xc0000000, 0xffffff00) || // protocol assignments
    inRange(0xc0000200, 0xffffff00) || // documentation
    inRange(0xc0586300, 0xffffff00) || // deprecated 6to4 relay anycast
    inRange(0xc0a80000, 0xffff0000) || // private
    inRange(0xc6120000, 0xfffe0000) || // benchmarking
    inRange(0xc6336400, 0xffffff00) || // documentation
    inRange(0xcb007100, 0xffffff00) || // documentation
    inRange(0xe0000000, 0xf0000000) || // multicast
    inRange(0xf0000000, 0xf0000000) // reserved
  );
}

function isUnsafeIpv6(address) {
  let normalized = address.toLowerCase().split("%")[0];
  const embeddedIpv4 = normalized.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (embeddedIpv4) {
    const octets = embeddedIpv4[1].split(".").map(Number);
    if (octets.length !== 4 || octets.some((octet) => octet > 255)) return true;
    const high = ((octets[0] << 8) | octets[1]).toString(16);
    const low = ((octets[2] << 8) | octets[3]).toString(16);
    normalized = normalized.replace(embeddedIpv4[1], `${high}:${low}`);
  }

  let groups;
  if (normalized.includes("::")) {
    const [left, right] = normalized.split("::");
    const leftGroups = left ? left.split(":") : [];
    const rightGroups = right ? right.split(":") : [];
    const missing = 8 - leftGroups.length - rightGroups.length;
    if (missing < 1) return true;
    groups = [
      ...leftGroups,
      ...Array(missing).fill("0"),
      ...rightGroups,
    ];
  } else {
    groups = normalized.split(":");
  }

  const expanded = groups.map((group) => parseInt(group || "0", 16));
  if (expanded.length !== 8 || expanded.some((group) => !Number.isFinite(group))) {
    return true;
  }

  const [first, second] = expanded;
  const isIpv4Mapped =
    expanded.slice(0, 5).every((group) => group === 0) && expanded[5] === 0xffff;
  if (isIpv4Mapped) {
    const embeddedIpv4 = [
      expanded[6] >> 8,
      expanded[6] & 0xff,
      expanded[7] >> 8,
      expanded[7] & 0xff,
    ].join(".");
    return isUnsafeIpv4(embeddedIpv4);
  }

  const isGlobalUnicast = (first & 0xe000) === 0x2000;
  const isTeredo = first === 0x2001 && second === 0;
  const isSpecial2001Range = first === 0x2001 && (second & 0xfe00) === 0;
  const isDocumentation = first === 0x2001 && second === 0x0db8;
  const is6to4 = first === 0x2002;
  const isDocumentation3fff = first === 0x3fff && (second & 0xfff0) === 0;

  return (
    !isGlobalUnicast ||
    isTeredo ||
    isSpecial2001Range ||
    isDocumentation ||
    is6to4 ||
    isDocumentation3fff
  );
}

function isPublicAddress(address) {
  const family = isIP(address);
  if (family === 4) return !isUnsafeIpv4(address);
  if (family === 6) return !isUnsafeIpv6(address);
  return false;
}

function parseApprovedUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (
    url.protocol !== "https:" ||
    !APPROVED_HOSTS.has(url.hostname) ||
    (url.port && url.port !== "443") ||
    url.username ||
    url.password
  ) {
    return null;
  }
  return url;
}

async function resolvePublicAddress(hostname) {
  const records = await dns.lookup(hostname, { all: true, verbatim: true });
  if (
    records.length === 0 ||
    records.some(({ address }) => !isPublicAddress(address))
  ) {
    throw new Error("Unsafe image host address");
  }
  return records[0];
}

function requestPinnedUrl(url, address) {
  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        protocol: "https:",
        hostname: url.hostname,
        port: 443,
        path: `${url.pathname}${url.search}`,
        method: "GET",
        headers: { Accept: "image/*" },
        lookup: (_hostname, _options, callback) =>
          callback(null, address.address, address.family),
      },
      (response) => {
        const chunks = [];
        let size = 0;

        response.on("data", (chunk) => {
          size += chunk.length;
          if (size > MAX_IMAGE_BYTES) {
            response.destroy(new Error("Image exceeds size limit"));
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () =>
          resolve({
            statusCode: response.statusCode,
            headers: response.headers,
            body: Buffer.concat(chunks),
          }),
        );
        response.on("error", reject);
      },
    );
    request.on("error", reject);
    request.end();
  });
}

async function fetchApprovedImage(initialUrl) {
  let currentUrl = initialUrl;

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const url = parseApprovedUrl(currentUrl);
    if (!url) throw new Error("Unapproved image URL");

    const address = await resolvePublicAddress(url.hostname);
    const response = await requestPinnedUrl(url, address);

    if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
      const location = response.headers.location;
      if (!location || redirects === MAX_REDIRECTS) {
        throw new Error("Invalid image redirect");
      }
      currentUrl = new URL(location, url).toString();
      continue;
    }

    const contentType = String(response.headers["content-type"] || "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    const hasValidImageContent = IMAGE_SIGNATURES[contentType]?.(response.body);
    if (response.statusCode !== 200 || !hasValidImageContent) {
      throw new Error("Invalid image response");
    }

    return { body: response.body, contentType };
  }

  throw new Error("Too many image redirects");
}

export async function GET(req) {
  const requestedUrl = new URL(req.url).searchParams.get("url");
  if (!requestedUrl || !parseApprovedUrl(requestedUrl)) {
    return new Response("Invalid image URL", { status: 400 });
  }

  try {
    const { body, contentType } = await fetchApprovedImage(requestedUrl);
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Image fetch failed", { status: 400 });
  }
}
