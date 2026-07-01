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
import { usePanelUi } from "../sheets/panelUi";
import { C, FONT, R } from "../../theme";
import { CanvasScene } from "./CanvasScene";
import { DivideSheet } from "./DivideSheet";
import { ResizeSheet } from "./ResizeSheet";
import { MoveSheet } from "./MoveSheet";
import { DEMO_PREVIEW, layoutToScene, previewToScene, sceneDimsMm, type Orbit } from "./cabinet";
import type { DivideOpts } from "../../store/appStore";
import type { Scope, StructuralModel } from "../../engineBridge";

const AZ_STEP = 0.05; // rad per tick — yaw
const POL_STEP = 0.04; // rad per tick — pitch
const POL_MIN = 0.06;
const POL_MAX = 1.45;

export function CanvasView() {
  const sceneData = useApp((s) => s.scene);
  const model = useApp((s) => s.model);
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
  const moveLine = useApp((s) => s.moveLine);
  const merge = useApp((s) => s.merge);
  const toggleView = useApp((s) => s.toggleView);
  const undo = useApp((s) => s.undo);
  const redo = useApp((s) => s.redo);
  const loadLCorner = useApp((s) => s.loadLCorner);
  const loadStraight = useApp((s) => s.loadStraight);

  // Live assembled cabinet; demo carcass only if the store scene is somehow empty.
  const scene = useMemo(
    () => (sceneData.length > 0 ? layoutToScene(sceneData) : previewToScene(DEMO_PREVIEW)),
    [sceneData],
  );

  const [orbit, setOrbit] = useState<Orbit>([0.5, 0.6]);
  // The move/resize/divide sheets live in the SHARED single overlay slot (panelUi) — same slot as
  // add/export/menu/layers — so only one bottom panel is ever visible at a time.
  const overlay = usePanelUi((s) => s.overlay);
  const openOverlay = usePanelUi((s) => s.open);
  const closeOverlay = usePanelUi((s) => s.close);
  const divideOpen = overlay === "divide";
  const resizeOpen = overlay === "resize";
  const moveOpen = overlay === "move";
  // No bottom sheet open → the canvas may show its editing affordances; when a sheet owns the slot,
  // the on-canvas chips/handles/buttons hide so they don't pile up over the sheet.
  const canvasClear = overlay === "none";
  // Divider selection is UI-local: engine selectByTap resolves only component (instance) parts,
  // NOT divider parts (`…__div_<lineId>`), so we capture the tapped divider here to drive moveLine.
  const [moveDivId, setMoveDivId] = useState<string | null>(null);
  const dividerSel = moveDivId !== null;
  // Merge (blocker #2) is a UI-local multi-select: collect the leaf sections of tapped panels,
  // then `merge` the adjacent ones. Store selection isn't used (mutually exclusive with it).
  const [mergeMode, setMergeMode] = useState(false);
  const [mergeSel, setMergeSel] = useState<{ sec: string; part: string }[]>([]);

  const hasSel = selection.kind !== "none";
  const selPart = selection.partIds[0];
  const selBoard = selPart ? scene.boards.find((b) => b.id === selPart) : undefined;
  const canUndo = past.length > 0;
  const canRedo = future.length > 0;
  const showDims = view.includes("dimension");
  const dims = useMemo(() => sceneDimsMm(scene), [scene]);
  const mm = (m: number) => Math.round(m * 1000);
  // Shape (blocker #1): an L-corner model carries a footprint on some block; a plain box doesn't.
  const isLCorner = !!model && model.blocks.some((b) => !!b.footprint);

  // The block that owns the selected part — its box drives the resize steppers (E8 is
  // block-level: partId `<blockId>__…` → block). box is mm10; the sheet works in mm.
  const block = useMemo(
    () => (model ? model.blocks.find((b) => selPart?.startsWith(`${b.id}__`)) ?? model.blocks[0] : undefined),
    [model, selPart],
  );

  // ── seams to the store ──
  const applyResize = (axis: "x" | "z", newMm: number) => {
    // Structure-level: set the owning block's absolute width (x) / depth (z). mm → mm10.
    if (selPart) resize(selPart, axis, Math.round(newMm * 10));
  };
  const applyDivide = (opts: DivideOpts) => {
    // Real split: selection carries the leaf sectionId → engine divide → model/scene re-derive.
    if (selection.sectionId) divide(selection.sectionId, opts);
    closeOverlay();
  };
  const onOrbitDelta = (dPol: number, dAz: number) =>
    setOrbit(([p, a]) => [clamp(p + dPol, POL_MIN, POL_MAX), a + dAz]);

  // Route taps: merge-mode collects sections; a divider becomes the move target; else a selection.
  const handleTap = (id: string) => {
    if (mergeMode) {
      const sec = sectionOfPart(model, id);
      if (!sec) return; // only instance panels resolve to a leaf section
      setMergeSel((cur) =>
        cur.some((x) => x.sec === sec)
          ? cur.filter((x) => x.sec !== sec)
          : [...cur, { sec, part: id }],
      );
      return;
    }
    if (id.includes("__div_")) {
      setMoveDivId(id);
      tapPart(id); // engine returns null for dividers → clears the instance-selection (exclusive)
    } else {
      setMoveDivId(null);
      closeOverlay();
      tapPart(id);
    }
  };
  const applyMove = (delta_mm10: number, scope: Scope) => {
    const lineId = moveDivId?.split("__div_")[1];
    if (lineId) moveLine(lineId, delta_mm10, scope); // relative nudge; sections reflow, undo-able
  };
  const toggleMergeMode = () => {
    const entering = !mergeMode;
    setMergeMode(entering);
    setMergeSel([]);
    if (entering) {
      clearSelection();
      setMoveDivId(null);
      closeOverlay();
    }
  };
  const applyMerge = () => {
    merge(mergeSel.map((x) => x.sec)); // engine no-op if <2 or non-adjacent; undo-able
    setMergeSel([]);
    setMergeMode(false);
  };
  const deselectAll = () => {
    clearSelection();
    setMoveDivId(null);
    closeOverlay();
    setMergeMode(false);
    setMergeSel([]);
    closeOverlay();
    closeOverlay();
  };
  const onLoadLCorner = () => {
    if (isLCorner) return; // already L-corner
    loadLCorner(); // swaps to the L-corner model + clears history; the canvas re-renders it
    deselectAll();
  };
  const onLoadStraight = () => {
    if (!isLCorner) return; // already a plain box
    loadStraight(); // back to buildDemoModel + clears history (the L-corner round-trip)
    deselectAll();
  };

  return (
    <View style={styles.canvas}>
      <CanvasScene
        scene={scene}
        selectedIds={
          mergeMode ? mergeSel.map((x) => x.part) : moveDivId ? [moveDivId] : selection.partIds
        }
        onTapPart={handleTap}
        orbit={orbit}
        lenses={view}
        hiddenIds={hiddenIds}
        onOrbitDelta={onOrbitDelta}
      />

      {/* Overlay layer — taps pass through to the 3D except on the controls below. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {/* Shape selector (blocker #1) — switch the cabinet between a plain box and an L-corner. */}
        <View style={styles.shapeSel} pointerEvents="box-none">
          <Pressable style={[styles.shapeOpt, !isLCorner && styles.shapeOptOn]} onPress={onLoadStraight}>
            <Text style={[styles.shapeOptT, !isLCorner && styles.shapeOptTOn]}>▭ Прямой</Text>
          </Pressable>
          <Pressable style={[styles.shapeOpt, isLCorner && styles.shapeOptOn]} onPress={onLoadLCorner}>
            <Text style={[styles.shapeOptT, isLCorner && styles.shapeOptTOn]}>⌐ L-угол</Text>
          </Pressable>
        </View>

        {/* Merge mode toggle (Build) — collect adjacent sections, then «Объединить». */}
        {mode === "build" && canvasClear && (
          <Pressable
            style={[styles.mergePill, mergeMode && styles.mergePillOn]}
            onPress={toggleMergeMode}
          >
            <Text style={[styles.mergePillT, mergeMode && styles.mergePillTOn]}>⧉ Объединить</Text>
          </Pressable>
        )}

        {/* Info chip */}
        {!mergeMode && hasSel && canvasClear && (
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

        {/* Divider selected (UI-local) — chip + a single ↕ move handle. */}
        {dividerSel && canvasClear && (
          <View style={styles.chip}>
            <Text style={styles.chipT}>Перегородка</Text>
            <Text style={styles.chipS}>сдвиг разделителя</Text>
          </View>
        )}
        {dividerSel && canvasClear && (
          <View style={styles.handles} pointerEvents="box-none">
            <Handle glyph="↕" onPress={() => openOverlay("move")} />
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

        {/* Floating handles (⤢ resize) — appear on a selected part in Build mode, no sheet open.
            (↻ rotate / ↕ move have no engine op yet — omitted to avoid dead controls.) */}
        {hasSel && mode === "build" && canvasClear && (
          <View style={styles.handles} pointerEvents="box-none">
            <Handle glyph="⤢" onPress={() => openOverlay("resize")} />
          </View>
        )}

        {/* Divide (Build mode, real split needs a leaf section, no sheet open). */}
        {hasSel && mode === "build" && selection.sectionId && canvasClear && (
          <Pressable style={styles.divBtn} onPress={() => openOverlay("divide")}>
            <Text style={styles.divBtnT}>Разделить</Text>
          </Pressable>
        )}

        {/* Merge confirm / hint — while collecting sections. */}
        {mergeMode && mergeSel.length >= 2 && (
          <Pressable style={styles.mergeBtn} onPress={applyMerge}>
            <Text style={styles.mergeBtnT}>Объединить ({mergeSel.length})</Text>
          </Pressable>
        )}
        {mergeMode && mergeSel.length < 2 && (
          <View style={styles.mergeHint} pointerEvents="none">
            <Text style={styles.mergeHintT}>Выберите смежные секции · {mergeSel.length}</Text>
          </View>
        )}

        {/* HUD */}
        <View style={styles.hud} pointerEvents="box-none">
          <View style={styles.hudCluster}>
            <HudBtn glyph="◰" onPress={() => toggleView("geometry")} />
            <HudBtn glyph="⊘" onPress={deselectAll} dark />
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
          <DivideSheet onApply={applyDivide} onClose={() => closeOverlay()} />
        )}

        {/* Resize sheet — opens from the ⤢ handle; drives the owning block's width/depth. */}
        {resizeOpen && hasSel && block && (
          <ResizeSheet
            widthMm={Math.round(block.box.w / 10)}
            depthMm={Math.round(block.box.d / 10)}
            onResize={applyResize}
            onClose={() => closeOverlay()}
          />
        )}

        {/* Move sheet — opens from the divider's ↕ handle; nudges the line with a scope. */}
        {moveOpen && dividerSel && (
          <MoveSheet onMove={applyMove} onClose={() => closeOverlay()} />
        )}
      </View>
    </View>
  );
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** The leaf section an instance panel (`<blockId>__inst_<id>`) sits in, for merge collection. */
function sectionOfPart(model: StructuralModel | null, partId: string): string | undefined {
  if (!model) return undefined;
  for (const b of model.blocks) {
    const pref = `${b.id}__inst_`;
    if (partId.startsWith(pref)) {
      const instId = partId.slice(pref.length);
      return b.instances.find((i) => i.id === instId)?.sectionId;
    }
  }
  return undefined;
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

  shapeSel: {
    position: "absolute",
    top: 14,
    alignSelf: "center",
    flexDirection: "row",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.pill,
    padding: 4,
    gap: 4,
    shadowColor: "#141414",
    shadowOpacity: 0.09,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  shapeOpt: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: R.pill, alignItems: "center", justifyContent: "center" },
  shapeOptOn: { backgroundColor: C.ink },
  shapeOptT: { fontFamily: FONT, fontSize: 12.5, fontWeight: "800", color: C.ink3 },
  shapeOptTOn: { color: "#fff" },

  mergePill: {
    position: "absolute",
    top: 58,
    alignSelf: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.pill,
    paddingVertical: 8,
    paddingHorizontal: 15,
    shadowColor: "#141414",
    shadowOpacity: 0.09,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  mergePillOn: { backgroundColor: C.ink, borderColor: C.ink },
  mergePillT: { fontFamily: FONT, fontSize: 13, fontWeight: "800", color: C.ink3 },
  mergePillTOn: { color: "#fff" },
  mergeBtn: {
    position: "absolute",
    alignSelf: "center",
    bottom: 120,
    backgroundColor: C.selLine,
    borderRadius: R.pill,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  mergeBtnT: { fontFamily: FONT, color: "#fff", fontWeight: "800", fontSize: 14 },
  mergeHint: {
    position: "absolute",
    alignSelf: "center",
    bottom: 122,
    backgroundColor: "rgba(28,28,29,0.85)",
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  mergeHintT: { fontFamily: FONT, color: "#fff", fontSize: 12 },

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
