"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { browserSupabase, isSupabaseBrowserConfigured } from "@/lib/supabase/client";
import { localTripBackupKey, makeLocalBackup } from "@/lib/local-trip";
import type { TripAction } from "@/lib/trip-state";
import type { TripState } from "@/types/trip";

export type SyncStatus = "local" | "connecting" | "needs-cloud-action" | "creating" | "synced" | "saving" | "error";

export function extractShareToken(hash: string) {
  const token = hash.replace(/^#/, "");
  return /^[a-f0-9]{32}$/i.test(token) ? token.toLowerCase() : undefined;
}

export function makeShareUrl(base: string, token: string) {
  return `${base.replace(/#.*$/, "")}#${token}`;
}

export function syncErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/anonymous.*disabled|anonymous sign-ins/i.test(message)) return "Supabase 匿名登录未启用，请在 Authentication 中启用后重试。";
  if (/supabase.*not configured|supabase 未配置|credentials/i.test(message)) return "Vercel 的 Supabase 环境变量不完整。";
  if (/relation .* does not exist|schema cache|could not find the table/i.test(message)) return "Supabase 数据库表尚未建立，请执行项目迁移。";
  if (/invalid.*token|分享链接|not found/i.test(message)) return "私密分享链接无效或已经重置。";
  if (/failed to fetch|network|load failed/i.test(message)) return "网络连接失败，本地行程仍已保留。";
  return message ? `同步失败：${message}` : "同步失败，本地行程仍已保留。";
}

