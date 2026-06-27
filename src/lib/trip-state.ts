import { seedCards, seedSchedule } from "@/data/seed";
import { getEndTime, sortDayItems } from "@/lib/planner";
import type { ActivityCard, ScheduledItem, TripState } from "@/types/trip";

export type TripAction =
  | { type: "schedule"; cardId: string; date: string }
  | { type: "move"; itemId: string; date: string; position: number }
  | { type: "set-time"; itemId: string; startTime: string }
  | { type: "remove-item"; itemId: string }
  | { type: "add-card"; card: ActivityCard }
  | { type: "delete-card"; cardId: string }
  | { type: "hydrate"; state: TripState }
  | { type: "reset" };

export function createInitialState(): TripState {
  return {
    revision: 1,
    cards: structuredClone(seedCards),
    scheduledItems: structuredClone(seedSchedule),
  };
}

function reindex(items: ScheduledItem[]) {
  const dates = [...new Set(items.map((item) => item.date))];
  const result: ScheduledItem[] = [];
  for (const date of dates) {
    items.filter((item) => item.date === date).forEach((item, position) => result.push({ ...item, position }));
  }
  return result;
}

function nextTimeForDay(state: TripState, date: string) {
  const dayItems = sortDayItems(state.scheduledItems.filter((item) => item.date === date));
  const last = dayItems.at(-1);
  if (!last) return "09:00";
  const card = state.cards.find((candidate) => candidate.id === last.cardId);
  return card ? getEndTime(last.startTime, card.durationMinutes + 30) : "09:00";
}

export function tripReducer(state: TripState, action: TripAction): TripState {
  if (action.type === "hydrate") return action.state;
  if (action.type === "reset") return createInitialState();
  if (action.type === "schedule") {
    const item: ScheduledItem = {
      id: crypto.randomUUID(),
      cardId: action.cardId,
      date: action.date,
      startTime: nextTimeForDay(state, action.date),
      position: state.scheduledItems.filter((candidate) => candidate.date === action.date).length,
      version: 1,
    };
    return { ...state, revision: state.revision + 1, scheduledItems: [...state.scheduledItems, item] };
  }
  if (action.type === "move") {
    const target = state.scheduledItems.find((item) => item.id === action.itemId);
    if (!target) return state;
    const remaining = state.scheduledItems.filter((item) => item.id !== action.itemId);
    const targetDay = sortDayItems(remaining.filter((item) => item.date === action.date));
    targetDay.splice(Math.max(0, Math.min(action.position, targetDay.length)), 0, { ...target, date: action.date, version: (target.version ?? 0) + 1 });
    const otherDays = remaining.filter((item) => item.date !== action.date);
    return { ...state, revision: state.revision + 1, scheduledItems: reindex([...otherDays, ...targetDay]) };
  }
  if (action.type === "set-time") {
    const match = /^(\d{2}):(\d{2})$/.exec(action.startTime);
    if (!match || Number(match[2]) % 15 !== 0) throw new Error("时间必须落在 15 分钟刻度");
    const target = state.scheduledItems.find((item) => item.id === action.itemId);
    if (!target) return state;
    const updated = state.scheduledItems.map((item) => item.id === action.itemId ? { ...item, startTime: action.startTime, version: (item.version ?? 0) + 1 } : item);
    const targetDay = updated
      .filter((item) => item.date === target.date)
      .sort((a, b) => a.startTime.localeCompare(b.startTime) || a.position - b.position);
    return {
      ...state,
      revision: state.revision + 1,
      scheduledItems: reindex([
        ...updated.filter((item) => item.date !== target.date),
        ...targetDay,
      ]),
    };
  }
  if (action.type === "remove-item") {
    return { ...state, revision: state.revision + 1, scheduledItems: reindex(state.scheduledItems.filter((item) => item.id !== action.itemId)) };
  }
  if (action.type === "add-card") {
    return { ...state, revision: state.revision + 1, cards: [...state.cards, action.card] };
  }
  if (action.type === "delete-card") {
    return {
      ...state,
      revision: state.revision + 1,
      cards: state.cards.filter((card) => card.id !== action.cardId),
      scheduledItems: reindex(state.scheduledItems.filter((item) => item.cardId !== action.cardId)),
    };
  }
  return state;
}
