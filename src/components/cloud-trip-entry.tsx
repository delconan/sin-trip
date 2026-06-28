"use client";

import { useMemo, useState } from "react";
import { Cloud, Link2, RefreshCw, ShieldCheck } from "lucide-react";
import { extractPastedShareToken } from "@/lib/local-trip";

export function CloudTripEntry({
  hadStoredState,
  busy,
  errorMessage,
  onCreate,
  onOpenToken,
  onRetry,
}: {
  hadStoredState: boolean;
  busy: boolean;
  errorMessage?: string;
  onCreate: () => void;
  onOpenToken: (token: string) => void;
  onRetry?: () => void;
}) {
  const [linkDraft, setLinkDraft] = useState("");
  const token = useMemo(() => extractPastedShareToken(linkDraft), [linkDraft]);

  return (
    <section className="cloud-trip-entry" aria-labelledby="cloud-trip-heading">
      <div className="cloud-entry-stamp"><Cloud aria-hidden="true" /><span>PRIVATE TRIP</span></div>
      <div className="cloud-entry-copy">
        <p className="eyebrow">把这一页带到手机上</p>
        <h2 id="cloud-trip-heading">{hadStoredState ? "先保存电脑里的当前行程" : "建立一份共享行程"}</h2>
        <p>{hadStoredState ? "会先在本机留下备份，云端确认成功后才生成私密编辑链接。" : "创建后会生成带私密令牌的链接；仅拿到链接的人可以编辑。"}</p>
        {errorMessage && <p className="cloud-entry-error" role="alert">{errorMessage}</p>}
      </div>
      <div className="cloud-entry-actions">
        <button className="cloud-create" disabled={busy} onClick={onCreate}>
          <ShieldCheck aria-hidden="true" />{busy ? "正在保存…" : hadStoredState ? "保存当前行程到云端" : "创建共享行程"}
        </button>
        <label>
          <span>已有链接？</span>
          <span className="cloud-link-field"><Link2 aria-hidden="true" /><input aria-label="私密分享链接或令牌" value={linkDraft} onChange={(event) => setLinkDraft(event.target.value)} placeholder="粘贴 /trip#… 链接" /></span>
        </label>
        <button className="cloud-open" disabled={!token || busy} onClick={() => token && onOpenToken(token)}>打开共享行程</button>
        {errorMessage && onRetry && <button className="cloud-retry" onClick={onRetry}><RefreshCw aria-hidden="true" />重试连接</button>}
      </div>
    </section>
  );
}
