// src/canvas/CanvasView.tsx — Zone 4: the 3D cabinet interior + its on-canvas overlays.
// OWNER: T1. Reads `preview`/`selection`/`mode` from the store and writes back through
// `tapPart`/`resize`/`divide`. The 3D itself lives in CanvasScene (web=r3f, native=fallback);
// here we add the RN overlays the frame calls for: info chip, floating handles (↻/↕/⤢),
// the divide guide, and the HUD. Overlays sit above the canvas with pointerEvents="box-none"
// so empty taps fall through to the 3D and deselect / select.
//
// Pre-S3-E1 note: store.preview is null until the solver lands, so we render DEMO_PREVIEW;
// the same code renders the real cabinet the moment preview turns non-null. Likewise the
// structural actions (divide/resize) are stable but stubbed in the store until S3-E1 — the
// seams below are wired now so they go live with no UI change.

import { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useApp } from "../../store/appStore";
import { C, FONT, R } from "../../theme";
import { CanvasScene } from "./CanvasScene";
import { DEMO_PREVIEW, previewToScene } from "./cabinet";

export function CanvasView() {
  const preview = useApp((s) => s.preview);
  const selection = useApp((s) => s.selection);
  const mode = useApp((s) => s.mode);
  const tapPart = useApp((s) => s.tapPart);
  const clearSelection = useApp((s) => s.clearSelection);
  const resize = useApp((s) => s.resize);
  const divide = useApp((s) => s.divide);
  const toggleView = useApp((s) => s.toggleView);

  // Real solver output when present (S3-E1+), else the demo carcass so the viewport lives.
  const scene = useMemo(() => previewToScene(preview ?? DEMO_PREVIEW), [preview]);
  const hasSel = selection.kind !== "none";
  const selPart = selection.partIds[0];

  // ── seams to the store (stable signatures; engine wiring = S3-E1) ──
  const onResize = () => {
    if (!selPart) return;
    const b = scene.boards.find((x) => x.id === selPart);
    if (!b) return;
    // Tangible nudge: grow depth by 10mm. Absolute value in mm10 (metres*10000).
    resize(selPart, "z", Math.round(b.size[2] * 10_000) + 100);
  };
  const onDivide = () => {
    if (!selPart) return;
    // TODO S3-E1: the selected Section comes from selectByTap (selection has no sectionId
    // in the contract yet). Until then we pass a derived placeholder — the stub ignores it,
    // and once the store maps selection→section this becomes a real vertical split.
    divide(`section-of-${selPart}`, { axis: "x", rule: "manual" });
  };

  return (
    <View style={styles.canvas}>
      <CanvasScene scene={scene} selectedIds={selection.partIds} onTapPart={tapPart} />

      {/* Overlay layer — taps pass through to the 3D except on the controls below. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {/* Info chip (Zone 4) */}
        {hasSel && (
          <View style={styles.chip}>
            <Text style={styles.chipT}>{selection.isUnique ? "Уникальная деталь" : "Тип"}</Text>
            <Text style={styles.chipS}>
              {selection.isUnique
                ? "своя деталь"
                : `${selection.partIds.length} ${plural(selection.partIds.length)} выделено`}
            </Text>
          </View>
        )}

        {/* Floating handles (↻ rotate · ↕ up/down · ⤢ resize) — appear on selection. */}
        {hasSel && (
          <View style={styles.handles} pointerEvents="box-none">
            <Handle glyph="↻" onPress={() => {/* TODO: rotate op (no engine rotate yet) */}} />
            <Handle glyph="↕" onPress={() => {/* TODO: reposition op (no engine move yet) */}} />
            <Handle glyph="⤢" onPress={onResize} />
          </View>
        )}

        {/* Divide gesture (Build mode) — center guide + action. */}
        {hasSel && mode === "build" && (
          <>
            <View style={styles.divGuide} pointerEvents="none" />
            <Pressable style={styles.divBtn} onPress={onDivide}>
              <Text style={styles.divBtnT}>Разделить</Text>
            </Pressable>
          </>
        )}

        {/* HUD */}
        <View style={styles.hud} pointerEvents="box-none">
          <View style={styles.hudCluster}>
            <HudBtn glyph="◰" onPress={() => toggleView("geometry")} />
            <HudBtn glyph="⊘" onPress={clearSelection} dark />
          </View>
          {/* Joystick — visual placeholder for camera orbit (S3 follow-up). */}
          <View style={styles.joy} pointerEvents="none">
            <Text style={[styles.joyAr, styles.joyUp]}>▲</Text>
            <Text style={[styles.joyAr, styles.joyDn]}>▼</Text>
            <Text style={[styles.joyAr, styles.joyLf]}>◀</Text>
            <Text style={[styles.joyAr, styles.joyRt]}>▶</Text>
            <View style={styles.knob} />
          </View>
          {/* Undo/redo — placeholders until the store grows a history (S3 follow-up). */}
          <View style={[styles.hudCluster, styles.hudRight]}>
            <HudBtn glyph="↶" onPress={() => {}} dim />
            <HudBtn glyph="↷" onPress={() => {}} dim />
          </View>
        </View>
      </View>
    </View>
  );
}

