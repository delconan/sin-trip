// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ScheduledTimeEditor } from "./scheduled-time-editor";

describe("ScheduledTimeEditor", () => {
  it("keeps time changes local until Enter confirms them", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<ScheduledTimeEditor label="夜间动物园" value="19:15" durationMinutes={165} onCommit={onCommit} />);

    const input = screen.getByLabelText("夜间动物园 开始时间");
    await user.clear(input);
    await user.type(input, "10:00");

    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByText("— 12:45")).toBeInTheDocument();
    await user.keyboard("{Enter}");
    expect(onCommit).toHaveBeenCalledOnce();
    expect(onCommit).toHaveBeenCalledWith("10:00");
  });

  it("restores the saved value when Escape cancels a draft", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<ScheduledTimeEditor label="夜间动物园" value="19:15" durationMinutes={165} onCommit={onCommit} />);

    const input = screen.getByLabelText("夜间动物园 开始时间");
    await user.clear(input);
    await user.type(input, "10:00{Escape}");

    expect(input).toHaveValue("19:15");
    expect(onCommit).not.toHaveBeenCalled();
  });
});
