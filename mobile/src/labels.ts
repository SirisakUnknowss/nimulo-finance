import type { AccountType, GoalType } from "@/lib/finance/types";

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  cash: "เงินสด",
  bank: "บัญชีธนาคาร",
  e_wallet: "กระเป๋าเงินอิเล็กทรอนิกส์",
  investment_cash: "เงินสดในพอร์ตลงทุน",
  credit_card: "บัตรเครดิต",
};

export const GOAL_TYPE_LABELS: Record<GoalType, string> = {
  emergency_fund: "กองทุนฉุกเฉิน",
  travel: "ท่องเที่ยว",
  vehicle: "ยานพาหนะ",
  home: "บ้าน",
  custom: "กำหนดเอง",
};
