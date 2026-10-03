import { router } from "expo-router";
import { Alert, Pressable, Text } from "react-native";
import { useFinanceData } from "@/lib/hooks/use-finance-data";
import { formatDateThai, formatTHB } from "@/lib/utils";
import { Button, GlassCard, Muted, Row, Screen } from "@/components/ui";
import { useTheme } from "@/theme";

export default function Transactions() {
  const t = useTheme();
  const { data, categoryById, accountById, deleteTransaction } = useFinanceData();
  const sorted = [...data.transactions].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

  function confirmDelete(id: string) {
    Alert.alert("ลบรายการนี้หรือไม่?", undefined, [
      { text: "ยกเลิก", style: "cancel" },
      { text: "ลบ", style: "destructive", onPress: () => deleteTransaction(id) },
    ]);
  }

  return (
    <Screen title="รายการเงิน">
      {sorted.length === 0 ? (
        <GlassCard>
          <Muted>ยังไม่มีรายการ เริ่มบันทึกรายรับหรือรายจ่ายแรกของคุณได้เลย</Muted>
        </GlassCard>
      ) : (
        <GlassCard>
          {sorted.map((tx) => (
            <Pressable key={tx.id} onLongPress={() => confirmDelete(tx.id)} delayLongPress={350}>
              <Row
                left={tx.merchant || (tx.categoryId ? categoryById.get(tx.categoryId)?.name : undefined) || "โอนระหว่างบัญชี"}
                sub={`${formatDateThai(tx.date)} · ${accountById.get(tx.accountId)?.name ?? ""}`}
                right={`${tx.type === "income" ? "+" : tx.type === "expense" ? "-" : ""}${formatTHB(tx.amount)}`}
                rightColor={tx.type === "income" ? t.success : tx.type === "expense" ? t.danger : t.foreground}
              />
            </Pressable>
          ))}
          <Text style={{ color: t.muted, fontSize: 12, marginTop: 8 }}>กดค้างที่รายการเพื่อลบ</Text>
        </GlassCard>
      )}
      <Button title="เพิ่มรายการ" onPress={() => router.push("/add-transaction")} />
    </Screen>
  );
}
