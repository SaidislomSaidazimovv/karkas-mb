// src/canvas/MoveSheet.tsx — the ↕ move control for a divider (CONSTRUCTION_FRAME_v3, moveLine).
// OWNER: T1. A bottom sheet that nudges the selected divider (Line) by a relative delta, with a
// scope selector that decides how far the reflow reaches:
//   Локально = "local" · Линия = "line" (v3 default) · Ряд = "row" · Все = "global"
// Each − / + calls onMove(±step_mm10, scope) → engine moveLine → the neighbouring sections reflow
// and the edit lands on the undo stack. moveLine is RELATIVE, so this is a pure nudge control
// (no absolute value to seed).

import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import type { Scope } from "../../engineBridge";
import { C, FONT, R } from "../../theme";

const STEPS = [10, 50] as const; // mm per nudge

const SCOPES: { key: Scope; label: string }[] = [
  { key: "local", label: "Локально" },
  { key: "line", label: "Линия" },
  { key: "row", label: "Ряд" },
  { key: "global", label: "Все" },
];

export function MoveSheet({
  onMove,
  onClose,
}: {
  onMove: (delta_mm10: number, scope: Scope) => void;
  onClose: () => void;
}) {
  const [scope, setScope] = useState<Scope>("line");
  const [step, setStep] = useState<number>(10);

  return (
    <View style={styles.sheet}>
      <View style={styles.grab} />
      <View style={styles.head}>
        <Text style={styles.title}>Сдвинуть перегородку</Text>
        <Pressable style={styles.close} onPress={onClose} hitSlop={8}>
          <Text style={styles.closeG}>✕</Text>
        </Pressable>
      </View>

      <Text style={styles.k}>Область</Text>
      <View style={styles.seg}>
        {SCOPES.map((s) => {
          const on = s.key === scope;
          return (
            <Pressable key={s.key} style={[styles.o, on && styles.oOn]} onPress={() => setScope(s.key)}>
              <Text style={[styles.oT, on && styles.oTOn]}>{s.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.k}>Шаг</Text>
      <View style={styles.seg}>
        {STEPS.map((s) => {
          const on = s === step;
          return (
            <Pressable key={s} style={[styles.o, on && styles.oOn]} onPress={() => setStep(s)}>
              <Text style={[styles.oT, on && styles.oTOn]}>{s} мм</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.k}>Сдвиг</Text>
      <View style={styles.num}>
        <Pressable style={styles.pm} onPress={() => onMove(-step * 10, scope)}>
          <Text style={styles.pmG}>−</Text>
        </Pressable>
        <View style={styles.v}>
          <Text style={styles.vT}>± {step}<Text style={styles.vU}> мм</Text></Text>
        </View>
        <Pressable style={styles.pm} onPress={() => onMove(step * 10, scope)}>
          <Text style={styles.pmG}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: R.sheet,
    borderTopRightRadius: R.sheet,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 18,
    shadowColor: "#141414",
    shadowOpacity: 0.16,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: -12 },
    zIndex: 9,
  },
  grab: { width: 42, height: 5, borderRadius: 3, backgroundColor: "#e2e0db", alignSelf: "center", marginBottom: 12 },
  head: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  title: { fontFamily: FONT, fontSize: 18, fontWeight: "800", color: C.ink, marginRight: "auto" },
  close: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  closeG: { fontFamily: FONT, fontSize: 17, color: C.ink },

  k: { fontFamily: FONT, fontSize: 12, fontWeight: "700", color: C.ink2, marginTop: 11, marginBottom: 8 },
  seg: { flexDirection: "row", backgroundColor: C.field, borderRadius: 12, padding: 4, gap: 4 },
  o: { flex: 1, height: 40, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  oOn: { backgroundColor: "#fff", shadowColor: "#141414", shadowOpacity: 0.1, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  oT: { fontFamily: FONT, fontSize: 12.5, fontWeight: "700", color: C.ink3 },
  oTOn: { color: C.ink },

  num: { flexDirection: "row", alignItems: "center", gap: 10 },
  v: { flex: 1, height: 48, borderWidth: 1, borderColor: C.line, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  vT: { fontFamily: FONT, fontSize: 18, fontWeight: "800", color: C.ink },
  vU: { fontFamily: FONT, fontSize: 12, color: C.ink2, fontWeight: "700" },
  pm: { width: 48, height: 48, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  pmG: { fontFamily: FONT, fontSize: 22, color: C.ink },
});
