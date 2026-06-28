// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createInitialState } from "@/lib/trip-state";
import { ScheduledItemMoveDialog } from "./scheduled-item-move-dialog";

describe("ScheduledItemMoveDialog", () => {
  it("keeps date and time as drafts until one confirmation", async () => {
    const state = createInitialState();
    const item = state.scheduledItems.find((candidate) => candidate.id === "s-luge")!;
    const card = state.cards.find((candidate) => candidate.id === item.cardId)!;
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(<ScheduledItemMoveDialog item={item} card={card} onConfirm={onConfirm} onClose={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "7月8日" }));
    const time = screen.getByLabelText("新的开始时间");
    await user.clear(time);
    await user.type(time, "10:00");
    expect(onConfirm).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "确认移动" }));
    expect(onConfirm).toHaveBeenCalledWith({ date: "2026-07-08", startTime: "10:00" });
  });

  it("closes without committing on Escape", async () => {
    const state = createInitialState();
    const item = state.scheduledItems[0];
    const card = state.cards.find((candidate) => candidate.id === item.cardId)!;
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<ScheduledItemMoveDialog item={item} card={card} onConfirm={vi.fn()} onClose={onClose} />);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });
});
