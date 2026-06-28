import { expect, test } from "@playwright/test";

const privateToken = "6fb2f2aa1e23415bbbd7022e9f43f888";

async function mockAnonymousAuth(page: import("@playwright/test").Page) {
  await page.route("https://test.supabase.co/auth/v1/**", async (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      access_token: "test-access",
      token_type: "bearer",
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      refresh_token: "test-refresh",
      user: { id: "user-1", aud: "authenticated", role: "authenticated", is_anonymous: true, user_metadata: {}, app_metadata: {} },
    }),
  }));
}

test("shows the four-day starter itinerary", async ({ page, isMobile }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "四个人的小小新加坡" })).toBeVisible();
  await expect(page.getByTestId("day-column")).toHaveCount(4);
  if (isMobile) await page.getByRole("tab", { name: /7月8日 周三/ }).click();
  await expect(page.getByText("Minecraft Experience", { exact: true })).toBeVisible();
  await expect(page.getByText("夜间动物园", { exact: true })).toBeVisible();
});

test("filters cards and opens details", async ({ page, isMobile }) => {
  await page.goto("/");
  if (isMobile) await page.getByRole("button", { name: "卡片库", exact: true }).click();
  await page.getByRole("button", { name: "购物", exact: true }).click();
  await page.getByRole("button", { name: /乌节路购物 120 分钟/ }).click();
  await expect(page.getByRole("complementary", { name: "乌节路购物 详情" })).toBeVisible();
});

test("mobile users can switch to the card library", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile-only behavior");
  await page.goto("/");
  await page.getByRole("button", { name: "卡片库", exact: true }).click();
  await expect(page.getByRole("heading", { name: "还想去哪里？" })).toBeVisible();
  await expect(page.getByRole("button", { name: "新建自定义活动" })).toBeVisible();
});

test("edits a day title and compares transport before opening Maps", async ({ page, isMobile }) => {
  await page.goto("/");
  if (isMobile) await page.getByRole("tab", { name: /7月8日 周三/ }).click();
  await page.getByRole("button", { name: "编辑 Mandai 像素与夜行" }).click();
  const titleInput = page.getByLabel("7月8日标题");
  await titleInput.fill("动物世界日");
  await titleInput.press("Enter");
  await expect(page.getByRole("heading", { name: "动物世界日" })).toBeVisible();

  if (isMobile) await page.getByRole("tab", { name: /7月7日 周二/ }).click();
  await page.getByRole("button", { name: "查看 抵达樟宜机场 到 酒店入住与午休 的交通方案" }).click();
  const dialog = page.getByRole("dialog", { name: "交通方案对比" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "步行" })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "公交 / MRT" })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "打车" })).toBeVisible();
  await expect(dialog.getByRole("link", { name: "步行 Google Maps 查询" })).toHaveAttribute("href", /google\.com\/maps/);
});

test("defers time reordering and updates suggested duration on confirmation", async ({ page, isMobile }) => {
  await page.goto("/");
  if (isMobile) await page.getByRole("tab", { name: /7月8日 周三/ }).click();
  const dayTwo = page.getByTestId("day-column").filter({ hasText: "7月8日" });
  const nightTime = page.getByLabel("夜间动物园 开始时间");
  await nightTime.fill("10:00");
  await expect(dayTwo.locator(".scheduled-card strong").first()).toHaveText("Minecraft Experience");
  await page.getByRole("button", { name: "确认 夜间动物园 开始时间" }).click();
  await expect(dayTwo.locator(".scheduled-card strong").first()).toHaveText("夜间动物园");

  await page.getByText("Minecraft Experience", { exact: true }).click();
  const duration = page.getByLabel("Minecraft Experience 建议时长");
  await duration.fill("90");
  await expect(dayTwo.getByText("— 17:00", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "确认 Minecraft Experience 建议时长" }).click();
  await expect(dayTwo.getByText("— 17:30", { exact: true })).toBeVisible();
});

test("drops a cross-day card before a chosen target", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop pointer drag");
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));
  await page.goto("/");
  const source = page.getByRole("button", { name: "长按拖动 Skyline Luge · 3 Rounds" });
  const target = page.getByRole("button", { name: "长按拖动 Minecraft Experience" });
  await source.dragTo(target, { targetPosition: { x: 8, y: 2 } });

  const dayTwo = page.getByTestId("day-column").filter({ hasText: "7月8日" });
  const titles = await dayTwo.locator(".scheduled-card strong").allTextContents();
  expect(titles.indexOf("Skyline Luge · 3 Rounds")).toBeLessThan(titles.indexOf("Minecraft Experience"));
  expect(pageErrors.map((error) => error.message)).not.toContainEqual(
    expect.stringContaining("Maximum update depth exceeded"),
  );
});

test("resolves a custom location before creating route links", async ({ page, isMobile }) => {
  await page.route("**/api/places?*", async (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ results: [{
      title: "414 GEYLANG ROAD",
      address: "414 GEYLANG ROAD SINGAPORE 389392",
      latitude: 1.312888405679514,
      longitude: 103.8826252657034,
    }] }),
  }));
  await page.goto("/");
  if (isMobile) await page.getByRole("button", { name: "卡片库" }).click();
  await page.getByRole("button", { name: "新建自定义活动" }).click();
  await page.getByLabel("活动名称").fill("No Signboard Seafood");
  await page.getByLabel("地点").fill("414 Geylang Rd Singapore 389392");
  await page.getByRole("button", { name: "保存到卡片库" }).click();
  await page.getByRole("button", { name: "关闭详情" }).click();

  const customCard = page.locator(".candidate-card").filter({ hasText: "No Signboard Seafood" });
  await customCard.getByRole("button", { name: "加入7月7日" }).click();
  if (isMobile) await page.getByRole("button", { name: "每日行程" }).click();
  await page.getByRole("button", { name: "查看 Palm Beach Seafood 到 No Signboard Seafood 的交通方案" }).click();
  await expect(page.getByRole("link", { name: "步行 Google Maps 查询" })).toHaveAttribute(
    "href",
    /destination=1\.312888405679514%2C103\.8826252657034/,
  );
});

