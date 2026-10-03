import { router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { useFinanceData } from "@/lib/hooks/use-finance-data";
import { accountSchema } from "@/lib/validation/schemas";
import type { AccountType } from "@/lib/finance/types";
import { Button, Chip, Field, Label, Screen, styles } from "@/components/ui";
import { ACCOUNT_TYPE_LABELS } from "@/labels";
import { useTheme } from "@/theme";

export default function AddAccount() {
  const t = useTheme();
  const { addAccount } = useFinanceData();
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("bank");
  const [balance, setBalance] = useState("");
  const [error, setError] = useState<string | null>(null);

  function save() {
    const parsed = accountSchema.safeParse({
      name,
      type,
      currency: "THB",
      openingBalance: Number(balance) || 0,
      openingDate: new Date().toISOString().slice(0, 10),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง");
      return;
    }
    addAccount(parsed.data);
    router.back();
  }

  return (
    <Screen title="เพิ่มบัญชี">
      <Label>ชื่อบัญชี</Label>
      <Field value={name} onChangeText={setName} placeholder="เช่น บัญชีออมทรัพย์" autoFocus />
      <Label>ประเภทบัญชี</Label>
      <View style={styles.chipWrap}>
        {(Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[]).map((k) => (
          <Chip key={k} label={ACCOUNT_TYPE_LABELS[k]} selected={type === k} onPress={() => setType(k)} />
        ))}
      </View>
      <Label>ยอดเงินเริ่มต้น (บาท)</Label>
      <Field value={balance} onChangeText={setBalance} placeholder="0.00" keyboardType="decimal-pad" />
      {error ? <Text style={{ color: t.danger, marginTop: 10 }}>{error}</Text> : null}
      <Button title="บันทึก" onPress={save} />
      <Button title="ยกเลิก" variant="outline" onPress={() => router.back()} />
    </Screen>
  );
}
