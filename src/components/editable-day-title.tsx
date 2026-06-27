"use client";

import { Pencil } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function EditableDayTitle({
  dateLabel,
  title,
  onSave,
}: {
  dateLabel: string;
  title: string;
  onSave: (title: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const cancel = () => {
    setDraft(title);
    setEditing(false);
  };
  const commit = () => {
    const value = draft.trim();
    if (!value || value.length > 40) return cancel();
    if (value !== title) onSave(value);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="day-title-input"
        aria-label={`${dateLabel}标题`}
        value={draft}
        maxLength={40}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
          if (event.key === "Escape") cancel();
        }}
      />
    );
  }

  return (
    <button className="day-title-button" aria-label={`编辑 ${title}`} onClick={() => { setDraft(title); setEditing(true); }}>
      <h2>{title}</h2>
      <Pencil size={12} aria-hidden="true" />
    </button>
  );
}