test("persists reservation status after reload", async ({ page, isMobile }) => {
  await page.goto("/");
  if (isMobile) await page.getByRole("tab", { name: /7月8日 周三/ }).click();
  const minecraft = page.locator(".scheduled-card").filter({ hasText: "Minecraft Experience" });
  await minecraft.getByRole("button", { name: "标记为已预约" }).click();
  await expect(minecraft.getByRole("button", { name: "标记为需预约" })).toBeVisible();
  await page.reload();
  if (isMobile) await page.getByRole("tab", { name: /7月8日 周三/ }).click();
  const reloadedMinecraft = page.locator(".scheduled-card").filter({ hasText: "Minecraft Experience" });
  await expect(reloadedMinecraft.getByRole("button", { name: "标记为需预约" })).toBeVisible();
});

test("migrates an edited local itinerary and opens it on a second device", async ({ page, browser, isMobile }) => {
  test.skip(isMobile, "desktop creates the private trip for this scenario");
  await mockAnonymousAuth(page);
  let migratedState: Record<string, unknown> | undefined;
  await page.route("**/api/trips/create", async (route) => {
    const body = route.request().postDataJSON() as { state: Record<string, unknown> };
    migratedState = body.state;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ tripId: "trip-1", token: privateToken, state: body.state }) });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "编辑 Mandai 像素与夜行" }).click();
  await page.getByLabel("7月8日标题").fill("我的动物日");
  await page.getByLabel("7月8日标题").press("Enter");
  await page.reload();
  await page.getByRole("button", { name: "保存当前行程到云端" }).click();

  await expect(page).toHaveURL(new RegExp(`/trip#${privateToken}$`));
  await expect(page.getByText("已同步", { exact: true })).toBeVisible();
  expect((migratedState?.dayTitles as Record<string, string>)["2026-07-08"]).toBe("我的动物日");

  const secondContext = await browser.newContext();
  const phone = await secondContext.newPage();
  await mockAnonymousAuth(phone);
  await phone.route("**/api/trips/join", async (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ tripId: "trip-1", state: migratedState }),
  }));
  await phone.goto(`/trip#${privateToken}`);
  await expect(phone.getByRole("heading", { name: "我的动物日" })).toBeVisible();
  await secondContext.close();
});

test("moves a card across mobile days without horizontal dragging", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile-only movement");
  await page.goto("/");
  await page.getByRole("tab", { name: /7月9日 周四 7项/ }).click();
  await expect(page.getByTestId("day-column").filter({ hasText: "7月9日" })).toBeVisible();
  await page.getByRole("button", { name: "移动 Skyline Luge · 3 Rounds 到其他日期" }).click();
  await page.getByRole("button", { name: "7月8日" }).click();
  await page.getByLabel("新的开始时间").fill("10:00");
  await page.getByRole("button", { name: "确认移动" }).click();
  await expect(page.getByRole("tab", { name: /7月8日 周三 4项/ })).toHaveAttribute("aria-selected", "true");
  const visibleDay = page.getByTestId("day-column").filter({ hasText: "7月8日" });
  const movedCard = visibleDay.locator(".scheduled-card").filter({ hasText: "Skyline Luge · 3 Rounds" });
  await expect(movedCard.getByText("Skyline Luge · 3 Rounds", { exact: true })).toBeVisible();
  await expect(movedCard).toBeFocused();
  await expect(visibleDay.locator(".scheduled-card strong").first()).toHaveText("Skyline Luge · 3 Rounds");
});

test("long-presses a mobile drag handle to reorder within one day", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile touch gesture");
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));
  await page.goto("/");
  await page.getByRole("tab", { name: /7月8日 周三/ }).click();
  const source = page.getByRole("button", { name: "长按拖动 Mandai 园区晚餐" });
  const target = page.getByRole("button", { name: "长按拖动 Minecraft Experience" });
  await source.scrollIntoViewIfNeeded();
  const sourceBox = await source.boundingBox();
  const targetBox = await target.locator("xpath=ancestor::article").boundingBox();
  expect(sourceBox).not.toBeNull();
  expect(targetBox).not.toBeNull();
  const start = { x: sourceBox!.x + sourceBox!.width / 2, y: sourceBox!.y + sourceBox!.height / 2 };
  const end = { x: targetBox!.x + targetBox!.width / 2, y: targetBox!.y + 2 };
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [start] });
  await page.waitForTimeout(300);
  await expect(page.locator(".drag-overlay-card")).toBeVisible();
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [end] });
  await page.waitForTimeout(100);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });

  const visibleDay = page.getByTestId("day-column").filter({ hasText: "7月8日" });
  await expect(visibleDay.locator(".scheduled-card strong").first()).toHaveText("Mandai 园区晚餐");
  expect(pageErrors.map((error) => error.message)).not.toContainEqual(expect.stringContaining("Maximum update depth exceeded"));
});
