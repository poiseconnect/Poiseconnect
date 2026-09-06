import { beforeEach, describe, expect, it, vi } from "vitest";

const userResult = vi.hoisted(() => ({ data: { user: { id: "user-1" } }, error: null }));
const memberResult = vi.hoisted(() => ({ data: null, error: null }));
const updatePayload = vi.hoisted(() => ({ value: null }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn(async () => userResult),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(async () => memberResult),
        })),
      })),
      update: vi.fn((payload) => {
        updatePayload.value = payload;
        return {
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: { ...memberResult.data, ...payload },
                error: null,
              })),
            })),
          })),
        };
      }),
    })),
  }),
}));

import { GET, POST } from "../../app/api/team-members/profile/route.js";

function getRequest(token = "valid-token") {
  return new Request("https://app.example.invalid/api/team-members/profile", {
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

function postRequest(body, token = "valid-token") {
  return new Request("https://app.example.invalid/api/team-members/profile", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("team members profile route", () => {
  beforeEach(() => {
    userResult.data = { user: { id: "user-1" } };
    userResult.error = null;
    memberResult.data = {
      id: "coach-1",
      email: "coach@example.invalid",
      profile_name: "Coach",
      profile_role: "Psychologin",
      profile_calendar_mode: "proposal",
      proposal_earliest_time: "08:00",
      proposal_latest_time: "16:00",
    };
    memberResult.error = null;
    updatePayload.value = null;
  });

  it("loads profile including proposal earliest and latest times", async () => {
    const res = await GET(getRequest());

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.member).toMatchObject({
      profile_calendar_mode: "proposal",
      proposal_earliest_time: "08:00",
      proposal_latest_time: "16:00",
    });
  });

  it("saves valid proposal availability window", async () => {
    const res = await POST(
      postRequest({
        profile_calendar_mode: "proposal",
        proposal_earliest_time: "09:00",
        proposal_latest_time: "17:00",
      })
    );

    expect(res.status).toBe(200);
    expect(updatePayload.value).toMatchObject({
      profile_calendar_mode: "proposal",
      proposal_earliest_time: "09:00",
      proposal_latest_time: "17:00",
    });
  });

  it("saves when only earliest time is provided", async () => {
    const res = await POST(
      postRequest({
        profile_calendar_mode: "proposal",
        proposal_earliest_time: "10:00",
        proposal_latest_time: "",
      })
    );

    expect(res.status).toBe(200);
    expect(updatePayload.value).toMatchObject({
      proposal_earliest_time: "10:00",
      proposal_latest_time: null,
    });
  });

  it("saves when only latest time is provided", async () => {
    const res = await POST(
      postRequest({
        profile_calendar_mode: "proposal",
        proposal_earliest_time: null,
        proposal_latest_time: "15:30",
      })
    );

    expect(res.status).toBe(200);
    expect(updatePayload.value).toMatchObject({
      proposal_earliest_time: null,
      proposal_latest_time: "15:30",
    });
  });

  it("saves when both times are empty/null", async () => {
    const res = await POST(
      postRequest({
        profile_calendar_mode: "proposal",
        proposal_earliest_time: "",
        proposal_latest_time: "",
      })
    );

    expect(res.status).toBe(200);
    expect(updatePayload.value).toMatchObject({
      proposal_earliest_time: null,
      proposal_latest_time: null,
    });
  });

  it("saves when earliest equals latest", async () => {
    const res = await POST(
      postRequest({
        profile_calendar_mode: "proposal",
        proposal_earliest_time: "12:00",
        proposal_latest_time: "12:00",
      })
    );

    expect(res.status).toBe(200);
    expect(updatePayload.value).toMatchObject({
      proposal_earliest_time: "12:00",
      proposal_latest_time: "12:00",
    });
  });

  it("rejects when earliest time is strictly after latest time", async () => {
    const res = await POST(
      postRequest({
        profile_calendar_mode: "proposal",
        proposal_earliest_time: "17:00",
        proposal_latest_time: "09:00",
      })
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("invalid_time_range");
    expect(json.message).toBe("Die früheste Uhrzeit muss vor der spätesten Uhrzeit liegen.");
    expect(updatePayload.value).toBeNull();
  });

  it("preserves stored proposal times when saving booking mode with existing times", async () => {
    const res = await POST(
      postRequest({
        profile_calendar_mode: "booking",
        proposal_earliest_time: "08:00",
        proposal_latest_time: "16:00",
      })
    );

    expect(res.status).toBe(200);
    expect(updatePayload.value).toMatchObject({
      profile_calendar_mode: "booking",
      proposal_earliest_time: "08:00",
      proposal_latest_time: "16:00",
    });
  });
});
