// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PlannerApp } from "./planner-app";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const renderPlanner = () => render(<QueryClientProvider client={new QueryClient()}><PlannerApp /></QueryClientProvider>);

describe("PlannerApp", () => {
  it("renders the trip summary and four day columns", () => {
    renderPlanner();
    expect(screen.getByRole("heading", { name: "四个人的小小新加坡" })).toBeInTheDocument();
    expect(screen.getAllByTestId("day-column")).toHaveLength(4);
    expect(screen.getByText("Minecraft Experience")).toBeInTheDocument();
  });

  it("filters candidate cards", async () => {
    const user = userEvent.setup();
    renderPlanner();
    await user.click(screen.getByRole("button", { name: "购物" }));
    expect(screen.getByText("乌节路购物")).toBeInTheDocument();
    expect(screen.queryByText("River Wonders")).not.toBeInTheDocument();
  });

  it("opens a custom card form and validates required fields", async () => {
    const user = userEvent.setup();
    renderPlanner();
    await user.click(screen.getByRole("button", { name: "新建自定义活动" }));
    expect(screen.getByRole("dialog", { name: "新建自定义活动" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "保存到卡片库" }));
    expect(screen.getByText("请填写活动名称和地点")).toBeInTheDocument();
  });

  it("uses OneMap search results for a custom location", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [{ title: "MARINA BAY SANDS", address: "10 BAYFRONT AVENUE", latitude: 1.2834, longitude: 103.8607 }] }),
    }));
    const user = userEvent.setup();
    renderPlanner();
    await user.click(screen.getByRole("button", { name: "新建自定义活动" }));
    await user.type(screen.getByLabelText("地点"), "Marina Bay");
    const option = await screen.findByRole("button", { name: "选择 MARINA BAY SANDS" });
    await user.click(option);
    expect(screen.getByLabelText("地点")).toHaveValue("10 BAYFRONT AVENUE");
    vi.unstubAllGlobals();
  });
});
