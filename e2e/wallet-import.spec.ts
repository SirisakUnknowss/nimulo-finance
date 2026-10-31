import { test, expect } from "@playwright/test";
import { strToU8, zipSync } from "fflate";

/** Previews a Wallet Story export, imports it, then confirms a repeat adds nothing. */

const buffer = Buffer.from(zipSync({
  "x-Transactions.csv": strToU8(
    'DATE,CATEGORY,AMOUNT,CURRENCY,NOTE,SUB_CATEGORY,TAG,BANK_ACCOUNT\n' +
    '"2026-03-01 09:00:00","Food","-100","THB","","ร้านข้าว","","บัญชีนำเข้า"\n' +
    '"2026-03-02 09:00:00","Transfer","50","THB","","","","บัญชีนำเข้า"',
  ),
  "x-Bank account.csv": strToU8('NAME,BALANCE,CURRENCY,NOTE\n"บัญชีนำเข้า","1234.50","",""'),
}));

test("imports an export after a preview, and only once", async ({ page }) => {
  await page.goto("/transactions");
  const importFile = async () => {
    await page.getByRole("button", { name: "นำเข้าจาก Wallet Story" }).click();
    await page.getByLabel("ไฟล์ส่งออก").setInputFiles({ name: "wallet.zip", mimeType: "application/zip", buffer });
    await expect(page.getByTestId("import-summary")).toBeVisible();
    return page.getByRole("dialog");
  };

  const dialog = await importFile();
  await expect(dialog).toContainText("฿1,234.50");
  await expect(dialog).toContainText("รายการโอนที่ไฟล์ไม่บอกบัญชีปลายทาง");
  await dialog.getByRole("button", { name: "นำเข้า 1 รายการ" }).click();
  await dialog.getByRole("button", { name: "ปิด", exact: true }).first().click();
  await expect(page.locator("table").getByText("ร้านข้าว")).toBeVisible();

  await page.goto("/accounts");
  await expect(page.getByText("฿1,234.50").first()).toBeVisible();

  await page.goto("/transactions");
  const again = await importFile();
  await expect(again.getByRole("button", { name: /^นำเข้า/ })).toBeDisabled();
  await expect(again).toContainText("เคยนำเข้าแล้ว");
});
