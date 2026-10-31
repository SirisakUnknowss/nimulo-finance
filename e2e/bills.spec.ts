import { test, expect, type Page } from "@playwright/test";

/**
 * Bills & Fixed Costs, end to end: create a rule, see the generated bill, pay
 * it in two parts from two accounts, then reload and confirm balances held.
 */

const KEY = "mono-finance-demo-v1";

async function seed(page: Page) {
  await page.goto("/settings");
  await page.evaluate((key) => {
    const account = (id: string, name: string, type: string, openingBalance: number) => ({
      id, userId: "demo-user", name, type, currency: "THB", openingBalance, openingDate: "2026-01-01", archived: false, createdAt: "2026-01-01",
    });
    window.localStorage.setItem(key, JSON.stringify({
      profile: { id: "demo-user", displayName: "E2E", baseCurrency: "THB", timezone: "Asia/Bangkok", theme: "system" },
      accounts: [account("acc_a", "บัญชี A", "bank", 20000), account("acc_b", "บัญชี B", "bank", 15000)],
      categories: [{ id: "cat_car", userId: "demo-user", name: "รถยนต์", kind: "expense", color: "#000", archived: false }],
      transactions: [], recurringTemplates: [], budgets: [], goals: [], goalContributions: [],
      loans: [], loanPayments: [], portfolios: [], holdings: [], trades: [], snapshots: [],
    }));
  }, KEY);
  await page.goto("/bills");
}

async function addRule(page: Page, name: string, amount: string) {
  await page.getByRole("button", { name: "รายการประจำ", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("ชื่อรายการ").fill(name);
  await dialog.getByLabel("ยอดต่อเดือน (บาท)").fill(amount);
  await dialog.getByLabel("วันที่ (1-31)").fill("28");
  await dialog.getByLabel("หมวดหมู่").selectOption({ label: "รถยนต์" });
  await dialog.getByLabel("บัญชีที่ตั้งใจจ่าย (ไม่บังคับ)").selectOption({ label: "บัญชี A" });
  await dialog.getByRole("button", { name: "บันทึก" }).click();
  await expect(dialog).toBeHidden();
}

async function pay(page: Page, amount: string, account: string) {
  await page.getByTestId("bill-row").getByRole("button", { name: "บันทึกชำระ" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("จำนวนที่ชำระ").fill(amount);
  const option = dialog.getByLabel("จ่ายจากบัญชี").locator("option", { hasText: account });
  await dialog.getByLabel("จ่ายจากบัญชี").selectOption((await option.getAttribute("value"))!);
  await dialog.getByRole("button", { name: "ยืนยันการชำระ" }).click();
  await expect(dialog).toBeHidden();
}

const balanceOf = (page: Page, name: string) => page.evaluate(([key, accountName]) => {
  const data = JSON.parse(window.localStorage.getItem(key)!);
  const account = data.accounts.find((a: { name: string }) => a.name === accountName);
  return data.transactions
    .filter((t: { accountId: string }) => t.accountId === account.id)
    .reduce((sum: number, t: { amount: number }) => sum - t.amount, account.openingBalance);
}, [KEY, name]);

test("rule to bill to partial payments to fully paid, surviving a reload", async ({ page }) => {
  await seed(page);
  await addRule(page, "งวดรถ", "6000");

  const row = page.getByTestId("bill-row");
  await expect(row).toContainText("งวดรถ");
  await expect(row).toContainText("ยังไม่จ่าย");
  expect(await balanceOf(page, "บัญชี A")).toBe(20000); // a bill alone moves no money

  await pay(page, "2000", "บัญชี A");
  await expect(row).toContainText("จ่ายบางส่วน");
  await expect(row).toContainText("฿4,000.00");

  await pay(page, "4000", "บัญชี B");
  await expect(row).toContainText("จ่ายครบ");
  await expect(row.getByRole("button", { name: "บันทึกชำระ" })).toHaveCount(0);

  await expect.poll(() => balanceOf(page, "บัญชี B")).toBe(11000);
  await page.reload();
  await expect(page.getByTestId("bill-row")).toHaveCount(1);
  await expect(page.getByTestId("bill-row")).toContainText("จ่ายครบ");
  expect(await balanceOf(page, "บัญชี A")).toBe(18000);
  expect(await balanceOf(page, "บัญชี B")).toBe(11000);
});

test("reversing a payment reopens the bill and locks ledger rows from direct delete", async ({ page }) => {
  await seed(page);
  await addRule(page, "ค่าเน็ต", "1500");
  await pay(page, "1500", "บัญชี A");

  await page.getByRole("tab", { name: "ประวัติการชำระ" }).click();
  await page.getByRole("button", { name: "ย้อนรายการ" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("เหตุผล").fill("กดผิด");
  await dialog.getByRole("button", { name: "ย้อนรายการ" }).click();
  await expect(page.getByTestId("payment-row")).toContainText("ย้อนแล้ว: กดผิด");

  await page.getByRole("tab", { name: "บิลเดือนนี้" }).click();
  await expect(page.getByTestId("bill-row")).toContainText("ยังไม่จ่าย");

  await page.getByRole("link", { name: "รายการเงิน" }).first().click();
  await expect(page.getByRole("button", { name: "ลบรายการ" })).toHaveCount(0);
});

test("a one-month amount change leaves the rule alone", async ({ page }) => {
  await seed(page);
  await addRule(page, "ค่าเน็ต", "1500");
  await page.getByRole("button", { name: "แก้ไข ค่าเน็ต" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("ยอดเดือนนี้").fill("1650");
  await dialog.getByRole("button", { name: "บันทึก" }).click();
  await expect(page.getByTestId("bill-row")).toContainText("฿1,650.00");

  await page.getByRole("button", { name: "เดือนถัดไป" }).click();
  await expect(page.getByTestId("bill-row")).toContainText("฿1,500.00");
});

test("works at phone width with no sideways scroll", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await seed(page);
  await addRule(page, "งวดรถ", "9200");
  await expect(page.getByTestId("bill-row")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
