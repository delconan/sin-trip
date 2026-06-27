// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlannerApp } from "./planner-app";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const renderPlanner = () => render(<QueryClientProvider client={new QueryClient()}><PlannerApp /></QueryClientProvider>);

beforeEach(() => localStorage.clear());

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

  it("edits a day title in place and saves it with Enter", async () => {
    const user = userEvent.setup();
    renderPlanner();

    await user.click(screen.getByRole("button", { name: "编辑 Mandai 像素与夜行" }));
    const input = screen.getByLabelText("7月8日标题");
    await user.clear(input);
    await user.type(input, "动物世界日{Enter}");

    expect(screen.getByRole("heading", { name: "动物世界日" })).toBeInTheDocument();
  });

  it("cancels a day title edit with Escape", async () => {
    const user = userEvent.setup();
    renderPlanner();

    await user.click(screen.getByRole("button", { name: "编辑 Mandai 像素与夜行" }));
    const input = screen.getByLabelText("7月8日标题");
    await user.clear(input);
    await user.type(input, "不保存{Escape}");

    expect(screen.getByRole("heading", { name: "Mandai 像素与夜行" })).toBeInTheDocument();
  });

  it("opens a three-mode route comparison before offering Google Maps", async () => {
    const user = userEvent.setup();
    renderPlanner();

    await user.click(screen.getByRole("button", { name: "查看 抵达樟宜机场 到 酒店入住与午休 的交通方案" }));
    const dialog = screen.getByRole("dialog", { name: "交通方案对比" });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "步行" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "公交 / MRT" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "打车" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Google Maps 查询/ })).toHaveLength(3);

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "交通方案对比" })).not.toBeInTheDocument();
  });
});
