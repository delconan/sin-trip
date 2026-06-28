"use client";

import { Check, X } from "lucide-react";
import { useState } from "react";
import { getEndTime } from "@/lib/planner";

const validTime = (value: string) => {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  return Boolean(match && Number(match[1]) < 24 && Number(match[2]) < 60 && Number(match[2]) % 15 === 0);
};

export function ScheduledTimeEditor({
  label,
  value,
  durationMinutes,
  onCommit,
}: {
  label: string;
  value: string;
  durationMinutes: number;
  onCommit: (time: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const dirty = draft !== value;
  const valid = validTime(draft);
  const commit = () => {
    if (dirty && valid) onCommit(draft);
  };
  const cancel = () => setDraft(value);

  return (
    <div className={`scheduled-time ${dirty ? "has-draft" : ""}`}>
      <input
        aria-label={`${label} 开始时间`}
        type="time"
        step="900"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") { event.preventDefault(); commit(); }
          if (event.key === "Escape") { event.preventDefault(); cancel(); }
        }}
      />
      <span>— {getEndTime(valid ? draft : value, durationMinutes)}</span>
      {dirty && <span className="time-draft-actions">
        <button aria-label={`确认 ${label} 开始时间`} disabled={!valid} onClick={commit}><Check size={11} /></button>
        <button aria-label={`取消 ${label} 开始时间`} onClick={cancel}><X size={11} /></button>
      </span>}
    </div>
  );
}
