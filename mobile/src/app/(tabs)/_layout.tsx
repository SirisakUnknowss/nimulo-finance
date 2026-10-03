import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useTheme } from "@/theme";

// The system tab bar: renders as iOS 26 Liquid Glass automatically.
export default function TabsLayout() {
  const t = useTheme();
  return (
    <NativeTabs tintColor={t.accent}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>ภาพรวม</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="chart.pie.fill" md="dashboard" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="transactions">
        <NativeTabs.Trigger.Label>รายการเงิน</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="arrow.left.arrow.right" md="swap_horiz" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="accounts">
        <NativeTabs.Trigger.Label>บัญชี</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="wallet.bifold.fill" md="account_balance_wallet" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>ตั้งค่า</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="gearshape.fill" md="settings" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
