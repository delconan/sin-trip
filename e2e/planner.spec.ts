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