async function authorizedFetch(path: string, accessToken: string, init?: RequestInit) {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}`, ...init?.headers },
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  return { response, payload };
}

async function anonymousAccessToken() {
  const supabase = browserSupabase();
  let { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    const result = await supabase.auth.signInAnonymously();
    if (result.error) throw result.error;
    session = result.data.session;
  }
  if (!session) throw new Error("无法建立匿名会话");
  return session.access_token;
}

export function useTripSync(
  state: TripState,
  dispatch: React.Dispatch<TripAction>,
  options: { localReady: boolean } = { localReady: true },
) {
  const [status, setStatus] = useState<SyncStatus>(isSupabaseBrowserConfigured ? "connecting" : "local");
  const [errorMessage, setErrorMessage] = useState<string>();
  const [tripId, setTripId] = useState<string>();
  const [shareToken, setShareToken] = useState<string>();
  const [retryNonce, setRetryNonce] = useState(0);
  const accessTokenRef = useRef<string | undefined>(undefined);
  const remoteRevisionRef = useRef<number | undefined>(undefined);
  const readyRef = useRef(false);
  const stateRef = useRef(state);
  const dispatchRef = useRef(dispatch);
  const channelRef = useRef<ReturnType<ReturnType<typeof browserSupabase>["channel"]> | undefined>(undefined);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { dispatchRef.current = dispatch; }, [dispatch]);

  const clearChannel = useCallback(() => {
    if (channelRef.current) {
      void browserSupabase().removeChannel(channelRef.current);
      channelRef.current = undefined;
    }
  }, []);

  const subscribe = useCallback((id: string) => {
    clearChannel();
    const supabase = browserSupabase();
    channelRef.current = supabase.channel(`trip-${id}`).on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "trips", filter: `id=eq.${id}` },
      async (payload) => {
        const revision = Number((payload.new as { revision?: number }).revision);
        if (!readyRef.current || revision === remoteRevisionRef.current || !accessTokenRef.current) return;
        const fresh = await authorizedFetch(`/api/trips/state?tripId=${id}`, accessTokenRef.current);
        if (fresh.response.ok) {
          remoteRevisionRef.current = fresh.payload.state.revision;
          dispatchRef.current({ type: "hydrate", state: fresh.payload.state });
          setErrorMessage(undefined);
          setStatus("synced");
        }
      },
    ).subscribe((channelStatus) => {
      if (channelStatus === "CHANNEL_ERROR" || channelStatus === "TIMED_OUT" || channelStatus === "CLOSED") {
        setErrorMessage("实时同步连接已断开，本机修改仍会保留；请检查网络后重试连接。");
        setStatus("error");
      }
    });
  }, [clearChannel]);

  const connect = useCallback((id: string, token: string, cloudState: TripState, preserveNewerLocal: boolean) => {
    setShareToken(token);
    setTripId(id);
    remoteRevisionRef.current = cloudState.revision;
    if (!preserveNewerLocal || stateRef.current.revision <= cloudState.revision) {
      dispatchRef.current({ type: "hydrate", state: cloudState });
    }
    readyRef.current = true;
    setErrorMessage(undefined);
    setStatus("synced");
    subscribe(id);
  }, [subscribe]);

  useEffect(() => {
    if (!isSupabaseBrowserConfigured || !options.localReady) return;
    const fragmentToken = extractShareToken(window.location.hash);
    if (!fragmentToken) {
      readyRef.current = false;
      let cancelled = false;
      queueMicrotask(() => {
        if (cancelled) return;
        setErrorMessage(undefined);
        setStatus("needs-cloud-action");
      });
      return () => { cancelled = true; };
    }

    let cancelled = false;
    const join = async () => {
      setStatus("connecting");
      setErrorMessage(undefined);
      try {
        const accessToken = await anonymousAccessToken();
        accessTokenRef.current = accessToken;
        const result = await authorizedFetch("/api/trips/join", accessToken, {
          method: "POST",
          body: JSON.stringify({ token: fragmentToken }),
        });
        if (!result.response.ok) throw new Error(result.payload.error ?? "无法打开共享行程");
        if (!cancelled) connect(result.payload.tripId, fragmentToken, result.payload.state, false);
      } catch (error) {
        if (!cancelled) {
          console.error(error);
          setErrorMessage(syncErrorMessage(error));
          setStatus("error");
        }
      }
    };
    void join();
    return () => { cancelled = true; };
  }, [connect, options.localReady, retryNonce]);

  useEffect(() => () => clearChannel(), [clearChannel]);

  useEffect(() => {
    if (!readyRef.current || !tripId || !accessTokenRef.current || remoteRevisionRef.current === undefined) return;
    if (state.revision === remoteRevisionRef.current) return;
    const timeout = window.setTimeout(async () => {
      setStatus("saving");
      try {
        const result = await authorizedFetch("/api/trips/state", accessTokenRef.current!, {
          method: "PUT",
          body: JSON.stringify({ tripId, expectedRevision: remoteRevisionRef.current, state }),
        });
        if (result.response.status === 409) {
          remoteRevisionRef.current = result.payload.state.revision;
          dispatchRef.current({ type: "hydrate", state: result.payload.state });
          setErrorMessage("另一台设备刚刚保存了更新，已载入最新行程。请重新确认本次修改。");
          setStatus("error");
        } else if (result.response.ok) {
          remoteRevisionRef.current = result.payload.revision;
          dispatchRef.current({ type: "hydrate", state: { ...state, revision: result.payload.revision } });
          setErrorMessage(undefined);
          setStatus("synced");
        } else throw new Error(result.payload.error ?? "无法保存行程");
      } catch (error) {
        console.error(error);
        setErrorMessage(syncErrorMessage(error));
        setStatus("error");
      }
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [state, tripId]);

  const createTrip = useCallback(async (initialState: TripState) => {
    if (!isSupabaseBrowserConfigured || !options.localReady) return false;
    setStatus("creating");
    setErrorMessage(undefined);
    const snapshot = structuredClone(initialState);
    try {
      localStorage.setItem(localTripBackupKey, JSON.stringify(makeLocalBackup(snapshot)));
      const accessToken = await anonymousAccessToken();
      accessTokenRef.current = accessToken;
      const result = await authorizedFetch("/api/trips/create", accessToken, {
        method: "POST",
        body: JSON.stringify({ state: snapshot }),
      });
      if (!result.response.ok) throw new Error(result.payload.error ?? "无法创建共享行程");
      const token = result.payload.token as string;
      window.history.replaceState(null, "", makeShareUrl(`${window.location.origin}/trip`, token));
      connect(result.payload.tripId, token, result.payload.state, true);
      return true;
    } catch (error) {
      console.error(error);
      setErrorMessage(syncErrorMessage(error));
      setStatus("error");
      return false;
    }
  }, [connect, options.localReady]);

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
    errorMessage,
    tripId,
    shareToken,
    shareUrl: shareToken && typeof window !== "undefined" ? makeShareUrl(`${window.location.origin}/trip`, shareToken) : undefined,
    createTrip,
    retry: () => setRetryNonce((value) => value + 1),
    resetAccess,
  };
}
