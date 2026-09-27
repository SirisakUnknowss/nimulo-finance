"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { buildDemoData, buildEmptyDemoData, type DemoData } from "./seed";
import { uid } from "@/lib/utils";
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
  RecurringTemplate,
  Transaction,
} from "@/lib/finance/types";

const STORAGE_KEY = "mono-finance-demo-v1";

function loadInitial(): DemoData {
  if (typeof window === "undefined") return buildDemoData();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as DemoData;
  } catch {
    // ignore corrupt storage, fall through to fresh seed
  }
  const fresh = buildDemoData();
  return fresh;
}

interface DemoStoreApi {
  data: DemoData;
  isDemo: true;
  /** False until the post-mount effect has swapped in any localStorage-persisted data. */
  hydrated: boolean;
  resetDemoData: () => void;
  startEmptyData: () => void;
  addAccount: (a: Omit<Account, "id" | "userId" | "createdAt" | "archived">) => Account;
  updateAccount: (id: string, patch: Partial<Account>) => void;
  archiveAccount: (id: string) => void;
  addCategory: (c: Omit<Category, "id" | "userId" | "archived">) => Category;
  updateCategory: (id: string, patch: Partial<Category>) => void;
  addTransaction: (t: Omit<Transaction, "id" | "userId" | "createdAt" | "tags"> & { tags?: string[] }) => Transaction;
  updateTransaction: (id: string, patch: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;
  addTransfer: (input: { amount: number; date: string; fromAccountId: string; toAccountId: string; note?: string }) => void;
  importTransactions: (txs: Array<Omit<Transaction, "id" | "userId" | "createdAt" | "tags"> & { tags?: string[] }>) => number;
  addRecurringTemplate: (t: Omit<RecurringTemplate, "id" | "userId" | "lastPostedPeriod" | "active">) => RecurringTemplate;
  postRecurring: (templateId: string, date: string) => void;
  upsertBudget: (b: Omit<Budget, "id" | "userId"> & { id?: string }) => void;
  deleteBudget: (id: string) => void;
  addGoal: (g: Omit<Goal, "id" | "userId" | "archived" | "createdAt">) => Goal;
  updateGoal: (id: string, patch: Partial<Goal>) => void;
  archiveGoal: (id: string) => void;
  addGoalContribution: (c: Omit<GoalContribution, "id" | "userId">) => void;
  addLoan: (l: Omit<LoanAccount, "id" | "userId" | "archived">) => LoanAccount;
  addLoanPayment: (p: Omit<LoanPayment, "id" | "userId">) => void;
  addPortfolio: (p: Omit<Portfolio, "id" | "userId">) => Portfolio;
  addHolding: (h: Omit<Holding, "id" | "userId">) => Holding;
  updateHolding: (id: string, patch: Partial<Holding>) => void;
  addTrade: (t: Omit<InvestmentTrade, "id" | "userId">) => void;
  updateProfile: (patch: Partial<DemoData["profile"]>) => void;
}

const DemoStoreContext = createContext<DemoStoreApi | null>(null);

export function DemoStoreProvider({ children }: { children: React.ReactNode }) {
  // Deterministic on both server and the first client render (never reads
  // localStorage here) so hydration matches; the effect below swaps in any
  // persisted data right after mount.
  const [data, setData] = useState<DemoData>(() => buildDemoData());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from localStorage after mount
    setData(loadInitial());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // localStorage may be unavailable (private mode); ignore silently
    }
  }, [data, hydrated]);

  const resetDemoData = useCallback(() => setData(buildDemoData()), []);
  const startEmptyData = useCallback(() => setData(buildEmptyDemoData()), []);

  const addAccount: DemoStoreApi["addAccount"] = useCallback((a) => {
    const account: Account = { ...a, id: uid("acc"), userId: "demo-user", archived: false, createdAt: new Date().toISOString() };
    setData((d) => ({ ...d, accounts: [...d.accounts, account] }));
    return account;
  }, []);

  const updateAccount: DemoStoreApi["updateAccount"] = useCallback((id, patch) => {
    setData((d) => ({ ...d, accounts: d.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)) }));
  }, []);

  const archiveAccount: DemoStoreApi["archiveAccount"] = useCallback((id) => {
    setData((d) => ({ ...d, accounts: d.accounts.map((a) => (a.id === id ? { ...a, archived: true } : a)) }));
  }, []);

  const addCategory: DemoStoreApi["addCategory"] = useCallback((c) => {
    const category: Category = { ...c, id: uid("cat"), userId: "demo-user", archived: false };
    setData((d) => ({ ...d, categories: [...d.categories, category] }));
    return category;
  }, []);

  const updateCategory: DemoStoreApi["updateCategory"] = useCallback((id, patch) => {
    setData((d) => ({ ...d, categories: d.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  }, []);

  const addTransaction: DemoStoreApi["addTransaction"] = useCallback((t) => {
    const transaction: Transaction = {
      ...t,
      id: uid("tx"),
      userId: "demo-user",
      tags: t.tags ?? [],
      createdAt: new Date().toISOString(),
    };
    setData((d) => ({ ...d, transactions: [transaction, ...d.transactions] }));
    return transaction;
  }, []);

  const updateTransaction: DemoStoreApi["updateTransaction"] = useCallback((id, patch) => {
    setData((d) => ({ ...d, transactions: d.transactions.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
  }, []);

  const deleteTransaction: DemoStoreApi["deleteTransaction"] = useCallback((id) => {
    setData((d) => ({ ...d, transactions: d.transactions.filter((t) => t.id !== id) }));
  }, []);

  const addTransfer: DemoStoreApi["addTransfer"] = useCallback(({ amount, date, fromAccountId, toAccountId, note }) => {
    const groupId = uid("grp");
    const transaction: Transaction = {
      id: uid("tx"),
      userId: "demo-user",
      type: "transfer",
      amount,
      date,
      accountId: fromAccountId,
      toAccountId,
      categoryId: null,
      note: note ?? null,
      tags: [],
      transferGroupId: groupId,
      createdAt: new Date().toISOString(),
    };
    setData((d) => ({ ...d, transactions: [transaction, ...d.transactions] }));
  }, []);

  const importTransactions: DemoStoreApi["importTransactions"] = useCallback((txs) => {
    const existingSignatures = new Set(
      data.transactions.map((t) => `${t.date}|${t.amount}|${t.accountId}|${t.merchant ?? ""}`),
    );
    const toAdd: Transaction[] = [];
    for (const t of txs) {
      const sig = `${t.date}|${t.amount}|${t.accountId}|${t.merchant ?? ""}`;
      if (existingSignatures.has(sig)) continue; // duplicate detection
      existingSignatures.add(sig);
      toAdd.push({ ...t, id: uid("tx"), userId: "demo-user", tags: t.tags ?? [], createdAt: new Date().toISOString() });
    }
    if (toAdd.length) {
      setData((d) => ({ ...d, transactions: [...toAdd, ...d.transactions] }));
    }
    return toAdd.length;
  }, [data.transactions]);

  const addRecurringTemplate: DemoStoreApi["addRecurringTemplate"] = useCallback((t) => {
    const template: RecurringTemplate = { ...t, id: uid("rec"), userId: "demo-user", lastPostedPeriod: null, active: true };
    setData((d) => ({ ...d, recurringTemplates: [...d.recurringTemplates, template] }));
    return template;
  }, []);

  const postRecurring: DemoStoreApi["postRecurring"] = useCallback((templateId, date) => {
    setData((d) => {
      const template = d.recurringTemplates.find((t) => t.id === templateId);
      if (!template) return d;
      const period = date.slice(0, 7);
      if (template.lastPostedPeriod === period) return d; // prevent duplicate posting per period
      const transaction: Transaction = {
        id: uid("tx"),
        userId: "demo-user",
        type: template.type,
        amount: template.amount,
        date,
        accountId: template.accountId,
        toAccountId: template.toAccountId ?? null,
        categoryId: template.categoryId ?? null,
        merchant: template.merchant ?? null,
        tags: [],
        recurringTemplateId: template.id,
        createdAt: new Date().toISOString(),
      };
      return {
        ...d,
        transactions: [transaction, ...d.transactions],
        recurringTemplates: d.recurringTemplates.map((t) => (t.id === templateId ? { ...t, lastPostedPeriod: period } : t)),
      };
    });
  }, []);

  const upsertBudget: DemoStoreApi["upsertBudget"] = useCallback((b) => {
    setData((d) => {
      if (b.id) {
        return { ...d, budgets: d.budgets.map((x) => (x.id === b.id ? { ...x, ...b, id: b.id } : x)) };
      }
      const existing = d.budgets.find((x) => x.categoryId === b.categoryId && x.period === b.period);
      if (existing) {
        return { ...d, budgets: d.budgets.map((x) => (x.id === existing.id ? { ...x, limit: b.limit } : x)) };
      }
      return { ...d, budgets: [...d.budgets, { ...b, id: uid("bud"), userId: "demo-user" }] };
    });
  }, []);

  const deleteBudget: DemoStoreApi["deleteBudget"] = useCallback((id) => {
    setData((d) => ({ ...d, budgets: d.budgets.filter((b) => b.id !== id) }));
  }, []);

  const addGoal: DemoStoreApi["addGoal"] = useCallback((g) => {
    const goal: Goal = { ...g, id: uid("goal"), userId: "demo-user", archived: false, createdAt: new Date().toISOString() };
    setData((d) => ({ ...d, goals: [...d.goals, goal] }));
    return goal;
  }, []);

  const updateGoal: DemoStoreApi["updateGoal"] = useCallback((id, patch) => {
    setData((d) => ({ ...d, goals: d.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)) }));
  }, []);

  const archiveGoal: DemoStoreApi["archiveGoal"] = useCallback((id) => {
    setData((d) => ({ ...d, goals: d.goals.map((g) => (g.id === id ? { ...g, archived: true } : g)) }));
  }, []);

  const addGoalContribution: DemoStoreApi["addGoalContribution"] = useCallback((c) => {
    const contribution: GoalContribution = { ...c, id: uid("gc"), userId: "demo-user" };
    setData((d) => ({ ...d, goalContributions: [...d.goalContributions, contribution] }));
  }, []);

  const addLoan: DemoStoreApi["addLoan"] = useCallback((l) => {
    const loan: LoanAccount = { ...l, id: uid("loan"), userId: "demo-user", archived: false };
    setData((d) => ({ ...d, loans: [...d.loans, loan] }));
    return loan;
  }, []);

  const addLoanPayment: DemoStoreApi["addLoanPayment"] = useCallback((p) => {
    const payment: LoanPayment = { ...p, id: uid("lp"), userId: "demo-user" };
    setData((d) => ({ ...d, loanPayments: [...d.loanPayments, payment] }));
  }, []);

  const addPortfolio: DemoStoreApi["addPortfolio"] = useCallback((p) => {
    const portfolio: Portfolio = { ...p, id: uid("port"), userId: "demo-user" };
    setData((d) => ({ ...d, portfolios: [...d.portfolios, portfolio] }));
    return portfolio;
  }, []);

  const addHolding: DemoStoreApi["addHolding"] = useCallback((h) => {
    const holding: Holding = { ...h, id: uid("hold"), userId: "demo-user" };
    setData((d) => ({ ...d, holdings: [...d.holdings, holding] }));
    return holding;
  }, []);

  const updateHolding: DemoStoreApi["updateHolding"] = useCallback((id, patch) => {
    setData((d) => ({ ...d, holdings: d.holdings.map((h) => (h.id === id ? { ...h, ...patch } : h)) }));
  }, []);

  const addTrade: DemoStoreApi["addTrade"] = useCallback((t) => {
    const trade: InvestmentTrade = { ...t, id: uid("trd"), userId: "demo-user" };
    setData((d) => {
      let holdings = d.holdings;
      const holding = d.holdings.find((h) => h.id === t.holdingId);
      if (holding && t.type !== "dividend") {
        const signedQty = t.type === "buy" ? t.quantity : -t.quantity;
        const newQty = holding.quantity + signedQty;
        let newAvgCost = holding.avgCost;
        if (t.type === "buy" && newQty > 0) {
          newAvgCost = (holding.avgCost * holding.quantity + t.price * t.quantity) / newQty;
        }
        holdings = d.holdings.map((h) => (h.id === holding.id ? { ...h, quantity: newQty, avgCost: newAvgCost } : h));
      }
      return { ...d, holdings, trades: [...d.trades, trade] };
    });
  }, []);

  const updateProfile: DemoStoreApi["updateProfile"] = useCallback((patch) => {
    setData((d) => ({ ...d, profile: { ...d.profile, ...patch } }));
  }, []);

  const value = useMemo<DemoStoreApi>(
    () => ({
      data,
      isDemo: true,
      hydrated,
      resetDemoData,
      startEmptyData,
      addAccount,
      updateAccount,
      archiveAccount,
      addCategory,
      updateCategory,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      addTransfer,
      importTransactions,
      addRecurringTemplate,
      postRecurring,
      upsertBudget,
      deleteBudget,
      addGoal,
      updateGoal,
      archiveGoal,
      addGoalContribution,
      addLoan,
      addLoanPayment,
      addPortfolio,
      addHolding,
      updateHolding,
      addTrade,
      updateProfile,
    }),
    [
      data,
      hydrated,
      resetDemoData,
      startEmptyData,
      addAccount,
      updateAccount,
      archiveAccount,
      addCategory,
      updateCategory,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      addTransfer,
      importTransactions,
      addRecurringTemplate,
      postRecurring,
      upsertBudget,
      deleteBudget,
      addGoal,
      updateGoal,
      archiveGoal,
      addGoalContribution,
      addLoan,
      addLoanPayment,
      addPortfolio,
      addHolding,
      updateHolding,
      addTrade,
      updateProfile,
    ],
  );

  return <DemoStoreContext.Provider value={value}>{children}</DemoStoreContext.Provider>;
}

export function useDemoStore(): DemoStoreApi {
  const ctx = useContext(DemoStoreContext);
  if (!ctx) throw new Error("useDemoStore must be used within DemoStoreProvider");
  return ctx;
}
