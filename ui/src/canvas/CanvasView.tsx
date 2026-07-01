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
import { useApp, targetSectionId } from "../../store/appStore";
import { usePanelUi } from "../sheets/panelUi";
import { C, FONT, R } from "../../theme";
import { CanvasScene } from "./CanvasScene";
import { DivideSheet } from "./DivideSheet";
import { ResizeSheet } from "./ResizeSheet";
import { MoveSheet } from "./MoveSheet";
import { DEMO_PREVIEW, layoutToScene, previewToScene, sceneDimsMm, sectionPicks, sectionAtPoint, type OrbitLike } from "./cabinet";
import type { DivideOpts } from "../../store/appStore";
import type { Scope, StructuralModel } from "../../engineBridge";


// Web-only: keep a touch-drag on the joystick from becoming a browser scroll/zoom before the
// PanResponder sees it (the reason it "did nothing" on a touchscreen). RN's ViewStyle has no
// touchAction, so this is cast; react-native-web forwards it straight to the DOM as CSS.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const JOY_NO_TOUCH_SCROLL: any = { touchAction: "none", userSelect: "none", cursor: "grab" };

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
  const selectSection = useApp((s) => s.selectSection);
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
  // Pickable interior leaf-section volumes (tap one → select that section for divide/add).
  const secPicks = useMemo(() => sectionPicks(model, sceneData), [model, sceneData]);

  // OrbitControls (in CanvasScene) owns the camera — drag to orbit, wheel/pinch to zoom. The joystick
  // nudges it through this ref.
  const controlsRef = useRef<OrbitLike | null>(null);
  // The move/resize/divide sheets live in the SHARED single overlay slot (panelUi) — same slot as
  // add/export/menu/layers — so only one bottom panel is ever visible at a time.
  const overlay = usePanelUi((s) => s.overlay);
  const openOverlay = usePanelUi((s) => s.open);
  const closeOverlay = usePanelUi((s) => s.close);
  const hint = usePanelUi((s) => s.hint);
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
  // The section Build verbs (divide/add) act on: the tapped leaf if any, else a sensible default
  // (a wall tap has no section — see targetSectionId). Lets «Разделить»/«Добавить» work from any tap.
  const divTarget = targetSectionId(model, selection);
  const applyDivide = (opts: DivideOpts) => {
    if (divTarget) divide(divTarget, opts);
    closeOverlay();
  };
  const resetCam = () => controlsRef.current?.reset();

  // Route taps: merge-mode collects sections; a divider becomes the move target; else a selection.
  const handleTap = (id: string, point?: [number, number, number]) => {
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
      return;
    }
    setMoveDivId(null);
    closeOverlay();
    // A shelf/door (instance) → select the component (resize/detach). A carcass wall → resolve the
    // interior SECTION behind the tap so «Разделить»/«Добавить» act exactly there; if the point
    // resolves to no section, fall back to the wall part (block-level resize still works).
    if (id.includes("__inst_")) {
      tapPart(id);
      return;
    }
    const sec = point ? sectionAtPoint(model, sceneData, scene.center, point) : undefined;
    if (sec) selectSection(sec);
    else tapPart(id);
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
        lenses={view}
        hiddenIds={hiddenIds}
        controlsRef={controlsRef}
        sectionPicks={mode === "build" ? secPicks : []}
        selectedSectionId={selection.partIds.length === 0 ? selection.sectionId : undefined}
      />

      {/* Overlay layer — taps pass through to the 3D except on the controls below. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {/* Transient hint toast — feedback for actions that need a precondition (e.g. select first). */}
        {hint ? (
          <View style={styles.toastWrap} pointerEvents="none">
            <View style={styles.toast}>
              <Text style={styles.toastT}>{hint}</Text>
            </View>
          </View>
        ) : null}
        {/* Shape selector (blocker #1) — switch box ↔ L-corner. Hidden while a sheet owns the slot. */}
        {canvasClear && (
          <View style={styles.shapeSel} pointerEvents="box-none">
            <Pressable style={[styles.shapeOpt, !isLCorner && styles.shapeOptOn]} onPress={onLoadStraight}>
              <Text style={[styles.shapeOptT, !isLCorner && styles.shapeOptTOn]}>▭ Прямой</Text>
            </Pressable>
            <Pressable style={[styles.shapeOpt, isLCorner && styles.shapeOptOn]} onPress={onLoadLCorner}>
              <Text style={[styles.shapeOptT, isLCorner && styles.shapeOptTOn]}>⌐ L-угол</Text>
            </Pressable>
          </View>
        )}

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

        {/* Divide (Build mode — acts on the tapped section or the default leaf; no sheet open). */}
        {hasSel && mode === "build" && divTarget && canvasClear && (
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

        {/* HUD — camera + history; hidden while a bottom sheet owns the slot (no float-over). */}
        {canvasClear && (
        <View style={styles.hud} pointerEvents="box-none">
          <View style={styles.hudCluster}>
            {/* Reset the camera to the default 3/4 view. */}
            <HudBtn glyph="⌂" onPress={resetCam} />
            <HudBtn glyph="⊘" onPress={deselectAll} dark />
          </View>

          {/* Undo/redo — wired to the store history; disabled when the stack is empty. */}
          <View style={[styles.hudCluster, styles.hudRight]}>
            <HudBtn glyph="↺" onPress={undo} disabled={!canUndo} />
            <HudBtn glyph="↻" onPress={redo} disabled={!canRedo} />
          </View>

          {/* Joystick — its own component so its pointer bindings mount/unmount WITH the HUD. (The
              HUD unmounts whenever a bottom sheet opens; a one-shot effect on the parent would bind
              to a dead DOM node after the first modal and the stick would go silent — the "joystick
              stops working after a modal" bug.) Absolute-centred + zIndex so the knob sits above the
              HUD cluster rows. */}
          <Joystick controlsRef={controlsRef} />
        </View>
        )}

        {/* Divide modes sheet — opens over the HUD when «Разделить» is tapped. */}
        {divideOpen && hasSel && mode === "build" && divTarget && (
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

// A REAL analog joystick (like a game controller): press anywhere on the base, the knob slides
// toward your finger (clamped inside the ring), and the camera orbits CONTINUOUSLY in that
// direction for as long as you hold — push further = orbit faster. Release → the knob springs back
// to centre and motion stops. Horizontal push → yaw, vertical → pitch (up = tilt toward the top).
//
// It is a component (not inline in CanvasView) so its pointer bindings mount and unmount WITH the
// HUD: every time a bottom sheet opens the HUD unmounts, and this effect cleans up; when it closes
// the HUD remounts and the effect re-binds to the fresh DOM node. Raw DOM pointer events + capture
// (RN PanResponder is unreliable on web) drive a rAF loop; the knob moves via a direct CSS transform.
function Joystick({ controlsRef }: { controlsRef: React.RefObject<OrbitLike | null> }) {
  const baseRef = useRef<any>(null);
  const knobRef = useRef<any>(null);
  const vec = useRef({ x: 0, y: 0 }); // normalised push -1..1 while held
  const held = useRef(false);
  useEffect(() => {
    const base = baseRef.current;
    if (!base || typeof base.addEventListener !== "function") return; // native → no-op
    const knob = knobRef.current;
    const MAX = 32; // px the knob can travel from centre
    const SPEED = 0.03; // rad per frame at full push
    let raf = 0;
    const moveKnob = (px: number, py: number) => {
      if (knob) knob.style.transform = `translate(${px}px, ${py}px)`;
    };
    const nudge = (dPol: number, dAz: number) => {
      const c = controlsRef.current;
      if (!c) return;
      c.setPolarAngle(clamp(c.getPolarAngle() + dPol, 0.12, Math.PI * 0.49));
      c.setAzimuthalAngle(c.getAzimuthalAngle() + dAz);
      c.update();
    };
    const loop = () => {
      if (!held.current) return;
      const v = vec.current;
      nudge(v.y * SPEED, v.x * SPEED);
      raf = requestAnimationFrame(loop);
    };
    const compute = (e: PointerEvent) => {
      const r = base.getBoundingClientRect();
      let dx = e.clientX - (r.x + r.width / 2);
      let dy = e.clientY - (r.y + r.height / 2);
      const mag = Math.hypot(dx, dy);
      if (mag > MAX) {
        dx = (dx / mag) * MAX;
        dy = (dy / mag) * MAX;
      }
      moveKnob(dx, dy);
      vec.current = { x: dx / MAX, y: dy / MAX };
    };
    const onDown = (e: PointerEvent) => {
      held.current = true;
      if (knob) knob.style.transition = "none";
      try {
        base.setPointerCapture(e.pointerId);
      } catch {
        /* no capture → document-level pointermove still fires */
      }
      compute(e);
      e.preventDefault();
      e.stopPropagation();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
    };
    const onMove = (e: PointerEvent) => {
      if (!held.current) return;
      compute(e);
      e.preventDefault();
    };
    const onUp = (e: PointerEvent) => {
      held.current = false;
      vec.current = { x: 0, y: 0 };
      if (knob) {
        knob.style.transition = "transform 0.16s ease-out";
        moveKnob(0, 0);
      }
      try {
        base.releasePointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
      cancelAnimationFrame(raf);
    };
    base.addEventListener("pointerdown", onDown);
    base.addEventListener("pointermove", onMove);
    base.addEventListener("pointerup", onUp);
    base.addEventListener("pointercancel", onUp);
    return () => {
      cancelAnimationFrame(raf);
      base.removeEventListener("pointerdown", onDown);
      base.removeEventListener("pointermove", onMove);
      base.removeEventListener("pointerup", onUp);
      base.removeEventListener("pointercancel", onUp);
    };
  }, [controlsRef]);

  return (
    <View ref={baseRef} style={[styles.joy, JOY_NO_TOUCH_SCROLL]}>
      <Text style={[styles.joyMark, styles.joyUp]} pointerEvents="none">▲</Text>
      <Text style={[styles.joyMark, styles.joyDn]} pointerEvents="none">▼</Text>
      <Text style={[styles.joyMark, styles.joyLf]} pointerEvents="none">◀</Text>
      <Text style={[styles.joyMark, styles.joyRt]} pointerEvents="none">▶</Text>
      <View ref={knobRef} style={styles.knob} pointerEvents="none" />
    </View>
  );
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
  toastWrap: { position: "absolute", top: 76, left: 0, right: 0, alignItems: "center", zIndex: 40 },
  toast: {
    maxWidth: "82%",
    backgroundColor: "rgba(20,20,20,0.9)", paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999,
  },
  toastT: { fontFamily: FONT, fontSize: 12.5, fontWeight: "700", color: "#fff", textAlign: "center" },

  chip: {
    position: "absolute",
    left: 14,
    bottom: 128, // above the HUD, clear of the left rail + top shape-selector (was top:14 → behind rail)
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
    zIndex: 30, // paint above the HUD clusters so the knob is the topmost hit target
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderWidth: 1,
    borderColor: "rgba(180,180,178,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  knob: { width: 50, height: 50, borderRadius: 999, backgroundColor: "#fff", borderWidth: 2, borderColor: "rgba(150,150,148,0.55)", shadowColor: "#141414", shadowOpacity: 0.2, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
  joyMark: {
    position: "absolute",
    width: 20,
    textAlign: "center",
    color: "#b2b2b0",
    fontSize: 12,
  },
  joyUp: { top: 6, left: "50%", marginLeft: -10 },
  joyDn: { bottom: 6, left: "50%", marginLeft: -10 },
  joyLf: { left: 8, top: "50%", marginTop: -8 },
  joyRt: { right: 8, top: "50%", marginTop: -8 },
});
