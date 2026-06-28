"use client";

import { useEffect, useState } from "react";
import { ArrowRight, CalendarDays, Check, Clock3, X } from "lucide-react";
import { tripDays } from "@/data/seed";
import { getEndTime } from "@/lib/planner";
import type { ActivityCard, ScheduledItem } from "@/types/trip";

const validTime = (value: string) => {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  return Boolean(match && Number(match[1]) < 24 && Number(match[2]) < 60 && Number(match[2]) % 15 === 0);
};

export function ScheduledItemMoveDialog({
  item,
  card,
  onConfirm,
  onClose,
}: {
  item: ScheduledItem;
  card: ActivityCard;
  onConfirm: (next: { date: string; startTime: string }) => void;
  onClose: () => void;
}) {
  const [date, setDate] = useState(item.date);
  const [startTime, setStartTime] = useState(item.startTime);
  const valid = validTime(startTime);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop move-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="move-dialog" role="dialog" aria-modal="true" aria-labelledby="move-dialog-title">
        <button className="move-dialog-close" aria-label="关闭移动面板" onClick={onClose}><X /></button>
        <p className="eyebrow">MOVE THIS NOTE</p>
        <h2 id="move-dialog-title">移动 {card.title}</h2>
        <p className="move-dialog-route"><span>{tripDays.find((day) => day.date === item.date)?.short}</span><ArrowRight /><strong>{tripDays.find((day) => day.date === date)?.short}</strong></p>
        <div className="move-day-options" role="group" aria-label="选择目标日期">
          {tripDays.map((day) => (
            <button key={day.date} aria-label={day.short} aria-pressed={date === day.date} onClick={() => setDate(day.date)}>
              <CalendarDays aria-hidden="true" /><span>{day.short}</span><small>{day.weekday}</small>
            </button>
          ))}
        </div>
        <label className="move-time-field">
          <span><Clock3 aria-hidden="true" />新的开始时间</span>
          <input aria-label="新的开始时间" type="time" step="900" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
          <small>{valid ? `预计 ${getEndTime(startTime, card.durationMinutes)} 结束` : "请选择 15 分钟刻度"}</small>
        </label>
        <div className="move-dialog-actions">
          <button onClick={onClose}>取消</button>
          <button disabled={!valid} onClick={() => onConfirm({ date, startTime })}><Check aria-hidden="true" />确认移动</button>
        </div>
      </section>
    </div>
  );
}
