// src/canvas/DivideSheet.tsx — Build-mode divide control (CONSTRUCTION_FRAME_v3 §4). OWNER: T1.
// A bottom sheet over the canvas for splitting the selected leaf section. Maps the chosen mode
// to the store's DivideOpts → engine divide → model re-derives → the 3D redraws.
//
//   • По центру  → ratio [1:1]     (one centred divider)
//   • Равно N    → equal           (engine splits into equal parts; see note below)
//   • Свободно   → manual + at_mm10 (one divider at a chosen offset)
//   • axis: Вертикально = "x" (a vertical divider) · Горизонтально = "y" (a horizontal shelf)
//
// NOTE for P: DivideOpts has no `count`, so «Равно N» currently lands as the engine's default
// equal split (2). Exposing real N needs DivideOpts.count threaded to DivideMode — flagged in
// the kanban. Center + Свободно are fully live today.

import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import type { DivideOpts } from "../../store/appStore";
import { C, FONT, R } from "../../theme";

type Axis = "x" | "y";
type ModeKey = "center" | "equal" | "free";

export function DivideSheet({
  onApply,
  onClose,
}: {
  onApply: (opts: DivideOpts) => void;
  onClose: () => void;
}) {
  const [axis, setAxis] = useState<Axis>("x");
  const [mode, setMode] = useState<ModeKey>("center");
  const [count, setCount] = useState(2);
  const [posMm, setPosMm] = useState(300);

  const apply = () => {
    if (mode === "center") onApply({ axis, rule: "ratio" });
    else if (mode === "equal") onApply({ axis, rule: "equal" });
    else onApply({ axis, rule: "manual", at_mm10: posMm * 10 });
  };

  return (
    <View style={styles.sheet}>
      <View style={styles.grab} />
      <View style={styles.head}>
        <Text style={styles.title}>Разделить</Text>
        <Pressable style={styles.close} onPress={onClose} hitSlop={8}>
          <Text style={styles.closeG}>✕</Text>
        </Pressable>
      </View>

      <Text style={styles.k}>Направление</Text>
      <Segment
        options={[
          { key: "x", label: "Вертикально" },
          { key: "y", label: "Горизонтально" },
        ]}
        value={axis}
        onChange={(v) => setAxis(v as Axis)}
      />

      <Text style={styles.k}>Способ</Text>
      <Segment
        options={[
          { key: "center", label: "По центру" },
          { key: "equal", label: "Равно N" },
          { key: "free", label: "Свободно" },
        ]}
        value={mode}
        onChange={(v) => setMode(v as ModeKey)}
      />

      {mode === "equal" && (
        <Stepper label="Частей" value={count} min={2} max={6} step={1} unit="" onChange={setCount} />
      )}
      {mode === "free" && (
        <Stepper label="Отступ" value={posMm} min={50} max={2000} step={50} unit="мм" onChange={setPosMm} />
      )}

      <Pressable style={styles.cta} onPress={apply}>
        <Text style={styles.ctaT}>Применить</Text>
      </Pressable>
    </View>
  );
}

function Segment({
  options,
  value,
  onChange,
}: {
  options: { key: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.seg}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable key={o.key} style={[styles.o, on && styles.oOn]} onPress={() => onChange(o.key)}>
            <Text style={[styles.oT, on && styles.oTOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Stepper({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  return (
    <View style={styles.ctl}>
      <Text style={styles.k}>{label}</Text>
      <View style={styles.num}>
        <Pressable style={styles.pm} onPress={() => onChange(clamp(value - step))}>
          <Text style={styles.pmG}>−</Text>
        </Pressable>
        <View style={styles.v}>
          <Text style={styles.vT}>
            {value}
            {unit ? <Text style={styles.vU}> {unit}</Text> : null}
          </Text>
        </View>
        <Pressable style={styles.pm} onPress={() => onChange(clamp(value + step))}>
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
  oT: { fontFamily: FONT, fontSize: 13, fontWeight: "700", color: C.ink3 },
  oTOn: { color: C.ink },

  ctl: { marginTop: 4 },
  num: { flexDirection: "row", alignItems: "center", gap: 10 },
  v: { flex: 1, height: 48, borderWidth: 1, borderColor: C.line, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  vT: { fontFamily: FONT, fontSize: 18, fontWeight: "800", color: C.ink },
  vU: { fontFamily: FONT, fontSize: 12, color: C.ink2, fontWeight: "700" },
  pm: { width: 48, height: 48, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  pmG: { fontFamily: FONT, fontSize: 22, color: C.ink },

  cta: { height: 52, borderRadius: 14, backgroundColor: C.ink, alignItems: "center", justifyContent: "center", marginTop: 16 },
  ctaT: { fontFamily: FONT, fontSize: 15.5, fontWeight: "800", color: "#fff" },
});
