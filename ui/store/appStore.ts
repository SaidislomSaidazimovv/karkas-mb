// ui/store/appStore.ts — the SINGLE source of UI truth (Zustand). Owner: P.
//
// T1 (viewport) WRITES selection/lines via actions; T2 (panels) READS selection/mode
// and WRITES edits via actions. Neither imports the other — they meet here. This is what
// makes the two UI tracks "connected" without colliding.
//
// S3-E1 (store-wiring): the engine is LIVE. The store boots a real cabinet
// (buildDemoModel → solveStructure → solvePreview) so the canvas renders actual solved
// panels, and `tapPart` resolves a real adaptive selection (group-of-1 vs group-of-N) via
// the engine. Structural EDIT actions (divide/move/detach) wire to engine ops behind their
// stable signatures and re-derive the preview in one place (`derive`).

import { create } from "zustand";

import {
  addInstance,
  buildDemoModel,
  countExceptions,
  detachInstance,
  divideSection,
  exportModelToSWJ008,
  mergeSections,
  moveLine as engineMoveLine,
  reattachInstance,
  selectByTap,
  solveLayout,
  solvePreview,
  solveStructure,
} from "../engineBridge";
import type {
  Block,
  DivideMode,
  EngineSelection,
  InstanceId,
  LineId,
  PanelPlacement,
  Part,
  PartId,
  PreviewResult,
  Project,
  Scope,
  SectionId,
  StructuralModel,
} from "../engineBridge";

export type Mode = "build" | "material" | "hardware" | "frame";
export type ViewLens = "geometry" | "lines" | "glass" | "dimension";

/** Adaptive selection (CONSTRUCTION_FRAME_v3 §1): unique part vs real group (2+). */
export interface Selection {
  kind: "none" | "single" | "group";
  componentId?: string;
  sectionId?: SectionId; // the leaf section the selected instance(s) sit in (for divide/add)
  instanceIds: readonly InstanceId[];
  partIds: readonly PartId[];
  isUnique: boolean; // true = «Уникальная деталь» (no detach / no ✂ counter)
  exceptions: number; // ✂ N — only for real groups
}

export type DivideOpts = {
  axis: "x" | "y" | "z";
  rule: "manual" | "ratio" | "equal" | "fixed_mm";
  at_mm10?: number;
  count?: number; // for rule "equal" — number of equal parts (default 2)
};
export type AddKind = "shelf" | "rail" | "divider" | "drawer" | "door";

const NO_SELECTION: Selection = {
  kind: "none",
  instanceIds: [],
  partIds: [],
  isUnique: false,
  exceptions: 0,
};

// --- helpers: engine model walking + engine→store selection mapping ---------

function blockOfInstance(model: StructuralModel, instanceId: InstanceId): Block | null {
  for (const b of model.blocks) {
    if (b.instances.some((i) => i.id === instanceId)) return b;
  }
  return null;
}

/** The solved Part id for a placed instance — must match engine/structure/solve.ts. */
function instancePartId(blockId: string, instanceId: InstanceId): PartId {
  return `${blockId}__inst_${instanceId}`;
}

function toSelection(model: StructuralModel, sel: EngineSelection | null): Selection {
  if (!sel || sel.instanceIds.length === 0) return NO_SELECTION;
  const isUnique = sel.instanceIds.length <= 1;
  const first = sel.instanceIds[0]!;
  const block = blockOfInstance(model, first);
  const inst = block?.instances.find((i) => i.id === first);
  const partIds = block ? sel.instanceIds.map((id) => instancePartId(block.id, id)) : [];
  return {
    kind: isUnique ? "single" : "group",
    componentId: sel.componentId,
    sectionId: inst?.sectionId,
    instanceIds: sel.instanceIds,
    partIds,
    isUnique,
    exceptions: block ? countExceptions(block) : 0,
  };
}

