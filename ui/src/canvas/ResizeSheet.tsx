// src/canvas/ResizeSheet.tsx — the ⤢ resize control (CONSTRUCTION_FRAME_v3 Piece 1, L6). OWNER: T1.
// A bottom sheet with Ширина (x) + Глубина (z) steppers for the selected panel's OWNING BLOCK.
// This is a STRUCTURE-level edit: the engine (resizeBlockWidth/Depth, E8) keeps the 16mm sides
// and reflows the inner span + dividers; each step lands on the undo stack.
//
// Controlled component — it shows the live block dimensions (mm) passed in and calls onResize
// with the new ABSOLUTE dimension; the re-derived model flows straight back as the next value,
// so there is no local drift. Height (y) is not a structure-resize axis in the engine.

import { View, Text, Pressable, StyleSheet } from "react-native";
import { C, FONT, R } from "../../theme";

const MIN_MM = 150;
const MAX_MM = 3000;
const STEP_MM = 10;

export function ResizeSheet({
  widthMm,
  depthMm,
  onResize,
  onClose,
}: {
  widthMm: number;
  depthMm: number;
  onResize: (axis: "x" | "z", newMm: number) => void;
  onClose: () => void;
}) {
  return (
    <View style={styles.sheet}>
      <View style={styles.grab} />
      <View style={styles.head}>
        <Text style={styles.title}>Размер</Text>
        <Pressable style={styles.close} onPress={onClose} hitSlop={8}>
          <Text style={styles.closeG}>✕</Text>
        </Pressable>
      </View>

      <DimStepper label="Ширина" value={widthMm} onChange={(v) => onResize("x", v)} />
      <DimStepper label="Глубина" value={depthMm} onChange={(v) => onResize("z", v)} />

      <Text style={styles.hint}>Боковины 16 мм сохраняются — тянется внутренний просвет.</Text>
    </View>
  );
}

function DimStepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const clamp = (v: number) => Math.max(MIN_MM, Math.min(MAX_MM, v));
  return (
    <View style={styles.ctl}>
      <Text style={styles.k}>{label}</Text>
      <View style={styles.num}>
        <Pressable style={styles.pm} onPress={() => onChange(clamp(value - STEP_MM))}>
          <Text style={styles.pmG}>−</Text>
        </Pressable>
        <View style={styles.v}>
          <Text style={styles.vT}>
            {value}
            <Text style={styles.vU}> мм</Text>
          </Text>
        </View>
        <Pressable style={styles.pm} onPress={() => onChange(clamp(value + STEP_MM))}>
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
  ctl: { marginTop: 4 },
  num: { flexDirection: "row", alignItems: "center", gap: 10 },
  v: { flex: 1, height: 48, borderWidth: 1, borderColor: C.line, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  vT: { fontFamily: FONT, fontSize: 18, fontWeight: "800", color: C.ink },
  vU: { fontFamily: FONT, fontSize: 12, color: C.ink2, fontWeight: "700" },
  pm: { width: 48, height: 48, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  pmG: { fontFamily: FONT, fontSize: 22, color: C.ink },

  hint: { fontFamily: FONT, fontSize: 11.5, color: C.ink2, marginTop: 14, lineHeight: 16 },
});
