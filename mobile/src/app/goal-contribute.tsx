import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { useFinanceData } from "@/lib/hooks/use-finance-data";
import { Button, Chip, Field, Label, Screen, styles } from "@/components/ui";
import { useTheme } from "@/theme";

export default function GoalContribute() {
  const t = useTheme();
  const { goalId, mode } = useLocalSearchParams<{ goalId: string; mode?: string }>();
  const { data, addGoalContribution } = useFinanceData();
  const withdraw = mode === "withdraw";
  const goal = data.goals.find((g) => g.id === goalId);
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(data.accounts[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);

  function save() {
    const amt = Number(amount);
    if (!goalId || !amt || amt <= 0) {
      setError("จำนวนเงินต้องมากกว่า 0");
      return;
    }
    addGoalContribution({
      goalId,
      amount: withdraw ? -amt : amt,
      date: new Date().toISOString().slice(0, 10),
      accountId,
      note: null,
    });
    router.back();
  }

  return (
    <Screen title={withdraw ? "ถอนเงินจากเป้าหมาย" : "สมทบเงินเข้าเป้าหมาย"}>
      <Text style={{ color: t.muted }}>{goal?.title}</Text>
      <Label>จำนวนเงิน (บาท)</Label>
      <Field value={amount} onChangeText={setAmount} placeholder="0.00" keyboardType="decimal-pad" autoFocus />
      <Label>บัญชี</Label>
      <View style={styles.chipWrap}>
        {data.accounts.map((a) => (
          <Chip key={a.id} label={a.name} selected={accountId === a.id} onPress={() => setAccountId(a.id)} />
        ))}
      </View>
      {error ? <Text style={{ color: t.danger, marginTop: 10 }}>{error}</Text> : null}
      <Button title="บันทึก" onPress={save} />
      <Button title="ยกเลิก" variant="outline" onPress={() => router.back()} />
    </Screen>
  );
}
