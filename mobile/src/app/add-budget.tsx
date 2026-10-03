import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { useFinanceData } from "@/lib/hooks/use-finance-data";
import { monthLabelThai } from "@/lib/utils";
import { budgetSchema } from "@/lib/validation/schemas";
import { Button, Chip, Field, Label, Screen, styles } from "@/components/ui";
import { useTheme } from "@/theme";

export default function AddBudget() {
  const t = useTheme();
  const { period: periodParam } = useLocalSearchParams<{ period?: string }>();
  const { data, budgetStatuses, upsertBudget } = useFinanceData();
  const period = periodParam ?? new Date().toISOString().slice(0, 7);
  const [categoryId, setCategoryId] = useState("");
  const [limit, setLimit] = useState("");
  const [error, setError] = useState<string | null>(null);

  const used = new Set(budgetStatuses(period).map((s) => s.budget.categoryId));
  const categories = data.categories.filter((c) => c.kind === "expense" && !c.archived && !used.has(c.id));

  function save() {
    const parsed = budgetSchema.safeParse({ categoryId, period, limit: Number(limit) });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง");
      return;
    }
    upsertBudget(parsed.data);
    router.back();
  }

  return (
    <Screen title="เพิ่มงบประมาณ">
      <Text style={{ color: t.muted }}>เดือน {monthLabelThai(period)}</Text>
      <Label>หมวดหมู่รายจ่าย</Label>
      {categories.length === 0 ? (
        <Text style={{ color: t.muted }}>ทุกหมวดหมู่มีงบประมาณในเดือนนี้แล้ว</Text>
      ) : (
        <View style={styles.chipWrap}>
          {categories.map((c) => (
            <Chip key={c.id} label={c.name} selected={categoryId === c.id} onPress={() => setCategoryId(c.id)} />
          ))}
        </View>
      )}
      <Label>วงเงิน (บาท)</Label>
      <Field value={limit} onChangeText={setLimit} placeholder="0.00" keyboardType="decimal-pad" />
      {error ? <Text style={{ color: t.danger, marginTop: 10 }}>{error}</Text> : null}
      <Button title="บันทึก" onPress={save} />
      <Button title="ยกเลิก" variant="outline" onPress={() => router.back()} />
    </Screen>
  );
}
