// src/canvas/CanvasView.tsx — Zone 4: the assembled 3D cabinet + its on-canvas overlays.
// OWNER: T1. The engine is LIVE (S3-E1): we render the store's `scene` (positioned panels
// from solveLayout) and write back through real actions:
//   • tap a panel → tapPart → adaptive selection (group-of-1 / group-of-N) highlights in 3D
//   • Разделить   → divide(selection.sectionId) → new model → preview/scene re-derive → redraw
// The 3D lives in CanvasScene (web=r3f, native=fallback); here we add the RN overlays the
// frame calls for: info chip, floating handles (↻/↕/⤢), the divide guide, and the HUD whose
// joystick orbits the camera. Overlays use pointerEvents="box-none" so empty taps fall
// through to the 3D. DEMO_PREVIEW shows only if the live scene is ever empty.

import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useApp } from "../../store/appStore";
import { C, FONT, R } from "../../theme";
import { CanvasScene } from "./CanvasScene";
import { DivideSheet } from "./DivideSheet";
import { DEMO_PREVIEW, layoutToScene, previewToScene, sceneDimsMm, type Orbit } from "./cabinet";
import type { DivideOpts } from "../../store/appStore";

const AZ_STEP = 0.05; // rad per tick — yaw
const POL_STEP = 0.04; // rad per tick — pitch
const POL_MIN = 0.06;
const POL_MAX = 1.45;

