// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createInitialState } from "./trip-state";

const supabase = vi.hoisted(() => ({
  getSession: vi.fn(),
  signInAnonymously: vi.fn(),
  subscribe: vi.fn(),
  removeChannel: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  isSupabaseBrowserConfigured: true,
  browserSupabase: () => ({
    auth: { getSession: supabase.getSession, signInAnonymously: supabase.signInAnonymously },
    channel: () => ({ on() { return this; }, subscribe: supabase.subscribe }),
    removeChannel: supabase.removeChannel,
  }),
}));

import { extractShareToken, makeShareUrl, syncErrorMessage, useTripSync } from "./sync-client";

const token = "6fb2f2aa1e23415bbbd7022e9f43f888";
const state = createInitialState();

beforeEach(() => {
  window.history.replaceState(null, "", "/");
  localStorage.clear();
  vi.restoreAllMocks();
  supabase.getSession.mockResolvedValue({ data: { session: { access_token: "access" } } });
  supabase.signInAnonymously.mockResolvedValue({ data: { session: { access_token: "access" } }, error: null });
  supabase.subscribe.mockReturnValue({ id: "channel" });
});

describe("sync link helpers", () => {
  it("extracts a valid private token from the URL fragment", () => {
    expect(extractShareToken("#6fb2f2aa1e23415bbbd7022e9f43f888")).toBe("6fb2f2aa1e23415bbbd7022e9f43f888");
    expect(extractShareToken("#not-a-token")).toBeUndefined();
  });

  it("keeps the private token in the fragment instead of a query string", () => {
    expect(makeShareUrl("https://trip.example/trip", token)).toBe(`https://trip.example/trip#${token}`);
  });

  it("does not create or authenticate a tokenless trip automatically", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { result } = renderHook(() => useTripSync(state, vi.fn(), { localReady: true }));
    await waitFor(() => expect(result.current.status).toBe("needs-cloud-action"));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(supabase.getSession).not.toHaveBeenCalled();
  });

  it("joins a private token URL after local hydration", async () => {
    window.history.replaceState(null, "", `/trip#${token}`);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ tripId: "trip-1", state }), { status: 200 }));
    const dispatch = vi.fn();
    const { result } = renderHook(() => useTripSync(state, dispatch, { localReady: true }));
    await waitFor(() => expect(result.current.status).toBe("synced"));
    expect(dispatch).toHaveBeenCalledWith({ type: "hydrate", state });
    expect(fetch).toHaveBeenCalledWith("/api/trips/join", expect.objectContaining({ method: "POST" }));
  });

  it("creates a cloud trip from the supplied local snapshot and stores a backup", async () => {
    const edited = { ...state, revision: 8, dayTitles: { ...state.dayTitles, "2026-07-08": "我的动物日" } };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ tripId: "trip-1", token, state: edited }), { status: 200 }));
    const { result } = renderHook(() => useTripSync(edited, vi.fn(), { localReady: true }));
    await waitFor(() => expect(result.current.status).toBe("needs-cloud-action"));

    await act(async () => expect(await result.current.createTrip(edited)).toBe(true));

    expect(window.location.hash).toBe(`#${token}`);
    expect(JSON.parse(localStorage.getItem("singapore-family-trip-v1-backup")!)).toMatchObject({ state: edited });
    expect(fetch).toHaveBeenCalledWith("/api/trips/create", expect.objectContaining({ body: JSON.stringify({ state: edited }) }));
  });

  it("maps common bootstrap failures to actionable messages", () => {
    expect(syncErrorMessage(new Error("Anonymous sign-ins are disabled"))).toContain("匿名登录");
    expect(syncErrorMessage(new Error("relation public.trips does not exist"))).toContain("数据库");
  });
});
