// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { tripDays } from "@/data/seed";
import { MobileDayTabs } from "./mobile-day-tabs";

describe("MobileDayTabs", () => {
  it("shows all dates with activity counts and selects one", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<MobileDayTabs days={tripDays} selectedDate="2026-07-09" counts={{ "2026-07-07": 4, "2026-07-08": 3, "2026-07-09": 7, "2026-07-10": 2 }} onSelect={onSelect} />);
    expect(screen.getAllByRole("tab")).toHaveLength(4);
    expect(screen.getByRole("tab", { name: "7月9日 周四 7项" })).toHaveAttribute("aria-selected", "true");
    await user.click(screen.getByRole("tab", { name: "7月8日 周三 3项" }));
    expect(onSelect).toHaveBeenCalledWith("2026-07-08");
  });
});