function plural(n: number): string {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "деталь";
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "детали";
  return "деталей";
}

function Handle({ glyph, onPress }: { glyph: string; onPress: () => void }) {
  return (
    <Pressable style={styles.handle} onPress={onPress}>
      <Text style={styles.handleG}>{glyph}</Text>
    </Pressable>
  );
}

function HudBtn({
  glyph,
  onPress,
  dark,
  dim,
}: {
  glyph: string;
  onPress: () => void;
  dark?: boolean;
  dim?: boolean;
}) {
  return (
    <Pressable
      style={[styles.htool, dark && styles.htoolDark, dim && styles.htoolDim]}
      onPress={onPress}
    >
      <Text style={[styles.htoolG, dark && styles.htoolGDark]}>{glyph}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1, position: "relative", backgroundColor: C.chrome, overflow: "hidden" },

  chip: {
    position: "absolute",
    left: 14,
    top: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 13,
    paddingVertical: 9,
    paddingHorizontal: 12,
    minWidth: 150,
    shadowColor: "#141414",
    shadowOpacity: 0.09,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  chipT: { fontFamily: FONT, fontSize: 13.5, fontWeight: "800", color: C.ink },
  chipS: { fontFamily: FONT, fontSize: 11.5, color: C.ink2, marginTop: 2 },

  handles: { position: "absolute", right: 14, top: 120, gap: 12 },
  handle: {
    width: 46,
    height: 46,
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: C.line,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#141414",
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  handleG: { fontFamily: FONT, fontSize: 22, color: C.ink },

  divGuide: {
    position: "absolute",
    left: "50%",
    top: "20%",
    bottom: "26%",
    width: 2,
    marginLeft: -1,
    backgroundColor: C.selLine,
    opacity: 0.8,
  },
  divBtn: {
    position: "absolute",
    alignSelf: "center",
    bottom: 120,
    backgroundColor: C.ink,
    borderRadius: R.pill,
    paddingVertical: 9,
    paddingHorizontal: 18,
  },
  divBtnT: { fontFamily: FONT, color: "#fff", fontWeight: "800", fontSize: 13.5 },

  hud: { position: "absolute", left: 0, right: 0, bottom: 14, height: 104 },
  hudCluster: { position: "absolute", left: 14, bottom: 0, flexDirection: "row", gap: 9 },
  hudRight: { left: undefined, right: 14 },
  htool: {
    width: 50,
    height: 50,
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: C.line,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#141414",
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  htoolDark: { backgroundColor: C.ink, borderColor: C.ink },
  htoolDim: { opacity: 0.45 },
  htoolG: { fontFamily: FONT, fontSize: 22, color: C.ink },
  htoolGDark: { color: "#fff" },

  joy: {
    position: "absolute",
    left: "50%",
    marginLeft: -52,
    bottom: -4,
    width: 104,
    height: 104,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderWidth: 1,
    borderColor: "rgba(180,180,178,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  knob: { width: 38, height: 38, borderRadius: 999, backgroundColor: "#fff" },
  joyAr: { position: "absolute", color: "#9a9a98", fontSize: 13 },
  joyUp: { top: 6 },
  joyDn: { bottom: 6 },
  joyLf: { left: 9 },
  joyRt: { right: 9 },
});
