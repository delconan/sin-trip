// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CloudTripEntry } from "./cloud-trip-entry";

describe("CloudTripEntry", () => {
  it("offers to save an existing local itinerary", async () => {
    const onCreate = vi.fn();
    const user = userEvent.setup();
    render(<CloudTripEntry hadStoredState busy={false} onCreate={onCreate} onOpenToken={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "保存当前行程到云端" }));
    expect(onCreate).toHaveBeenCalledOnce();
  });

  it("accepts a complete private URL and rejects a bare home URL", async () => {
    const onOpenToken = vi.fn();
    const user = userEvent.setup();
    render(<CloudTripEntry hadStoredState={false} busy={false} onCreate={vi.fn()} onOpenToken={onOpenToken} />);
    const input = screen.getByLabelText("私密分享链接或令牌");
    const open = screen.getByRole("button", { name: "打开共享行程" });

    await user.type(input, "https://trip.example/");
    expect(open).toBeDisabled();
    await user.clear(input);
    await user.type(input, "https://trip.example/trip#6fb2f2aa1e23415bbbd7022e9f43f888");
    await user.click(open);
    expect(onOpenToken).toHaveBeenCalledWith("6fb2f2aa1e23415bbbd7022e9f43f888");
  });

  it("shows a retry action with the sync error", async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(<CloudTripEntry hadStoredState busy={false} errorMessage="匿名登录未启用" onCreate={vi.fn()} onOpenToken={vi.fn()} onRetry={onRetry} />);
    expect(screen.getByText("匿名登录未启用")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "重试连接" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
