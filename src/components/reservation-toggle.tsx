"use client";

import { CalendarCheck, CalendarClock } from "lucide-react";

export function ReservationToggle({ status, onToggle, compact = false }: {
  status: "required" | "booked";
  onToggle: () => void;
  compact?: boolean;
}) {
  const booked = status === "booked";
  const Icon = booked ? CalendarCheck : CalendarClock;
  return (
    <button
      type="button"
      className={`reservation-toggle ${booked ? "is-booked" : "is-required"} ${compact ? "is-compact" : ""}`}
      aria-label={booked ? "标记为需预约" : "标记为已预约"}
      onClick={(event) => { event.stopPropagation(); onToggle(); }}
    >
      <Icon size={compact ? 11 : 13} />{booked ? "已预约" : "需预约"}
    </button>
  );
}
