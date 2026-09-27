import { test, expect } from "@playwright/test";

/**
 * Critical end-to-end workflows for nimulo., run against demo mode
 * (no Supabase credentials required - the app auto-detects missing env
 * vars and serves the seeded, localStorage-backed demo dataset).
 */

test.beforeEach(async ({ page }) => {
  // Start each test from a clean demo dataset so tests do not interfere
  // with each other via shared localStorage.
  await page.goto("/overview");
  await page.evaluate(() => window.localStorage.removeItem("mono-finance-demo-v1"));
  await page.reload();
});

test("enters demo mode and shows the Overview dashboard with seeded data", async ({ page }) => {
  await page.goto("/overview");
  await expect(page.getByRole("heading", { name: "ภาพรวม" })).toBeVisible();
  await expect(page.getByText("ทรัพย์สินสุทธิ")).toBeVisible();
  // Seeded demo accounts should be visible in the accounts summary card.
  await expect(page.getByText("บัญชีออมทรัพย์ (SCB)")).toBeVisible();
});

test("adds a new expense transaction via the quick-add dialog", async ({ page }) => {
  await page.goto("/overview");
  await page.getByRole("button", { name: "เพิ่มรายการ" }).click();
  await page.getByPlaceholder("0.00").fill("250");
  // Category select is the second <select> in the expense tab (after account select).
  const selects = page.locator("form select");
  await selects.nth(1).selectOption({ label: "อาหาร" });
  await page.getByPlaceholder("เช่น ร้านอาหาร, บริษัท ABC").fill("ร้านทดสอบ Playwright");
  await page.getByRole("button", { name: "บันทึก" }).click();

  await page.goto("/transactions");
  await expect(page.getByText("ร้านทดสอบ Playwright")).toBeVisible();
});

test("creates a transfer between two accounts", async ({ page }) => {
  await page.goto("/accounts");
  await page.getByRole("button", { name: "โอนเงิน" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.locator('input[type="number"]').fill("1500");
  await dialog.getByRole("button", { name: "โอนเงิน", exact: true }).click();

  await page.goto("/transactions");
  await page.locator("select").first().selectOption("transfer");
  await expect(page.locator("table").getByText("โอนเงิน").first()).toBeVisible();
});

test("creates a monthly budget for a category", async ({ page }) => {
  await page.goto("/budgets");
  await page.getByRole("button", { name: "เพิ่มงบประมาณ" }).first().click();
  const dialog = page.getByRole("dialog");
  const categorySelect = dialog.locator("select").first();
  const options = await categorySelect.locator("option").allTextContents();
  const targetOption = options.find((o) => o !== "เลือกหมวดหมู่");
  if (targetOption) {
    await categorySelect.selectOption({ label: targetOption });
  }
  await dialog.locator('input[type="number"]').fill("3000");
  await dialog.getByRole("button", { name: "บันทึก" }).click();
  await expect(page.getByText("3,000.00").first()).toBeVisible();
});

test("creates a goal and records a contribution to it", async ({ page }) => {
  await page.goto("/goals");
  await page.getByRole("button", { name: "เพิ่มเป้าหมาย" }).first().click();
  const createDialog = page.getByRole("dialog");
  await createDialog.locator("input").first().fill("กองทุนทดสอบ E2E");
  await createDialog.locator('input[type="number"]').fill("20000");
  await createDialog.getByRole("button", { name: "บันทึก" }).click();

  await expect(page.getByText("กองทุนทดสอบ E2E")).toBeVisible();

  const card = page
    .locator("div")
    .filter({ hasText: "กองทุนทดสอบ E2E" })
    .filter({ has: page.getByRole("button", { name: "สมทบเงิน" }) })
    .last();
  await card.getByRole("button", { name: "สมทบเงิน" }).click();
  const contribDialog = page.getByRole("dialog");
  await contribDialog.locator('input[type="number"]').fill("2000");
  await contribDialog.getByRole("button", { name: "บันทึก" }).click();

  await expect(page.getByText("2,000.00").first()).toBeVisible();
});

test("views the Reports page with monthly cash flow and category charts", async ({ page }) => {
  await page.goto("/reports");
  await expect(page.getByRole("heading", { name: "รายงานการเงิน" })).toBeVisible();
  await expect(page.getByText("สรุปเงินเข้า-เงินออกรายเดือน")).toBeVisible();
  await expect(page.getByText("งบประมาณเทียบกับยอดใช้จริง (เดือนนี้)")).toBeVisible();
});
