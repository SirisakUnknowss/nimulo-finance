import { useState } from "react";
import { Text, View } from "react-native";
import { useFinanceData } from "@/lib/hooks/use-finance-data";
import { accountSchema } from "@/lib/validation/schemas";
import type { AccountType } from "@/lib/finance/types";
import { Button, Chip, Field, GlassCard, Label, Muted, Screen, styles } from "@/components/ui";
import { ACCOUNT_TYPE_LABELS } from "@/labels";
import { useTheme } from "@/theme";

const today = () => new Date().toISOString().slice(0, 10);

/** First run: ask for a name and the first account. Creating the account flips the root guard to the tabs. */
export default function Onboarding() {
  const t = useTheme();
  const { data, updateProfile, addAccount } = useFinanceData();
  const [name, setName] = useState(data.profile.displayName);
  const [accountName, setAccountName] = useState("");
  const [type, setType] = useState<AccountType>("bank");
  const [balance, setBalance] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const parsed = accountSchema.safeParse({
      name: accountName,
      type,
      currency: "THB",
      openingBalance: Number(balance) || 0,
      openingDate: today(),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง");
      return;
    }
    if (name.trim()) updateProfile({ displayName: name.trim() });
    addAccount(parsed.data);
  }

  return (
    <Screen>
      <View style={{ marginTop: 48, marginBottom: 20 }}>
        <Text style={{ color: t.foreground, fontSize: 30, fontWeight: "700", letterSpacing: -0.5 }}>
          เริ่มต้นเข้าใจเงินของคุณ
        </Text>
        <View style={{ height: 8 }} />
        <Muted>เพิ่มข้อมูลเพียงเล็กน้อย แล้วเราจะช่วยแสดงภาพรวมการเงินของคุณ</Muted>
      </View>
      <GlassCard>
        <Label>ชื่อของคุณ</Label>
        <Field value={name} onChangeText={setName} placeholder="ชื่อที่ต้องการให้เรียก" />
        <Label>ชื่อบัญชีแรก</Label>
        <Field value={accountName} onChangeText={setAccountName} placeholder="เช่น บัญชีออมทรัพย์, เงินสด" />
        <Label>ประเภทบัญชี</Label>
        <View style={styles.chipWrap}>
          {(Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[]).map((k) => (
            <Chip key={k} label={ACCOUNT_TYPE_LABELS[k]} selected={type === k} onPress={() => setType(k)} />
          ))}
        </View>
        <Label>ยอดเงินเริ่มต้น (บาท)</Label>
        <Field value={balance} onChangeText={setBalance} placeholder="0.00" keyboardType="decimal-pad" />
        {error ? <Text style={{ color: t.danger, marginTop: 10 }}>{error}</Text> : null}
        <Button title="เริ่มต้นใช้งาน" onPress={submit} />
      </GlassCard>
    </Screen>
  );
}
