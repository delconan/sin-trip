"use client";

type Day = { date: string; short: string; weekday: string };

export function MobileDayTabs({
  days,
  selectedDate,
  counts,
  onSelect,
}: {
  days: readonly Day[];
  selectedDate: string;
  counts: Record<string, number>;
  onSelect: (date: string) => void;
}) {
  return (
    <div className="mobile-day-tabs" role="tablist" aria-label="选择行程日期">
      {days.map((day, index) => {
        const selected = day.date === selectedDate;
        const count = counts[day.date] ?? 0;
        return (
          <button
            key={day.date}
            role="tab"
            id={`mobile-day-tab-${index}`}
            aria-controls={`day-column-${day.date}`}
            aria-selected={selected}
            aria-label={`${day.short} ${day.weekday} ${count}项`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelect(day.date)}
          >
            <span>{day.short.replace("月", "/").replace("日", "")}</span>
            <small>{count} 项</small>
          </button>
        );
      })}
    </div>
  );
}
