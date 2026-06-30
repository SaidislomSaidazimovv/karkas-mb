// src/rail/Rail.tsx — Zone 2: the mode + view rail (design: construction-v3-preview.html §2).
// OWNER: T1. Two stacked segments on the left edge of the canvas:
//   seg 1 — the 4 modes (Build / Material / Hardware / Frame) + a reserved "+" slot;
//   seg 2 — stackable view lenses (Geometry / Glass / Dimension).
// Modes are exclusive (setMode); lenses toggle independently (toggleView). Glyph icons are
// placeholders for the shared vector set — the layout, tokens and states match the design.

import { View, Text, Pressable, StyleSheet } from "react-native";
import { useApp, type Mode, type ViewLens } from "../../store/appStore";
import { C, FONT } from "../../theme";

const MODES: { key: Mode; glyph: string }[] = [
  { key: "build", glyph: "▦" },
  { key: "material", glyph: "◧" },
  { key: "hardware", glyph: "⬡" },
  { key: "frame", glyph: "▥" },
];

const LENSES: { key: ViewLens; glyph: string }[] = [
  { key: "geometry", glyph: "◰" },
  { key: "lines", glyph: "≣" },
  { key: "glass", glyph: "◇" },
  { key: "dimension", glyph: "⊏" },
];

export function Rail() {
  const mode = useApp((s) => s.mode);
  const view = useApp((s) => s.view);
  const setMode = useApp((s) => s.setMode);
  const toggleView = useApp((s) => s.toggleView);

  return (
    <View style={styles.rail}>
      <View style={styles.seg}>
        {MODES.map((m) => (
          <RButton key={m.key} glyph={m.glyph} on={mode === m.key} onPress={() => setMode(m.key)} />
        ))}
        <View style={styles.gap}>
          <Text style={styles.gapT}>+</Text>
        </View>
      </View>

      <View style={styles.seg}>
        {LENSES.map((l) => (
          <RButton
            key={l.key}
            glyph={l.glyph}
            on={view.includes(l.key)}
            onPress={() => toggleView(l.key)}
          />
        ))}
      </View>
    </View>
  );
}

function RButton({ glyph, on, onPress }: { glyph: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.rbtn, on && styles.rbtnOn]} onPress={onPress}>
      <Text style={[styles.rbtnG, on && styles.rbtnGOn]}>{glyph}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rail: { position: "absolute", left: 12, top: 14, gap: 9, zIndex: 6 },
  seg: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 16,
    padding: 6,
    gap: 4,
    shadowColor: "#141414",
    shadowOpacity: 0.07,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  rbtn: {
    width: 42,
    height: 42,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  rbtnOn: { backgroundColor: C.ink },
  rbtnG: { fontFamily: FONT, fontSize: 20, color: C.ink3 },
  rbtnGOn: { color: "#fff" },
  gap: {
    height: 42,
    borderWidth: 1.5,
    borderColor: C.line,
    borderStyle: "dashed",
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  gapT: { fontFamily: FONT, fontSize: 16, fontWeight: "700", color: "#c3c1bb" },
});
