import { router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { useFinanceData } from "@/lib/hooks/use-finance-data";
import { transactionSchema } from "@/lib/validation/schemas";
import { Button, Chip, Field, Label, Screen, styles } from "@/components/ui";
import { useTheme } from "@/theme";

const today = () => new Date().toISOString().slice(0, 10);

export default function AddTransaction() {
  const t = useTheme();
  const { data, addTransaction } = useFinanceData();
  const [type, setType] = useState<"expense" | "income">("expense");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [accountId, setAccountId] = useState(data.accounts[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState("");
  const [merchant, setMerchant] = useState("");
  const [error, setError] = useState<string | null>(null);

  const categories = data.categories.filter((c) => c.kind === type && !c.archived);

  function save() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError("รูปแบบวันที่ต้องเป็น YYYY-MM-DD");
      return;
    }
    const parsed = transactionSchema.safeParse({
      type,
      amount: Number(amount),
      date,
      accountId,
      categoryId: categoryId || null,
      merchant: merchant.trim() || null,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง");
      return;
    }
    addTransaction({
      type,
      amount: parsed.data.amount,
      date: parsed.data.date,
      accountId: parsed.data.accountId,
      categoryId: parsed.data.categoryId ?? null,
      merchant: parsed.data.merchant ?? null,
      note: null,
    });
    router.back();
  }

  return (
    <Screen title="เพิ่มรายการ">
      <View style={styles.chipWrap}>
        <Chip label="รายจ่าย" selected={type === "expense"} onPress={() => { setType("expense"); setCategoryId(""); }} />
        <Chip label="รายรับ" selected={type === "income"} onPress={() => { setType("income"); setCategoryId(""); }} />
      </View>
      <Label>จำนวนเงิน (บาท)</Label>
      <Field value={amount} onChangeText={setAmount} placeholder="0.00" keyboardType="decimal-pad" autoFocus />
      <Label>บัญชี</Label>
      <View style={styles.chipWrap}>
        {data.accounts.map((a) => (
          <Chip key={a.id} label={a.name} selected={accountId === a.id} onPress={() => setAccountId(a.id)} />
        ))}
      </View>
      <Label>หมวดหมู่</Label>
      <View style={styles.chipWrap}>
        {categories.map((c) => (
          <Chip key={c.id} label={c.name} selected={categoryId === c.id} onPress={() => setCategoryId(c.id)} />
        ))}
      </View>
      <Label>ร้านค้า / ที่มา (ไม่บังคับ)</Label>
      <Field value={merchant} onChangeText={setMerchant} placeholder="เช่น ร้านกาแฟ" />
      <Label>วันที่ (YYYY-MM-DD)</Label>
      <Field value={date} onChangeText={setDate} autoCapitalize="none" />
      {error ? <Text style={{ color: t.danger, marginTop: 10 }}>{error}</Text> : null}
      <Button title="บันทึก" onPress={save} />
      <Button title="ยกเลิก" variant="outline" onPress={() => router.back()} />
    </Screen>
  );
}