/** Rough board-area price so the ticker shows a believable number (refined later). */
function estimatePrice(parts: readonly Part[]): number {
  let m2 = 0;
  for (const p of parts) m2 += (p.length_mm10 / 10) * (p.width_mm10 / 10) / 1_000_000;
  return Math.round(m2 * 800_000); // ~800k сум per m² of finished board
}

/** Solve a model into render preview + positioned scene + price (one place, in sync). */
function derive(model: StructuralModel): {
  preview: PreviewResult;
  scene: readonly PanelPlacement[];
  price_sum: number;
} {
  const parts = solveStructure(model);
  const project: Project = { id: model.id, name: model.name, parts };
  return {
    preview: solvePreview(project),
    scene: solveLayout(model), // positioned panels — the viewport renders this
    price_sum: estimatePrice(parts),
  };
}

/** Map the UI's DivideOpts to the engine's DivideMode (sensible defaults when unspecified). */
function toDivideMode(opts: DivideOpts): DivideMode {
  const axis = opts.axis;
  switch (opts.rule) {
    case "ratio":
      return { kind: "ratio", axis, ratio: [1, 1] };
    case "equal":
      return { kind: "equal", axis, count: Math.max(2, Math.round(opts.count ?? 2)) };
    case "fixed_mm":
      return { kind: "fixed", axis, step_mm10: opts.at_mm10 ?? 3000 };
    default: // "manual"
      return opts.at_mm10 != null
        ? { kind: "direct", axis, at_mm10: opts.at_mm10 }
        : { kind: "equal", axis, count: 2 };
  }
}

/** Re-resolve the current selection against a new model (keeps the card live after an edit). */
function reselect(model: StructuralModel, current: Selection): Selection {
  const pid = current.partIds[0];
  return pid ? toSelection(model, selectByTap(model, pid)) : NO_SELECTION;
}

// --- store -----------------------------------------------------------------

export interface AppState {
  model: StructuralModel | null;
  selection: Selection;
  mode: Mode;
  view: ViewLens[];
  price_sum: number;
  preview: PreviewResult | null;
  scene: readonly PanelPlacement[]; // positioned panels for the 3D viewport (T1 renders this)
  past: readonly StructuralModel[]; // undo stack (T1 HUD: enabled when past.length > 0)
  future: readonly StructuralModel[]; // redo stack
  hiddenIds: readonly PartId[]; // parts toggled off in the 3D view (Zone 5 eye) — view-only, NOT export
  layersOpen: boolean; // Zone 5 layers panel visible?

  tapPart(partId: PartId): void;
  clearSelection(): void;
  setMode(mode: Mode): void;
  toggleView(lens: ViewLens): void;
  toggleHidden(partId: PartId): void;
  showAll(): void;
  toggleLayers(): void;
  divide(sectionId: SectionId, opts: DivideOpts): void;
  moveLine(lineId: LineId, delta_mm10: number, scope: Scope): void;
  resize(partId: PartId, axis: "x" | "z", value_mm10: number): void;
  addPart(sectionId: SectionId, kind: AddKind): void;
  detach(instanceId: InstanceId): void;
  reattach(instanceId: InstanceId): void;
  merge(sectionIds: readonly SectionId[]): void;
  undo(): void;
  redo(): void;
  /** E1: drill the live model, run the safety gate, and emit a byte-exact SWJ008 cut file.
   *  Pure read (no state change) — the UI (U1 export button) triggers the download / share.
   *  Returns the failing gate codes instead of the file when validation blocks the export. */
  exportCutFile(): { ok: true; text: string } | { ok: false; error: string };
}

const HISTORY_CAP = 50;

/** Apply a structural edit: push the current model onto the undo stack, clear redo,
 *  swap in the new model, and re-derive preview/scene/price. */
function applyEdit(
  get: () => AppState,
  set: (partial: Partial<AppState>) => void,
  next: StructuralModel,
  keepSelection: boolean,
): void {
  const cur = get().model;
  set({
    past: cur ? [...get().past, cur].slice(-HISTORY_CAP) : get().past,
    future: [],
    model: next,
    selection: keepSelection ? reselect(next, get().selection) : NO_SELECTION,
    ...derive(next),
  });
}

