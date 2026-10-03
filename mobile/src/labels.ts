import type { AccountType } from "@/lib/finance/types";

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  cash: "เงินสด",
  bank: "บัญชีธนาคาร",
  e_wallet: "กระเป๋าเงินอิเล็กทรอนิกส์",
  investment_cash: "เงินสดในพอร์ตลงทุน",
  credit_card: "บัตรเครดิต",
};
