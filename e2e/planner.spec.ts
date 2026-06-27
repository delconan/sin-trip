import { expect, test } from "@playwright/test";

test("shows the four-day starter itinerary", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "四个人的小小新加坡" })).toBeVisible();
  await expect(page.getByTestId("day-column")).toHaveCount(4);
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

test("edits a day title and compares transport before opening Maps", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "编辑 Mandai 像素与夜行" }).click();
  const titleInput = page.getByLabel("7月8日标题");
  await titleInput.fill("动物世界日");
  await titleInput.press("Enter");
  await expect(page.getByRole("heading", { name: "动物世界日" })).toBeVisible();

  await page.getByRole("button", { name: "查看 抵达樟宜机场 到 酒店入住与午休 的交通方案" }).click();
  const dialog = page.getByRole("dialog", { name: "交通方案对比" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "步行" })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "公交 / MRT" })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "打车" })).toBeVisible();
  await expect(dialog.getByRole("link", { name: "步行 Google Maps 查询" })).toHaveAttribute("href", /google\.com\/maps/);
});
