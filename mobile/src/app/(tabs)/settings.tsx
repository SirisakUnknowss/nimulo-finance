import { useState } from "react";
import { Alert } from "react-native";
import { useFinanceData } from "@/lib/hooks/use-finance-data";
import { Button, Field, GlassCard, Label, Muted, Screen } from "@/components/ui";

export default function Settings() {
  const { data, updateProfile, startEmptyData } = useFinanceData();
  const [name, setName] = useState(data.profile.displayName);

  function clearAll() {
    Alert.alert("ลบข้อมูลทั้งหมดหรือไม่?", "ข้อมูลในเครื่องนี้จะถูกลบอย่างถาวรและไม่สามารถย้อนกลับได้", [
      { text: "ยกเลิก", style: "cancel" },
      { text: "ลบทั้งหมด", style: "destructive", onPress: () => startEmptyData() },
    ]);
  }

  return (
    <Screen title="ตั้งค่า">
      <GlassCard>
        <Label>ชื่อที่แสดง</Label>
        <Field value={name} onChangeText={setName} placeholder="ชื่อของคุณ" />
        <Button title="บันทึก" onPress={() => updateProfile({ displayName: name.trim() })} />
      </GlassCard>
      <GlassCard>
        <Muted>ข้อมูลทั้งหมดถูกเก็บไว้ในเครื่องนี้เท่านั้น nimulo. ไม่เชื่อมต่อกับสถาบันการเงินใดๆ</Muted>
        <Button title="ลบข้อมูลทั้งหมด" variant="danger" onPress={clearAll} />
      </GlassCard>
    </Screen>
  );
}
