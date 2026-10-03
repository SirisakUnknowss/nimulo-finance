import { router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { useFinanceData } from "@/lib/hooks/use-finance-data";
import { goalSchema } from "@/lib/validation/schemas";
import type { GoalType } from "@/lib/finance/types";
import { Button, Chip, Field, Label, Screen, styles } from "@/components/ui";
import { GOAL_TYPE_LABELS } from "@/labels";
import { useTheme } from "@/theme";

export default function AddGoal() {
  const t = useTheme();
  const { addGoal } = useFinanceData();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<GoalType>("custom");
  const [target, setTarget] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  function save() {
    if (targetDate && !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      setError("รูปแบบวันที่ต้องเป็น YYYY-MM-DD");
      return;
    }
    const parsed = goalSchema.safeParse({
      title,
      type,
      targetAmount: Number(target),
      targetDate: targetDate || null,
      notes: null,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง");
      return;
    }
    addGoal({
      title: parsed.data.title,
      type: parsed.data.type,
      targetAmount: parsed.data.targetAmount,
      targetDate: parsed.data.targetDate ?? null,
      notes: null,
    });
    router.back();
  }

  return (
    <Screen title="เพิ่มเป้าหมาย">
      <Label>ชื่อเป้าหมาย</Label>
      <Field value={title} onChangeText={setTitle} placeholder="เช่น กองทุนฉุกเฉิน" autoFocus />
      <Label>ประเภท</Label>
      <View style={styles.chipWrap}>
        {(Object.keys(GOAL_TYPE_LABELS) as GoalType[]).map((k) => (
          <Chip key={k} label={GOAL_TYPE_LABELS[k]} selected={type === k} onPress={() => setType(k)} />
        ))}
      </View>
      <Label>จำนวนเงินเป้าหมาย (บาท)</Label>
      <Field value={target} onChangeText={setTarget} placeholder="0.00" keyboardType="decimal-pad" />
      <Label>วันที่ต้องการให้สำเร็จ (ไม่บังคับ, YYYY-MM-DD)</Label>
      <Field value={targetDate} onChangeText={setTargetDate} placeholder="2027-12-31" autoCapitalize="none" />
      {error ? <Text style={{ color: t.danger, marginTop: 10 }}>{error}</Text> : null}
      <Button title="บันทึก" onPress={save} />
      <Button title="ยกเลิก" variant="outline" onPress={() => router.back()} />
    </Screen>
  );
}
