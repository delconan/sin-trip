// @vitest-environment jsdom
import "@/app/globals.css";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DropIndicator, PlannerApp } from "./planner-app";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createInitialState } from "@/lib/trip-state";

const syncHook = vi.hoisted(() => vi.fn());
vi.mock("@/lib/sync-client", () => ({ useTripSync: syncHook }));

const renderPlanner = () => render(<QueryClientProvider client={new QueryClient()}><PlannerApp /></QueryClientProvider>);

beforeEach(() => {
  localStorage.clear();
  syncHook.mockReset();
  syncHook.mockReturnValue({
    status: "local",
    errorMessage: undefined,
    tripId: undefined,
    shareUrl: undefined,
    createTrip: vi.fn(),
    retry: vi.fn(),
    resetAccess: vi.fn(),
  });
});

describe("PlannerApp", () => {
  it("restores browser state before enabling cloud bootstrap", async () => {
    const saved = createInitialState();
    saved.dayTitles["2026-07-08"] = "我的动物日";
    localStorage.setItem("singapore-family-trip-v1", JSON.stringify(saved));
    renderPlanner();

    expect(syncHook.mock.calls[0][2]).toEqual({ localReady: false });
    await screen.findByRole("heading", { name: "我的动物日" });
    expect(syncHook.mock.calls.at(-1)?.[2]).toEqual({ localReady: true });
  });

  it("offers explicit migration and sends the restored itinerary", async () => {
    const saved = createInitialState();
    saved.dayTitles["2026-07-08"] = "我的动物日";
    localStorage.setItem("singapore-family-trip-v1", JSON.stringify(saved));
    const createTrip = vi.fn().mockResolvedValue(true);
    syncHook.mockReturnValue({ status: "needs-cloud-action", createTrip, retry: vi.fn(), resetAccess: vi.fn() });
    const user = userEvent.setup();
    renderPlanner();

    await user.click(await screen.findByRole("button", { name: "保存当前行程到云端" }));
    expect(createTrip).toHaveBeenCalledWith(expect.objectContaining({ dayTitles: expect.objectContaining({ "2026-07-08": "我的动物日" }) }));
  });

  it("never copies the bare home page as a share link", async () => {
    syncHook.mockReturnValue({ status: "needs-cloud-action", createTrip: vi.fn(), retry: vi.fn(), resetAccess: vi.fn() });
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    renderPlanner();

    await user.click(screen.getByRole("button", { name: "分享" }));
    expect(writeText).not.toHaveBeenCalled();
    expect(screen.getByText("请先把当前行程保存到云端，再复制私密链接。")).toBeVisible();
  });

  it("copies the complete private URL after sync", async () => {
    syncHook.mockReturnValue({
      status: "synced",
      tripId: "trip-1",
      shareUrl: "https://trip.example/trip#6fb2f2aa1e23415bbbd7022e9f43f888",
      createTrip: vi.fn(),
      retry: vi.fn(),
      resetAccess: vi.fn(),
    });
    vi.spyOn(window, "alert").mockImplementation(() => undefined);
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    renderPlanner();
    await user.click(screen.getByRole("button", { name: "分享" }));
    expect(writeText).toHaveBeenCalledWith("https://trip.example/trip#6fb2f2aa1e23415bbbd7022e9f43f888");
  });

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

  it("selects one mobile day and exposes touch-friendly movement", async () => {
    renderPlanner();
    fireEvent.click(screen.getByRole("tab", { name: /7月9日 周四 7项/, hidden: true }));
    const selected = screen.getAllByTestId("day-column").find((column) => column.getAttribute("data-date") === "2026-07-09");
    expect(selected).toHaveAttribute("data-mobile-selected", "true");
    const grip = screen.getByRole("button", { name: "长按拖动 Skyline Luge · 3 Rounds" });
    expect(grip).toHaveClass("touch-drag-handle");
    expect(screen.getByRole("button", { name: "移动 Skyline Luge · 3 Rounds 到其他日期", hidden: true })).toBeInTheDocument();
  });

  it("moves an itinerary card to another day after one confirmation", async () => {
    const user = userEvent.setup();
    renderPlanner();
    fireEvent.click(screen.getByRole("button", { name: "移动 Skyline Luge · 3 Rounds 到其他日期", hidden: true }));
    await user.click(screen.getByRole("button", { name: "7月8日" }));
    const time = screen.getByLabelText("新的开始时间");
    await user.clear(time);
    await user.type(time, "10:00");
    await user.click(screen.getByRole("button", { name: "确认移动" }));

    const dayTwo = screen.getAllByTestId("day-column").find((column) => column.getAttribute("data-date") === "2026-07-08")!;
    expect(within(dayTwo).getByText("Skyline Luge · 3 Rounds")).toBeVisible();
    expect(screen.getByRole("tab", { name: /7月8日 周三 4项/, hidden: true })).toHaveAttribute("aria-selected", "true");
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

  it("keeps reservation status synchronized between itinerary and details", async () => {
    const user = userEvent.setup();
    renderPlanner();
    await user.click(screen.getByText("Minecraft Experience"));
    const drawer = screen.getByLabelText("Minecraft Experience 详情");
    await user.click(within(drawer).getByRole("button", { name: "标记为已预约" }));
    expect(screen.getAllByRole("button", { name: "标记为需预约" })).toHaveLength(2);
  });
});
