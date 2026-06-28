// @vitest-environment jsdom
import "@/app/globals.css";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DropIndicator, PlannerApp } from "./planner-app";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const renderPlanner = () => render(<QueryClientProvider client={new QueryClient()}><PlannerApp /></QueryClientProvider>);

beforeEach(() => localStorage.clear());

describe("PlannerApp", () => {
  it("renders a clear drop-position indicator", () => {
    render(<DropIndicator />);
    expect(screen.getByText("放在这里")).toBeInTheDocument();
  });

  it("keeps the drop indicator out of the sortable layout flow", () => {
    render(<DropIndicator />);
    const indicator = screen.getByRole("status");
    expect(getComputedStyle(indicator).height).toBe("0px");
    expect(getComputedStyle(indicator).pointerEvents).toBe("none");
  });

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

  it("auto-resolves a unique custom address before saving", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [{ title: "414 GEYLANG ROAD", address: "414 GEYLANG ROAD SINGAPORE 389392", latitude: 1.312888405679514, longitude: 103.8826252657034 }] }),
    }));
    const user = userEvent.setup();
    renderPlanner();
    await user.click(screen.getByRole("button", { name: "新建自定义活动" }));
    await user.type(screen.getByLabelText("活动名称"), "No Signboard Seafood");
    await user.type(screen.getByLabelText("地点"), "414 Geylang Rd Singapore 389392");
    await user.click(screen.getByRole("button", { name: "保存到卡片库" }));

    await user.click(screen.getByRole("button", { name: "关闭详情" }));
    const card = (await screen.findByText("No Signboard Seafood", { selector: ".candidate-title" })).closest("article");
    expect(card).not.toBeNull();
    await user.click(within(card!).getByRole("button", { name: "加入7月7日" }));
    await user.click(screen.getByRole("button", { name: "查看 Palm Beach Seafood 到 No Signboard Seafood 的交通方案" }));
    expect(screen.getByRole("link", { name: "步行 Google Maps 查询" })).toHaveAttribute(
      "href",
      expect.stringContaining("destination=1.312888405679514%2C103.8826252657034"),
    );
    vi.unstubAllGlobals();
  });

  it("does not save an unresolved custom address", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [] }) }));
    const user = userEvent.setup();
    renderPlanner();
    await user.click(screen.getByRole("button", { name: "新建自定义活动" }));
    await user.type(screen.getByLabelText("活动名称"), "未知餐厅");
    await user.type(screen.getByLabelText("地点"), "找不到的地址 999999");
    await user.click(screen.getByRole("button", { name: "保存到卡片库" }));

    expect(await screen.findByText("OneMap 找不到这个地址，请补充邮编或选择候选地址")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "新建自定义活动" })).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("updates an existing custom card to a OneMap location", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [{ title: "414 GEYLANG ROAD", address: "414 GEYLANG ROAD SINGAPORE 389392", latitude: 1.312888405679514, longitude: 103.8826252657034 }] }),
    }));
    const user = userEvent.setup();
    renderPlanner();
    await user.click(screen.getByRole("button", { name: "新建自定义活动" }));
    await user.type(screen.getByLabelText("活动名称"), "No Signboard Seafood");
    await user.type(screen.getByLabelText("地点"), "临时地址");
    await user.type(screen.getByLabelText("纬度（可选）"), "1.30");
    await user.type(screen.getByLabelText("经度（可选）"), "103.80");
    await user.click(screen.getByRole("button", { name: "保存到卡片库" }));

    await user.click(screen.getByRole("button", { name: "编辑 No Signboard Seafood 地点" }));
    const address = screen.getByLabelText("No Signboard Seafood 地点地址");
    await user.clear(address);
    await user.type(address, "414 Geylang Rd Singapore 389392");
    await user.click(screen.getByRole("button", { name: "保存 No Signboard Seafood 地点" }));
    expect(await screen.findByText("414 GEYLANG ROAD SINGAPORE 389392")).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("requires a second confirmation before deleting a custom card", async () => {
    const user = userEvent.setup();
    renderPlanner();
    await user.click(screen.getByRole("button", { name: "新建自定义活动" }));
    await user.type(screen.getByLabelText("活动名称"), "待删除活动");
    await user.type(screen.getByLabelText("地点"), "测试地址");
    await user.type(screen.getByLabelText("纬度（可选）"), "1.30");
    await user.type(screen.getByLabelText("经度（可选）"), "103.80");
    await user.click(screen.getByRole("button", { name: "保存到卡片库" }));

    await user.click(screen.getByRole("button", { name: "删除自定义卡" }));
    expect(screen.getByRole("button", { name: "确认删除" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "取消删除" }));
    expect(screen.getByRole("heading", { name: "待删除活动" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "删除自定义卡" }));
    await user.click(screen.getByRole("button", { name: "确认删除" }));
    expect(screen.queryByText("待删除活动")).not.toBeInTheDocument();
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

  it("updates a card suggested duration only after confirmation", async () => {
    const user = userEvent.setup();
    renderPlanner();

    await user.click(screen.getByText("Minecraft Experience"));
    const duration = screen.getByLabelText("Minecraft Experience 建议时长");
    await user.clear(duration);
    await user.type(duration, "90");

    expect(screen.getByText("— 17:00")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "确认 Minecraft Experience 建议时长" }));
    expect(screen.getByText("— 17:30")).toBeInTheDocument();
    expect(screen.getByLabelText("Minecraft Experience 建议时长")).toHaveValue(90);
  });
});