const INITIAL_MODEL = buildDemoModel();

export const useApp = create<AppState>((set, get) => ({
  model: INITIAL_MODEL,
  selection: NO_SELECTION,
  mode: "build",
  view: ["geometry"],
  past: [],
  future: [],
  hiddenIds: [],
  layersOpen: false,
  ...derive(INITIAL_MODEL),

  tapPart(partId) {
    const m = get().model;
    if (!m) return;
    set({ selection: toSelection(m, selectByTap(m, partId)) });
  },
  clearSelection() {
    set({ selection: NO_SELECTION });
  },
  setMode(mode) {
    set({ mode });
  },
  toggleView(lens) {
    const v = get().view;
    set({ view: v.includes(lens) ? v.filter((l) => l !== lens) : [...v, lens] });
  },
  toggleHidden(partId) {
    const h = get().hiddenIds;
    set({ hiddenIds: h.includes(partId) ? h.filter((id) => id !== partId) : [...h, partId] });
  },
  showAll() {
    set({ hiddenIds: [] });
  },
  toggleLayers() {
    set({ layersOpen: !get().layersOpen });
  },

  // Structural edits — engine op → new model → applyEdit (history + re-derive in one place).
  divide(sectionId, opts) {
    const m = get().model;
    if (!m) return;
    try {
      const next = divideSection(m, sectionId, toDivideMode(opts));
      if (next === m) return; // engine no-op
      applyEdit(get, set, next, false);
    } catch {
      /* invalid divide (e.g. non-leaf) — ignore; UI guards normally prevent this */
    }
  },
  moveLine(lineId, delta_mm10, scope) {
    const m = get().model;
    if (!m) return;
    try {
      const next = engineMoveLine(m, lineId, delta_mm10, scope);
      if (next === m) return;
      applyEdit(get, set, next, true);
    } catch {
      /* ignore */
    }
  },
  resize(_partId, _axis, _value_mm10) {
    /* TODO: no engine resize op yet — a resize maps to a section/line edit (S3-E1 follow-up) */
  },
  addPart(sectionId, kind) {
    const m = get().model;
    if (!m) return;
    try {
      const next = addInstance(m, sectionId, kind);
      if (next === m) return; // unsupported kind → no-op
      applyEdit(get, set, next, false);
    } catch {
      /* ignore (e.g. non-leaf section) */
    }
  },
  detach(instanceId) {
    const m = get().model;
    if (!m) return;
    try {
      applyEdit(get, set, detachInstance(m, instanceId), true);
    } catch {
      /* ignore */
    }
  },
  reattach(instanceId) {
    const m = get().model;
    if (!m) return;
    try {
      applyEdit(get, set, reattachInstance(m, instanceId), true);
    } catch {
      /* ignore */
    }
  },
  merge(sectionIds) {
    const m = get().model;
    if (!m) return;
    try {
      const next = mergeSections(m, sectionIds);
      if (next === m) return; // no-op (< 2 ids)
      applyEdit(get, set, next, false);
    } catch {
      /* invalid merge (non-siblings / non-contiguous / non-leaf) — ignore; UI guards */
    }
  },

  undo() {
    const { past, model } = get();
    if (past.length === 0 || !model) return;
    const prev = past[past.length - 1]!;
    set({
      past: past.slice(0, -1),
      future: [model, ...get().future],
      model: prev,
      selection: NO_SELECTION,
      ...derive(prev),
    });
  },
  redo() {
    const { future, model } = get();
    if (future.length === 0 || !model) return;
    const nx = future[0]!;
    set({
      future: future.slice(1),
      past: [...get().past, model],
      model: nx,
      selection: NO_SELECTION,
      ...derive(nx),
    });
  },

  exportCutFile() {
    const m = get().model;
    if (!m) return { ok: false, error: "NO_MODEL" };
    try {
      return { ok: true, text: exportModelToSWJ008(m) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
}));
