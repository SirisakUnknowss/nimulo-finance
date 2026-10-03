import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from "react-native";
import { useTheme } from "@/theme";

/** Native iOS 26 Liquid Glass where available, a solid themed card elsewhere. */
export function GlassCard({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  if (isLiquidGlassAvailable()) {
    return (
      <GlassView glassEffectStyle="regular" style={[styles.card, style]}>
        {children}
      </GlassView>
    );
  }
  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border, borderWidth: StyleSheet.hairlineWidth }, style]}>
      {children}
    </View>
  );
}

export function Screen({ children, title, action }: { children: ReactNode; title?: string; action?: ReactNode }) {
  const t = useTheme();
  return (
    <ScrollView
      style={{ backgroundColor: t.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.screen}
      keyboardShouldPersistTaps="handled">
      {title ? (
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: t.foreground }]}>{title}</Text>
          {action}
        </View>
      ) : null}
      {children}
    </ScrollView>
  );
}

export function Label({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={[styles.label, { color: t.muted }]}>{children}</Text>;
}

export function Field(props: TextInputProps) {
  const t = useTheme();
  return (
    <TextInput
      placeholderTextColor={t.muted}
      {...props}
      style={[styles.input, { color: t.foreground, borderColor: t.border, backgroundColor: t.card }, props.style]}
    />
  );
}

export function Button({
  title,
  onPress,
  variant = "primary",
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "outline" | "danger";
}) {
  const t = useTheme();
  const bg = variant === "primary" ? t.accent : "transparent";
  const color = variant === "primary" ? "#fff" : variant === "danger" ? t.danger : t.foreground;
  const border = variant === "primary" ? t.accent : variant === "danger" ? t.danger : t.border;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.button, { backgroundColor: bg, borderColor: border, opacity: pressed ? 0.7 : 1 }]}>
      <Text style={[styles.buttonText, { color }]}>{title}</Text>
    </Pressable>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, { backgroundColor: selected ? t.accentSoft : "transparent", borderColor: selected ? t.accent : t.border }]}>
      <Text style={{ color: selected ? t.accent : t.foreground, fontWeight: selected ? "600" : "400" }}>{label}</Text>
    </Pressable>
  );
}

export function Row({ left, right, sub, rightColor }: { left: string; right: string; sub?: string; rightColor?: string }) {
  const t = useTheme();
  return (
    <View style={styles.row}>
      <View style={{ flex: 1, paddingRight: 8 }}>
        <Text style={{ color: t.foreground, fontSize: 15, fontWeight: "500" }}>{left}</Text>
        {sub ? <Text style={{ color: t.muted, fontSize: 12, marginTop: 2 }}>{sub}</Text> : null}
      </View>
      <Text style={{ color: rightColor ?? t.foreground, fontSize: 15, fontWeight: "600" }}>{right}</Text>
    </View>
  );
}

export function Muted({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={{ color: t.muted, fontSize: 14, lineHeight: 20 }}>{children}</Text>;
}

export const styles = StyleSheet.create({
  card: { borderRadius: 24, padding: 18, marginBottom: 14, overflow: "hidden" },
  screen: { padding: 16, paddingBottom: 40 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  title: { fontSize: 30, fontWeight: "700", letterSpacing: -0.5 },
  label: { fontSize: 13, marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  button: { borderWidth: 1, borderRadius: 14, paddingVertical: 14, alignItems: "center", marginTop: 18 },
  buttonText: { fontSize: 16, fontWeight: "600" },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, marginBottom: 8 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap" },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
});
