import { router } from "expo-router";
import { useFinanceData } from "@/lib/hooks/use-finance-data";
import { formatTHB } from "@/lib/utils";
import { Button, GlassCard, Row, Screen } from "@/components/ui";
import { ACCOUNT_TYPE_LABELS } from "@/labels";

export default function Accounts() {
  const { accountsWithBalances, netWorth } = useFinanceData();
  return (
    <Screen title="บัญชีของฉัน">
      <GlassCard>
        <Row left="สินทรัพย์รวม" right={formatTHB(netWorth.totalAssets)} />
        <Row left="หนี้สินรวม" right={formatTHB(netWorth.totalLiabilities)} />
      </GlassCard>
      <GlassCard>
        {accountsWithBalances.map(({ account, balance }) => (
          <Row key={account.id} left={account.name} sub={ACCOUNT_TYPE_LABELS[account.type]} right={formatTHB(balance)} />
        ))}
      </GlassCard>
      <Button title="เพิ่มบัญชี" onPress={() => router.push("/add-account")} />
    </Screen>
  );
}
