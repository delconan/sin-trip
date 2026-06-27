"use client";

import { useEffect, useRef, useState } from "react";
import { browserSupabase, isSupabaseBrowserConfigured } from "@/lib/supabase/client";
import type { TripAction } from "@/lib/trip-state";
import type { TripState } from "@/types/trip";

export type SyncStatus = "local" | "connecting" | "synced" | "saving" | "error";

export function extractShareToken(hash: string) {
  const token = hash.replace(/^#/, "");
  return /^[a-f0-9]{32}$/i.test(token) ? token : undefined;
}

export function makeShareUrl(base: string, token: string) {
  return `${base.replace(/#.*$/, "")}#${token}`;
}

async function authorizedFetch(path: string, accessToken: string, init?: RequestInit) {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}`, ...init?.headers },
  });
  const payload = await response.json();
  return { response, payload };
}

export function useTripSync(state: TripState, dispatch: React.Dispatch<TripAction>) {
  const [status, setStatus] = useState<SyncStatus>(isSupabaseBrowserConfigured ? "connecting" : "local");
  const [tripId, setTripId] = useState<string>();
  const [shareToken, setShareToken] = useState<string>();
  const accessTokenRef = useRef<string | undefined>(undefined);
  const remoteRevisionRef = useRef<number | undefined>(undefined);
  const readyRef = useRef(false);

  useEffect(() => {
    if (!isSupabaseBrowserConfigured) return;
    let cancelled = false;
    let channel: ReturnType<ReturnType<typeof browserSupabase>["channel"]> | undefined;
    const bootstrap = async () => {
      try {
        const supabase = browserSupabase();
        let { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          const result = await supabase.auth.signInAnonymously();
          session = result.data.session;
          if (result.error) throw result.error;
        }
        if (!session) throw new Error("无法建立匿名会话");
        accessTokenRef.current = session.access_token;
        const fragmentToken = extractShareToken(window.location.hash);
        const result = fragmentToken
          ? await authorizedFetch("/api/trips/join", session.access_token, { method: "POST", body: JSON.stringify({ token: fragmentToken }) })
          : await authorizedFetch("/api/trips/create", session.access_token, { method: "POST" });
        if (!result.response.ok) throw new Error(result.payload.error ?? "无法打开共享行程");
        if (cancelled) return;
        const token = fragmentToken ?? result.payload.token;
        const id = result.payload.tripId as string;
        setShareToken(token);
        setTripId(id);
        if (!fragmentToken) window.history.replaceState(null, "", makeShareUrl(`${window.location.origin}/trip`, token));
        remoteRevisionRef.current = result.payload.state.revision;
        dispatch({ type: "hydrate", state: result.payload.state });
        readyRef.current = true;
        setStatus("synced");
        channel = supabase.channel(`trip-${id}`).on("postgres_changes", { event: "UPDATE", schema: "public", table: "trips", filter: `id=eq.${id}` }, async (payload) => {
          const revision = Number((payload.new as { revision?: number }).revision);
          if (!readyRef.current || revision === remoteRevisionRef.current) return;
          const fresh = await authorizedFetch(`/api/trips/state?tripId=${id}`, accessTokenRef.current!);
          if (fresh.response.ok) {
            remoteRevisionRef.current = fresh.payload.state.revision;
            dispatch({ type: "hydrate", state: fresh.payload.state });
            setStatus("synced");
          }
        }).subscribe();
      } catch (error) {
        if (!cancelled) {
          console.error(error);
          setStatus("error");
        }
      }
    };
    void bootstrap();
    return () => {
      cancelled = true;
      readyRef.current = false;
      if (channel) void browserSupabase().removeChannel(channel);
    };
  }, [dispatch]);

  useEffect(() => {
    if (!readyRef.current || !tripId || !accessTokenRef.current || remoteRevisionRef.current === undefined) return;
    if (state.revision === remoteRevisionRef.current) return;
    const timeout = window.setTimeout(async () => {
      setStatus("saving");
      const result = await authorizedFetch("/api/trips/state", accessTokenRef.current!, {
        method: "PUT",
        body: JSON.stringify({ tripId, expectedRevision: remoteRevisionRef.current, state }),
      });
      if (result.response.status === 409) {
        remoteRevisionRef.current = result.payload.state.revision;
        dispatch({ type: "hydrate", state: result.payload.state });
        setStatus("error");
      } else if (result.response.ok) {
        remoteRevisionRef.current = result.payload.revision;
        dispatch({ type: "hydrate", state: { ...state, revision: result.payload.revision } });
        setStatus("synced");
      } else setStatus("error");
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [dispatch, state, tripId]);

  const resetAccess = async () => {
    if (!tripId || !accessTokenRef.current) return undefined;
    const result = await authorizedFetch("/api/trips/reset-access", accessTokenRef.current, { method: "POST", body: JSON.stringify({ tripId }) });
    if (!result.response.ok) return undefined;
    setShareToken(result.payload.token);
    window.history.replaceState(null, "", makeShareUrl(`${window.location.origin}/trip`, result.payload.token));
    return result.payload.token as string;
  };

  return {
    status,
    tripId,
    shareToken,
    shareUrl: shareToken && typeof window !== "undefined" ? makeShareUrl(`${window.location.origin}/trip`, shareToken) : undefined,
    resetAccess,
  };
}
