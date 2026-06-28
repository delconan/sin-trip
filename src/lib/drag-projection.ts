import type { ScheduledItem } from "@/types/trip";

export interface DropProjection {
  date: string;
  position: number;
}

export function projectDrop({
  activeItemId,
  overId,
  items,
  activeCenterY,
  overTop,
  overHeight,
}: {
  activeItemId: string;
  overId?: string;
  items: ScheduledItem[];
  activeCenterY?: number;
  overTop?: number;
  overHeight?: number;
}): DropProjection | undefined {
  if (!overId) return undefined;
  if (overId.startsWith("day:")) {
    const date = overId.slice(4);
    const position = items.filter((item) => item.id !== activeItemId && item.date === date).length;
    return { date, position };
  }
  if (!overId.startsWith("item:")) return undefined;
  const targetId = overId.slice(5);
  const target = items.find((item) => item.id === targetId);
  if (!target) {
    const active = items.find((item) => item.id === activeItemId);
    return active ? { date: active.date, position: active.position } : undefined;
  }
  const targetDay = items
    .filter((item) => item.id !== activeItemId && item.date === target.date)
    .sort((a, b) => a.position - b.position);
  const targetIndex = targetDay.findIndex((item) => item.id === target.id);
  if (targetIndex < 0) return undefined;
  const after = activeCenterY !== undefined && overTop !== undefined && overHeight !== undefined
    ? activeCenterY >= overTop + overHeight / 2
    : false;
  return { date: target.date, position: targetIndex + (after ? 1 : 0) };
}
