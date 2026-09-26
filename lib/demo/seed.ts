import type {
  Account,
  Budget,
  Category,
  Goal,
  GoalContribution,
  Holding,
  InvestmentTrade,
  LoanAccount,
  LoanPayment,
  Portfolio,
  PortfolioSnapshot,
  Profile,
  RecurringTemplate,
  Transaction,
} from "@/lib/finance/types";
import { uid } from "@/lib/utils";

export interface DemoData {
  profile: Profile;
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  recurringTemplates: RecurringTemplate[];
  budgets: Budget[];
  goals: Goal[];
  goalContributions: GoalContribution[];
  loans: LoanAccount[];
  loanPayments: LoanPayment[];
  portfolios: Portfolio[];
  holdings: Holding[];
  trades: InvestmentTrade[];
  snapshots: PortfolioSnapshot[];
}

const USER = "demo-user";

function isoMonthsAgo(monthsAgo: number, day: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - monthsAgo, day);
  return d.toISOString().slice(0, 10);
}

export function buildDemoData(): DemoData {
  const profile: Profile = {
    id: USER,
    displayName: "คุณสิริศักดิ์",
    baseCurrency: "THB",
    timezone: "Asia/Bangkok",
    theme: "system",
  };

  const accounts: Account[] = [
    { id: "acc_bank_main", userId: USER, name: "บัญชีออมทรัพย์ (SCB)", type: "bank", currency: "THB", openingBalance: 85000, openingDate: isoMonthsAgo(8, 1), archived: false, createdAt: isoMonthsAgo(8, 1) },
    { id: "acc_cash", userId: USER, name: "เงินสด", type: "cash", currency: "THB", openingBalance: 3500, openingDate: isoMonthsAgo(8, 1), archived: false, createdAt: isoMonthsAgo(8, 1) },
    { id: "acc_ewallet", userId: USER, name: "TrueMoney Wallet", type: "e_wallet", currency: "THB", openingBalance: 1200, openingDate: isoMonthsAgo(8, 1), archived: false, createdAt: isoMonthsAgo(8, 1) },
    { id: "acc_invest_cash", userId: USER, name: "เงินสดในพอร์ตลงทุน", type: "investment_cash", currency: "THB", openingBalance: 20000, openingDate: isoMonthsAgo(8, 1), archived: false, createdAt: isoMonthsAgo(8, 1) },
    { id: "acc_cc", userId: USER, name: "บัตรเครดิต KTC", type: "credit_card", currency: "THB", openingBalance: 0, openingDate: isoMonthsAgo(8, 1), creditLimit: 80000, archived: false, createdAt: isoMonthsAgo(8, 1) },
  ];

  const categories: Category[] = [
    { id: "cat_salary", userId: USER, name: "เงินเดือน", kind: "income", color: "#467A64", archived: false },
    { id: "cat_freelance", userId: USER, name: "รายได้เสริม", kind: "income", color: "#6FA88A", archived: false },
    { id: "cat_food", userId: USER, name: "อาหาร", kind: "expense", color: "#C97B4A", archived: false },
    { id: "cat_transport", userId: USER, name: "เดินทาง", kind: "expense", color: "#5A7FB0", archived: false },
    { id: "cat_utilities", userId: USER, name: "ค่าสาธารณูปโภค", kind: "expense", color: "#B0745A", archived: false },
    { id: "cat_shopping", userId: USER, name: "ช้อปปิ้ง", kind: "expense", color: "#A0699E", archived: false },
    { id: "cat_entertainment", userId: USER, name: "บันเทิง", kind: "expense", color: "#C9A24A", archived: false },
    { id: "cat_health", userId: USER, name: "สุขภาพ", kind: "expense", color: "#4AA0A0", archived: false },
    { id: "cat_rent", userId: USER, name: "ค่าเช่า/ผ่อนบ้าน", kind: "expense", color: "#8A6D4A", archived: false },
    { id: "cat_interest", userId: USER, name: "ดอกเบี้ยเงินกู้", kind: "expense", color: "#9A4A4A", archived: false },
    { id: "cat_other_expense", userId: USER, name: "อื่นๆ", kind: "expense", color: "#777F79", archived: false },
  ];

  const transactions: Transaction[] = [];
  const pushTx = (t: Omit<Transaction, "id" | "userId" | "tags" | "createdAt">) =>
    transactions.push({ id: uid("tx"), userId: USER, tags: [], createdAt: t.date, ...t });

  // 8 months of recurring salary + rent + utilities + varied expenses
  for (let m = 7; m >= 0; m--) {
    pushTx({ type: "income", amount: 45000, date: isoMonthsAgo(m, 25), accountId: "acc_bank_main", categoryId: "cat_salary", merchant: "บริษัท ABC จำกัด" });
    if (m % 2 === 0) {
      pushTx({ type: "income", amount: 6000 + m * 200, date: isoMonthsAgo(m, 18), accountId: "acc_bank_main", categoryId: "cat_freelance", merchant: "งานฟรีแลนซ์" });
    }
    pushTx({ type: "expense", amount: 12000, date: isoMonthsAgo(m, 1), accountId: "acc_bank_main", categoryId: "cat_rent", merchant: "ค่าเช่าคอนโด" });
    pushTx({ type: "expense", amount: 1800 + (m % 3) * 150, date: isoMonthsAgo(m, 5), accountId: "acc_bank_main", categoryId: "cat_utilities", merchant: "การไฟฟ้า/ประปา" });
    pushTx({ type: "expense", amount: 3200 + (m % 4) * 400, date: isoMonthsAgo(m, 8), accountId: "acc_cc", categoryId: "cat_food", merchant: "ร้านอาหาร/ซูเปอร์มาร์เก็ต" });
    pushTx({ type: "expense", amount: 900 + (m % 2) * 300, date: isoMonthsAgo(m, 12), accountId: "acc_cash", categoryId: "cat_transport", merchant: "BTS/แท็กซี่" });
    pushTx({ type: "expense", amount: 1500, date: isoMonthsAgo(m, 15), accountId: "acc_cc", categoryId: "cat_shopping", merchant: "ช้อปปิ้งออนไลน์" });
    pushTx({ type: "expense", amount: 600, date: isoMonthsAgo(m, 20), accountId: "acc_ewallet", categoryId: "cat_entertainment", merchant: "Netflix/สตรีมมิ่ง" });
    if (m % 3 === 0) {
      pushTx({ type: "expense", amount: 1200, date: isoMonthsAgo(m, 22), accountId: "acc_bank_main", categoryId: "cat_health", merchant: "คลินิก" });
    }
    // credit card bill payment (transfer, not expense) - pays previous statement
    pushTx({ type: "transfer", amount: 3200 + ((m + 1) % 4) * 400, date: isoMonthsAgo(m, 28), accountId: "acc_bank_main", toAccountId: "acc_cc", note: "ชำระบัตรเครดิต" });
  }

  // A couple of ad-hoc internal transfers (e.g. topping up e-wallet)
  pushTx({ type: "transfer", amount: 2000, date: isoMonthsAgo(1, 3), accountId: "acc_bank_main", toAccountId: "acc_ewallet", note: "เติมเงิน wallet" });
  pushTx({ type: "transfer", amount: 5000, date: isoMonthsAgo(2, 10), accountId: "acc_bank_main", toAccountId: "acc_invest_cash", note: "โอนเข้าพอร์ตลงทุน" });

  const recurringTemplates: RecurringTemplate[] = [
    { id: "rec_salary", userId: USER, type: "income", amount: 45000, accountId: "acc_bank_main", categoryId: "cat_salary", merchant: "บริษัท ABC จำกัด", frequency: "monthly", dayOfMonth: 25, startDate: isoMonthsAgo(8, 25), lastPostedPeriod: null, active: true },
    { id: "rec_rent", userId: USER, type: "expense", amount: 12000, accountId: "acc_bank_main", categoryId: "cat_rent", merchant: "ค่าเช่าคอนโด", frequency: "monthly", dayOfMonth: 1, startDate: isoMonthsAgo(8, 1), lastPostedPeriod: null, active: true },
  ];

  const currentPeriodStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const budgets: Budget[] = [
    { id: uid("bud"), userId: USER, categoryId: "cat_food", period: currentPeriodStr, limit: 6000 },
    { id: uid("bud"), userId: USER, categoryId: "cat_transport", period: currentPeriodStr, limit: 2000 },
    { id: uid("bud"), userId: USER, categoryId: "cat_shopping", period: currentPeriodStr, limit: 2500 },
    { id: uid("bud"), userId: USER, categoryId: "cat_entertainment", period: currentPeriodStr, limit: 800 },
    { id: uid("bud"), userId: USER, categoryId: "cat_utilities", period: currentPeriodStr, limit: 2200 },
  ];

  const goals: Goal[] = [
    { id: "goal_emergency", userId: USER, title: "กองทุนฉุกเฉิน", type: "emergency_fund", targetAmount: 100000, targetDate: null, notes: "เผื่อไว้ 6 เดือนของค่าใช้จ่าย", archived: false, createdAt: isoMonthsAgo(8, 1) },
    { id: "goal_travel", userId: USER, title: "เที่ยวญี่ปุ่น", type: "travel", targetAmount: 60000, targetDate: isoMonthsAgo(-6, 1), notes: null, archived: false, createdAt: isoMonthsAgo(6, 1) },
  ];

  const goalContributions: GoalContribution[] = [
    { id: uid("gc"), goalId: "goal_emergency", userId: USER, amount: 15000, date: isoMonthsAgo(7, 5), accountId: "acc_bank_main" },
    { id: uid("gc"), goalId: "goal_emergency", userId: USER, amount: 8000, date: isoMonthsAgo(5, 5), accountId: "acc_bank_main" },
    { id: uid("gc"), goalId: "goal_emergency", userId: USER, amount: 10000, date: isoMonthsAgo(3, 5), accountId: "acc_bank_main" },
    { id: uid("gc"), goalId: "goal_emergency", userId: USER, amount: 9000, date: isoMonthsAgo(1, 5), accountId: "acc_bank_main" },
    { id: uid("gc"), goalId: "goal_travel", userId: USER, amount: 5000, date: isoMonthsAgo(4, 10), accountId: "acc_bank_main" },
    { id: uid("gc"), goalId: "goal_travel", userId: USER, amount: 7000, date: isoMonthsAgo(2, 10), accountId: "acc_bank_main" },
    { id: uid("gc"), goalId: "goal_travel", userId: USER, amount: 6000, date: isoMonthsAgo(1, 10), accountId: "acc_bank_main" },
  ];

  const loans: LoanAccount[] = [
    { id: "loan_car", userId: USER, accountId: null, name: "สินเชื่อรถยนต์", kind: "installment_loan", openingPrincipal: 450000, interestRate: 3.5, minimumPayment: 8500, dueDayOfMonth: 5, startDate: isoMonthsAgo(20, 5), archived: false },
    { id: "loan_cc", userId: USER, accountId: "acc_cc", name: "บัตรเครดิต KTC", kind: "credit_card", openingPrincipal: 0, interestRate: 18, minimumPayment: null, dueDayOfMonth: 28, startDate: isoMonthsAgo(8, 1), archived: false },
  ];

  const loanPayments: LoanPayment[] = [];
  for (let m = 7; m >= 0; m--) {
    loanPayments.push({ id: uid("lp"), loanAccountId: "loan_car", userId: USER, date: isoMonthsAgo(m, 5), principalAmount: 7900 + m * 5, interestAmount: 600 - m * 5 });
    pushTx({ type: "expense", amount: 600 - m * 5, date: isoMonthsAgo(m, 5), accountId: "acc_bank_main", categoryId: "cat_interest", merchant: "ดอกเบี้ยสินเชื่อรถยนต์" });
    pushTx({ type: "transfer", amount: 7900 + m * 5, date: isoMonthsAgo(m, 5), accountId: "acc_bank_main", toAccountId: "acc_bank_main", note: "ผ่อนรถ (เงินต้น)", isLoanPrincipalRepayment: true, loanAccountId: "loan_car" });
  }

  const portfolios: Portfolio[] = [
    { id: "port_main", userId: USER, name: "พอร์ตหุ้นหลัก", currency: "THB", cashAccountId: "acc_invest_cash" },
  ];

  const holdings: Holding[] = [
    { id: "hold_ptt", portfolioId: "port_main", userId: USER, symbol: "PTT", name: "PTT PLC", assetType: "stock", quantity: 500, avgCost: 32.5, currency: "THB", latestPrice: 34.75, latestPriceDate: isoMonthsAgo(0, 1), fxRateToBase: null, fxRateDate: null },
    { id: "hold_scb", portfolioId: "port_main", userId: USER, symbol: "SCB", name: "SCB X", assetType: "stock", quantity: 200, avgCost: 108, currency: "THB", latestPrice: 115.5, latestPriceDate: isoMonthsAgo(0, 1), fxRateToBase: null, fxRateDate: null },
    { id: "hold_kfsdiv", portfolioId: "port_main", userId: USER, symbol: "KFSDIV", name: "K Strategic Dividend Fund", assetType: "mutual_fund", quantity: 1500, avgCost: 12.1, currency: "THB", latestPrice: 12.85, latestPriceDate: isoMonthsAgo(0, 3), fxRateToBase: null, fxRateDate: null },
    { id: "hold_aapl", portfolioId: "port_main", userId: USER, symbol: "AAPL", name: "Apple Inc.", assetType: "stock", quantity: 15, avgCost: 165, currency: "USD", latestPrice: 192.3, latestPriceDate: isoMonthsAgo(0, 2), fxRateToBase: 36.2, fxRateDate: isoMonthsAgo(0, 2) },
  ];

  const trades: InvestmentTrade[] = [
    { id: uid("trd"), holdingId: "hold_ptt", userId: USER, type: "buy", quantity: 500, price: 32.5, amount: 16250, date: isoMonthsAgo(6, 4) },
    { id: uid("trd"), holdingId: "hold_scb", userId: USER, type: "buy", quantity: 200, price: 108, amount: 21600, date: isoMonthsAgo(5, 14) },
    { id: uid("trd"), holdingId: "hold_kfsdiv", userId: USER, type: "buy", quantity: 1500, price: 12.1, amount: 18150, date: isoMonthsAgo(4, 2) },
    { id: uid("trd"), holdingId: "hold_aapl", userId: USER, type: "buy", quantity: 15, price: 165, amount: 15 * 165 * 36.2, date: isoMonthsAgo(3, 8) },
    { id: uid("trd"), holdingId: "hold_ptt", userId: USER, type: "dividend", quantity: 0, price: 0, amount: 750, date: isoMonthsAgo(1, 20) },
  ];

  const snapshots: PortfolioSnapshot[] = [];
  for (let m = 6; m >= 0; m--) {
    const growth = 1 + (6 - m) * 0.015;
    snapshots.push({
      id: uid("snap"),
      portfolioId: "port_main",
      userId: USER,
      date: isoMonthsAgo(m, 28),
      investedCapital: 56000 + (6 - m) * 3000,
      marketValue: Math.round((56000 + (6 - m) * 3000) * growth),
    });
  }

  return {
    profile,
    accounts,
    categories,
    transactions,
    recurringTemplates,
    budgets,
    goals,
    goalContributions,
    loans,
    loanPayments,
    portfolios,
    holdings,
    trades,
    snapshots,
  };
}

/**
 * A blank starting point for onboarding/promo recordings: keeps the profile and
 * default category list (so add-transaction flows aren't awkward), but every
 * account, transaction, budget, goal, loan, and investment starts truly empty.
 */
export function buildEmptyDemoData(): DemoData {
  const seeded = buildDemoData();
  return {
    profile: seeded.profile,
    accounts: [],
    categories: seeded.categories,
    transactions: [],
    recurringTemplates: [],
    budgets: [],
    goals: [],
    goalContributions: [],
    loans: [],
    loanPayments: [],
    portfolios: [],
    holdings: [],
    trades: [],
    snapshots: [],
  };
}
