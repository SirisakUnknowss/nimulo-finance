import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { useFinanceData } from "@/lib/hooks/use-finance-data";
import { currentPeriod, formatDateThai, formatTHB, monthLabelThai, shiftPeriod } from "@/lib/utils";
import { Button, GlassCard, Muted, Progress, Screen } from "@/components/ui";
import { GOAL_TYPE_LABELS } from "@/labels";
import { useTheme } from "@/theme";

/** Budgets (per month, per expense category) and savings goals. */
export default function Plan() {
  const t = useTheme();
  const { budgetStatuses, deleteBudget, categoryById, goalsWithProgress, archiveGoal } = useFinanceData();
  const [period, setPeriod] = useState(currentPeriod());

  const statuses = budgetStatuses(period);
  const totalLimit = statuses.reduce((s, b) => s + b.budget.limit, 0);
  const totalSpent = statuses.reduce((s, b) => s + b.spent, 0);
  const goals = goalsWithProgress.filter((g) => !g.goal.archived);

  function confirmDeleteBudget(id: string) {
    Alert.alert("ลบงบประมาณนี้หรือไม่?", undefined, [
      { text: "ยกเลิก", style: "cancel" },
      { text: "ลบ", style: "destructive", onPress: () => deleteBudget(id) },
    ]);
  }

  function confirmArchiveGoal(id: string) {
    Alert.alert("เก็บเป้าหมายนี้เข้าคลังหรือไม่?", undefined, [
      { text: "ยกเลิก", style: "cancel" },
      { text: "เก็บ", onPress: () => archiveGoal(id) },
    ]);
  }

  const barColor = (status: "ok" | "warning" | "over") =>
    status === "over" ? t.danger : status === "warning" ? "#c9902b" : t.accent;

  return (
    <Screen title="แผนการเงิน">
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <Pressable onPress={() => setPeriod((p) => shiftPeriod(p, -1))} hitSlop={12}>
          <Text style={{ color: t.accent, fontSize: 22 }}>‹</Text>
        </Pressable>
        <Text style={{ color: t.foreground, fontSize: 17, fontWeight: "600" }}>งบประมาณ {monthLabelThai(period)}</Text>
        <Pressable onPress={() => setPeriod((p) => shiftPeriod(p, 1))} hitSlop={12}>
          <Text style={{ color: t.accent, fontSize: 22 }}>›</Text>
        </Pressable>
      </View>

      <GlassCard>
        <Muted>
          ใช้ไปแล้ว {formatTHB(totalSpent)} จาก {formatTHB(totalLimit)}
        </Muted>
        <Progress ratio={totalLimit > 0 ? totalSpent / totalLimit : 0} color={totalSpent > totalLimit && totalLimit > 0 ? t.danger : t.accent} />
      </GlassCard>

      {statuses.length === 0 ? (
        <GlassCard>
          <Muted>ยังไม่มีงบประมาณในเดือนนี้ ตั้งงบตามหมวดหมู่รายจ่ายเพื่อคุมค่าใช้จ่าย</Muted>
        </GlassCard>
      ) : (
        statuses.map((s) => (
          <Pressable key={s.budget.id} onLongPress={() => confirmDeleteBudget(s.budget.id)} delayLongPress={350}>
            <GlassCard>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: t.foreground, fontSize: 15, fontWeight: "600" }}>
                  {categoryById.get(s.budget.categoryId)?.name ?? "หมวดหมู่"}
                </Text>
                <Text style={{ color: t.muted, fontSize: 13 }}>
                  {formatTHB(s.spent)} / {formatTHB(s.budget.limit)}
                </Text>
              </View>
              <Progress ratio={s.percentUsed / 100} color={barColor(s.status)} />
              <Text style={{ color: s.status === "over" ? t.danger : t.muted, fontSize: 12, marginTop: 6 }}>
                {s.status === "over" ? `เกินงบ ${formatTHB(-s.remaining)}` : `เหลืออีก ${formatTHB(s.remaining)}`}
              </Text>
            </GlassCard>
          </Pressable>
        ))
      )}
      <Button title="เพิ่มงบประมาณ" onPress={() => router.push({ pathname: "/add-budget", params: { period } })} />

      <Text style={{ color: t.foreground, fontSize: 20, fontWeight: "700", marginTop: 28, marginBottom: 12 }}>เป้าหมายการออม</Text>
      {goals.length === 0 ? (
        <GlassCard>
          <Muted>ยังไม่มีเป้าหมาย เริ่มตั้งเป้า เช่น กองทุนฉุกเฉิน หรือเที่ยวพักผ่อน</Muted>
        </GlassCard>
      ) : (
        goals.map(({ goal, progress }) => (
          <Pressable key={goal.id} onLongPress={() => confirmArchiveGoal(goal.id)} delayLongPress={350}>
            <GlassCard>
              <Text style={{ color: t.foreground, fontSize: 16, fontWeight: "600" }}>{goal.title}</Text>
              <Text style={{ color: t.muted, fontSize: 12, marginTop: 2 }}>
                {GOAL_TYPE_LABELS[goal.type]}
                {goal.targetDate ? ` · เป้าหมาย ${formatDateThai(goal.targetDate)}` : ""}
              </Text>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 10 }}>
                <Text style={{ color: t.foreground, fontWeight: "600" }}>{formatTHB(progress.allocated)}</Text>
                <Text style={{ color: t.muted }}>/ {formatTHB(goal.targetAmount)}</Text>
              </View>
              <Progress ratio={progress.progressRatio} color={t.accent} />
              <Text style={{ color: t.muted, fontSize: 12, marginTop: 6 }}>เหลืออีก {formatTHB(progress.remaining)}</Text>
              <Text style={{ color: progress.projectedCompletionDate ? t.accent : t.muted, fontSize: 12, marginTop: 2 }}>
                {progress.projectedCompletionDate
                  ? `คาดว่าจะถึงเป้าหมายประมาณ ${formatDateThai(progress.projectedCompletionDate)} (ประมาณการ)`
                  : "ยังมีข้อมูลไม่พอสำหรับประมาณการวันที่สำเร็จ"}
              </Text>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Button
                    title="สมทบเงิน"
                    variant="outline"
                    onPress={() => router.push({ pathname: "/goal-contribute", params: { goalId: goal.id, mode: "add" } })}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    title="ถอนเงิน"
                    variant="outline"
                    onPress={() => router.push({ pathname: "/goal-contribute", params: { goalId: goal.id, mode: "withdraw" } })}
                  />
                </View>
              </View>
            </GlassCard>
          </Pressable>
        ))
      )}
      <Button title="เพิ่มเป้าหมาย" onPress={() => router.push("/add-goal")} />
      <Text style={{ color: t.muted, fontSize: 12, marginTop: 12 }}>กดค้างที่งบประมาณหรือเป้าหมายเพื่อลบ/เก็บ</Text>
    </Screen>
  );
}
