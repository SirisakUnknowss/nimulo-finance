import { router } from "expo-router";
import { Text } from "react-native";
import { useFinanceData } from "@/lib/hooks/use-finance-data";
import { currentPeriod, formatDateThai, formatTHB, periodBounds } from "@/lib/utils";
import { Button, GlassCard, Muted, Row, Screen } from "@/components/ui";
import { useTheme } from "@/theme";

export default function Overview() {
  const t = useTheme();
  const { data, netWorth, accountsWithBalances, periodTotals, categoryById } = useFinanceData();
  const { start, end } = periodBounds(currentPeriod());
  const totals = periodTotals(start, end);
  const recent = [...data.transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const greeting = data.profile.displayName ? `สวัสดี, ${data.profile.displayName}` : "สวัสดี";

  return (
    <Screen title="ภาพรวม">
      <Muted>{greeting}</Muted>
      <GlassCard style={{ marginTop: 12 }}>
        <Muted>ความมั่งคั่งสุทธิ</Muted>
        <Text style={{ color: t.foreground, fontSize: 34, fontWeight: "700", letterSpacing: -0.5, marginTop: 4 }}>
          {formatTHB(netWorth.netWorth)}
        </Text>
      </GlassCard>

      <GlassCard>
        <Muted>เดือนนี้</Muted>
        <Row left="รายรับ" right={formatTHB(totals.income)} rightColor={t.success} />
        <Row left="รายจ่าย" right={formatTHB(totals.expenses)} rightColor={t.danger} />
      </GlassCard>

      <GlassCard>
        <Muted>บัญชีของฉัน</Muted>
        {accountsWithBalances.map(({ account, balance }) => (
          <Row key={account.id} left={account.name} right={formatTHB(balance)} />
        ))}
      </GlassCard>

      <GlassCard>
        <Muted>รายการล่าสุด</Muted>
        {recent.length === 0 ? <Text style={{ color: t.muted, paddingVertical: 10 }}>ยังไม่มีรายการ</Text> : null}
        {recent.map((tx) => (
          <Row
            key={tx.id}
            left={tx.merchant || (tx.categoryId ? categoryById.get(tx.categoryId)?.name : undefined) || "รายการ"}
            sub={formatDateThai(tx.date)}
            right={`${tx.type === "income" ? "+" : tx.type === "expense" ? "-" : ""}${formatTHB(tx.amount)}`}
            rightColor={tx.type === "income" ? t.success : tx.type === "expense" ? t.danger : t.foreground}
          />
        ))}
      </GlassCard>

      <Button title="เพิ่มรายการ" onPress={() => router.push("/add-transaction")} />
    </Screen>
  );
}
