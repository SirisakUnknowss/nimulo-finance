import { z } from "zod";

/**
 * Zod validation schemas for all user-writable records. These are used
 * both by client forms (for inline Thai-language error messages) and are
 * intended to be reused server-side by Supabase Route Handlers/Server
 * Actions before any insert/update, so invalid data never reaches the
 * database regardless of which data layer (demo or Supabase) is active.
 */

export const accountTypeSchema = z.enum(["cash", "bank", "e_wallet", "investment_cash", "credit_card"]);

export const accountSchema = z.object({
  name: z.string().trim().min(1, "กรุณาระบุชื่อบัญชี"),
  type: accountTypeSchema,
  currency: z.string().min(3).max(3).default("THB"),
  openingBalance: z.number().finite("จำนวนเงินไม่ถูกต้อง"),
  openingDate: z.string().min(1, "กรุณาระบุวันที่"),
  creditLimit: z.number().nonnegative().nullable().optional(),
});

export const transactionTypeSchema = z.enum(["income", "expense", "transfer"]);

export const transactionSchema = z
  .object({
    type: transactionTypeSchema,
    amount: z.number().positive("จำนวนเงินต้องมากกว่า 0"),
    date: z.string().min(1, "กรุณาระบุวันที่"),
    accountId: z.string().min(1, "กรุณาเลือกบัญชี"),
    toAccountId: z.string().nullable().optional(),
    categoryId: z.string().nullable().optional(),
    merchant: z.string().nullable().optional(),
    note: z.string().nullable().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.type === "transfer" && !val.toAccountId) {
      ctx.addIssue({ code: "custom", message: "กรุณาเลือกบัญชีปลายทาง", path: ["toAccountId"] });
    }
    if (val.type === "transfer" && val.toAccountId === val.accountId) {
      ctx.addIssue({ code: "custom", message: "บัญชีต้นทางและปลายทางต้องต่างกัน", path: ["toAccountId"] });
    }
    if (val.type !== "transfer" && !val.categoryId) {
      ctx.addIssue({ code: "custom", message: "กรุณาเลือกหมวดหมู่", path: ["categoryId"] });
    }
  });

export const budgetSchema = z.object({
  categoryId: z.string().min(1, "กรุณาเลือกหมวดหมู่"),
  period: z.string().regex(/^\d{4}-\d{2}$/, "รูปแบบเดือนไม่ถูกต้อง"),
  limit: z.number().nonnegative("วงเงินต้องไม่ติดลบ"),
});

export const goalSchema = z.object({
  title: z.string().trim().min(1, "กรุณาระบุชื่อเป้าหมาย"),
  type: z.enum(["emergency_fund", "travel", "vehicle", "home", "custom"]),
  targetAmount: z.number().positive("เป้าหมายต้องมากกว่า 0"),
  targetDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const goalContributionSchema = z.object({
  goalId: z.string().min(1),
  amount: z.number().refine((v) => v !== 0, "จำนวนเงินต้องไม่เป็นศูนย์"),
  date: z.string().min(1, "กรุณาระบุวันที่"),
  accountId: z.string().nullable().optional(),
});

export const loanPaymentSchema = z.object({
  loanAccountId: z.string().min(1),
  date: z.string().min(1, "กรุณาระบุวันที่"),
  principalAmount: z.number().nonnegative(),
  interestAmount: z.number().nonnegative(),
});

export const holdingSchema = z.object({
  portfolioId: z.string().min(1),
  symbol: z.string().trim().min(1, "กรุณาระบุสัญลักษณ์"),
  name: z.string().trim().min(1),
  assetType: z.enum(["stock", "etf", "mutual_fund", "other"]),
  quantity: z.number().nonnegative(),
  avgCost: z.number().nonnegative(),
  currency: z.string().min(3).max(3),
  latestPrice: z.number().nonnegative(),
  latestPriceDate: z.string().min(1),
  fxRateToBase: z.number().positive().nullable().optional(),
  fxRateDate: z.string().nullable().optional(),
});

export const cashflowKindSchema = z.enum(["expense", "loan_payment", "credit_card_payment", "transfer", "saving", "investment"]);

const periodSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "รูปแบบเดือนไม่ถูกต้อง");

const billClassification = {
  cashflowKind: cashflowKindSchema,
  categoryId: z.string().nullable().optional(),
  targetAccountId: z.string().nullable().optional(),
  loanAccountId: z.string().nullable().optional(),
  sourceAccountId: z.string().nullable().optional(),
};

/** Which linked records each kind needs in order to post correctly when paid. */
function refineBillClassification(val: z.infer<z.ZodObject<typeof billClassification>>, ctx: z.RefinementCtx) {
  if (val.cashflowKind === "expense" && !val.categoryId) {
    ctx.addIssue({ code: "custom", message: "กรุณาเลือกหมวดหมู่", path: ["categoryId"] });
  }
  if (val.cashflowKind === "loan_payment" && !val.loanAccountId) {
    ctx.addIssue({ code: "custom", message: "กรุณาเลือกสินเชื่อ", path: ["loanAccountId"] });
  }
  if (["credit_card_payment", "transfer", "saving", "investment"].includes(val.cashflowKind)) {
    if (!val.targetAccountId) {
      ctx.addIssue({ code: "custom", message: "กรุณาเลือกบัญชีปลายทาง", path: ["targetAccountId"] });
    } else if (val.targetAccountId === val.sourceAccountId) {
      ctx.addIssue({ code: "custom", message: "บัญชีต้นทางและปลายทางต้องต่างกัน", path: ["targetAccountId"] });
    }
  }
}

export const fixedCostRuleSchema = z
  .object({
    name: z.string().trim().min(1, "กรุณาระบุชื่อรายการ"),
    amount: z.number().nonnegative("จำนวนเงินต้องไม่ติดลบ"),
    amountMode: z.enum(["fixed", "estimate"]),
    dueRule: z.enum(["day_of_month", "last_day"]),
    dueDay: z.number().int().min(1, "วันครบกำหนดต้องอยู่ระหว่าง 1-31").max(31, "วันครบกำหนดต้องอยู่ระหว่าง 1-31").nullable(),
    startMonth: periodSchema,
    endMonth: periodSchema.nullable().optional(),
    ...billClassification,
  })
  .superRefine((val, ctx) => {
    refineBillClassification(val, ctx);
    if (val.dueRule === "day_of_month" && val.dueDay === null) {
      ctx.addIssue({ code: "custom", message: "กรุณาระบุวันครบกำหนด", path: ["dueDay"] });
    }
    if (val.endMonth && val.endMonth < val.startMonth) {
      ctx.addIssue({ code: "custom", message: "เดือนสิ้นสุดต้องไม่ก่อนเดือนเริ่มต้น", path: ["endMonth"] });
    }
  });

export const oneTimeBillSchema = z
  .object({
    name: z.string().trim().min(1, "กรุณาระบุชื่อรายการ"),
    amount: z.number().positive("จำนวนเงินต้องมากกว่า 0"),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "กรุณาระบุวันครบกำหนด"),
    ...billClassification,
  })
  .superRefine(refineBillClassification);
