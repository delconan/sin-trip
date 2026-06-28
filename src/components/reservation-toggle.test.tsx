// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ReservationToggle } from "./reservation-toggle";

describe("ReservationToggle", () => {
  it("shows required and booked states", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    const { rerender } = render(<ReservationToggle status="required" onToggle={onToggle} />);
    await user.click(screen.getByRole("button", { name: "标记为已预约" }));
    expect(onToggle).toHaveBeenCalledOnce();
    rerender(<ReservationToggle status="booked" onToggle={onToggle} />);
    expect(screen.getByText("已预约")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "标记为需预约" })).toBeInTheDocument();
  });
});