export function CanvasView() {
  const sceneData = useApp((s) => s.scene);
  const selection = useApp((s) => s.selection);
  const mode = useApp((s) => s.mode);
  const view = useApp((s) => s.view);
  const past = useApp((s) => s.past);
  const future = useApp((s) => s.future);
  const hiddenIds = useApp((s) => s.hiddenIds);
  const tapPart = useApp((s) => s.tapPart);
  const clearSelection = useApp((s) => s.clearSelection);
  const resize = useApp((s) => s.resize);
  const divide = useApp((s) => s.divide);
  const toggleView = useApp((s) => s.toggleView);
  const undo = useApp((s) => s.undo);
  const redo = useApp((s) => s.redo);

  // Live assembled cabinet; demo carcass only if the store scene is somehow empty.
  const scene = useMemo(
    () => (sceneData.length > 0 ? layoutToScene(sceneData) : previewToScene(DEMO_PREVIEW)),
    [sceneData],
  );

  const [orbit, setOrbit] = useState<Orbit>([0.5, 0.6]);
  const [divideOpen, setDivideOpen] = useState(false);

  const hasSel = selection.kind !== "none";
  const selPart = selection.partIds[0];
  const selBoard = selPart ? scene.boards.find((b) => b.id === selPart) : undefined;
  const canUndo = past.length > 0;
  const canRedo = future.length > 0;
  const showDims = view.includes("dimension");
  const dims = useMemo(() => sceneDimsMm(scene), [scene]);
  const mm = (m: number) => Math.round(m * 1000);

  // ── seams to the store ──
  const onResize = () => {
    if (!selBoard) return;
    // Tangible nudge: grow depth by 10mm (absolute mm10 = metres*10000). Wires resize; the
    // engine resize op lands in an S3-E1 follow-up, then this is a live edit.
    resize(selBoard.id, "z", Math.round(selBoard.size[2] * 10_000) + 100);
  };
  const applyDivide = (opts: DivideOpts) => {
    // Real split: selection carries the leaf sectionId → engine divide → model/scene re-derive.
    if (selection.sectionId) divide(selection.sectionId, opts);
    setDivideOpen(false);
  };
  const onOrbitDelta = (dPol: number, dAz: number) =>
    setOrbit(([p, a]) => [clamp(p + dPol, POL_MIN, POL_MAX), a + dAz]);

  return (
    <View style={styles.canvas}>
      <CanvasScene
        scene={scene}
        selectedIds={selection.partIds}
        onTapPart={tapPart}
        orbit={orbit}
        lenses={view}
        hiddenIds={hiddenIds}
        onOrbitDelta={onOrbitDelta}
      />

      {/* Overlay layer — taps pass through to the 3D except on the controls below. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {/* Info chip */}
        {hasSel && (
          <View style={styles.chip}>
            <Text style={styles.chipT}>
              {selBoard?.name ?? (selection.isUnique ? "Деталь" : "Тип")}
            </Text>
            <Text style={styles.chipS}>
              {selection.isUnique
                ? "своя деталь"
                : `${selection.partIds.length} ${plural(selection.partIds.length)} выделено`}
            </Text>
          </View>
        )}

        {/* Dimension lens — overall cabinet size (+ selected panel) readout. */}
        {showDims && (
          <View style={styles.dimBadge} pointerEvents="none">
            <Text style={styles.dimT}>{dims.w} × {dims.h} × {dims.d} мм</Text>
            {selBoard && (
              <Text style={styles.dimS}>
                деталь {mm(selBoard.size[0])} × {mm(selBoard.size[1])} × {mm(selBoard.size[2])}
              </Text>
            )}
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

        {/* Divide gesture (Build mode, real split needs a leaf section). */}
        {hasSel && mode === "build" && selection.sectionId && (
          <>
            {divideOpen && <View style={styles.divGuide} pointerEvents="none" />}
            {!divideOpen && (
              <Pressable style={styles.divBtn} onPress={() => setDivideOpen(true)}>
                <Text style={styles.divBtnT}>Разделить</Text>
              </Pressable>
            )}
          </>
        )}

        {/* HUD */}
        <View style={styles.hud} pointerEvents="box-none">
          <View style={styles.hudCluster}>
            <HudBtn glyph="◰" onPress={() => toggleView("geometry")} />
            <HudBtn glyph="⊘" onPress={clearSelection} dark />
          </View>

          {/* Joystick — press-and-hold to orbit the camera around the cabinet. */}
          <View style={styles.joy} pointerEvents="box-none">
            <JoyArrow
              style={styles.joyUp}
              glyph="▲"
              onChange={() => setOrbit(([p, a]) => [clamp(p + POL_STEP, POL_MIN, POL_MAX), a])}
            />
            <JoyArrow
              style={styles.joyDn}
              glyph="▼"
              onChange={() => setOrbit(([p, a]) => [clamp(p - POL_STEP, POL_MIN, POL_MAX), a])}
            />
            <JoyArrow
              style={styles.joyLf}
              glyph="◀"
              onChange={() => setOrbit(([p, a]) => [p, a - AZ_STEP])}
            />
            <JoyArrow
              style={styles.joyRt}
              glyph="▶"
              onChange={() => setOrbit(([p, a]) => [p, a + AZ_STEP])}
            />
            <View style={styles.knob} pointerEvents="none" />
          </View>

          {/* Undo/redo — wired to the store history; disabled when the stack is empty. */}
          <View style={[styles.hudCluster, styles.hudRight]}>
            <HudBtn glyph="↶" onPress={undo} disabled={!canUndo} />
            <HudBtn glyph="↷" onPress={redo} disabled={!canRedo} />
          </View>
        </View>

        {/* Divide modes sheet — opens over the HUD when «Разделить» is tapped. */}
        {divideOpen && hasSel && mode === "build" && selection.sectionId && (
          <DivideSheet onApply={applyDivide} onClose={() => setDivideOpen(false)} />
        )}
      </View>
    </View>
  );
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function plural(n: number): string {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "деталь";
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "детали";
  return "деталей";
}

/** A joystick arrow that fires `onChange` continuously while held. */
function JoyArrow({
  glyph,
  style,
  onChange,
}: {
  glyph: string;
  style: object;
  onChange: () => void;
}) {
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stop = () => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  };
  useEffect(() => stop, []);
  return (
    <Pressable
      style={[styles.joyAr, style]}
      onPressIn={() => {
        onChange();
        timer.current = setInterval(onChange, 30);
      }}
      onPressOut={stop}
    >
      <Text style={styles.joyArT}>{glyph}</Text>
    </Pressable>
  );
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
  disabled,
}: {
  glyph: string;
  onPress: () => void;
  dark?: boolean;
  dim?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      style={[styles.htool, dark && styles.htoolDark, (dim || disabled) && styles.htoolDim]}
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

  dimBadge: {
    position: "absolute",
    right: 14,
    top: 14,
    backgroundColor: "rgba(28,28,29,0.9)",
    borderRadius: 11,
    paddingVertical: 7,
    paddingHorizontal: 11,
    alignItems: "flex-end",
  },
  dimT: { fontFamily: FONT, fontSize: 12.5, fontWeight: "800", color: "#fff" },
  dimS: { fontFamily: FONT, fontSize: 10.5, color: "#cfcdc8", marginTop: 2 },

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
  joyAr: {
    position: "absolute",
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  joyArT: { color: "#9a9a98", fontSize: 13 },
  joyUp: { top: 4, left: "50%", marginLeft: -13 },
  joyDn: { bottom: 4, left: "50%", marginLeft: -13 },
  joyLf: { left: 6, top: "50%", marginTop: -13 },
  joyRt: { right: 6, top: "50%", marginTop: -13 },
});
