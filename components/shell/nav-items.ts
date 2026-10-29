import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  PiggyBank,
  Target,
  LineChart,
  CreditCard,
  FileBarChart,
  Settings,
  Coffee,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/overview", label: "ภาพรวม", icon: LayoutDashboard },
  { href: "/transactions", label: "รายการเงิน", icon: ArrowLeftRight },
  { href: "/accounts", label: "บัญชีของฉัน", icon: Wallet },
  { href: "/budgets", label: "งบประมาณ", icon: PiggyBank },
  { href: "/goals", label: "เป้าหมาย", icon: Target },
  { href: "/investments", label: "การลงทุน", icon: LineChart },
  { href: "/debts", label: "หนี้สิน", icon: CreditCard },
  { href: "/reports", label: "รายงาน", icon: FileBarChart },
  { href: "/settings", label: "ตั้งค่า", icon: Settings },
];

/** Pages reachable from links rather than the main nav; listed so the header can title them. */
export const EXTRA_PAGES: NavItem[] = [
  { href: "/support", label: "เลี้ยงกาแฟ dev", icon: Coffee },
];
