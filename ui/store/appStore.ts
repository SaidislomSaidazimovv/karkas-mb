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
  buildDemoModel,
  countExceptions,
  detachInstance,
  divideSection,
  moveLine as engineMoveLine,
  reattachInstance,
  selectByTap,
  solvePreview,
  solveStructure,
} from "../engineBridge";
import type {
  Block,
  DivideMode,
  EngineSelection,
  InstanceId,
  LineId,
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

/** Solve a model into the render preview + price (one place, so every edit stays in sync). */
function derive(model: StructuralModel): { preview: PreviewResult; price_sum: number } {
  const parts = solveStructure(model);
  const project: Project = { id: model.id, name: model.name, parts };
  return { preview: solvePreview(project), price_sum: estimatePrice(parts) };
}

/** Map the UI's DivideOpts to the engine's DivideMode (sensible defaults when unspecified). */
function toDivideMode(opts: DivideOpts): DivideMode {
  const axis = opts.axis;
  switch (opts.rule) {
    case "ratio":
      return { kind: "ratio", axis, ratio: [1, 1] };
    case "equal":
      return { kind: "equal", axis, count: 2 };
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

  tapPart(partId: PartId): void;
  clearSelection(): void;
  setMode(mode: Mode): void;
  toggleView(lens: ViewLens): void;
  divide(sectionId: SectionId, opts: DivideOpts): void;
  moveLine(lineId: LineId, delta_mm10: number, scope: Scope): void;
  resize(partId: PartId, axis: "x" | "z", value_mm10: number): void;
  addPart(sectionId: SectionId, kind: AddKind): void;
  detach(instanceId: InstanceId): void;
  reattach(instanceId: InstanceId): void;
  merge(sectionIds: readonly SectionId[]): void;
}

const INITIAL_MODEL = buildDemoModel();

export const useApp = create<AppState>((set, get) => ({
  model: INITIAL_MODEL,
  selection: NO_SELECTION,
  mode: "build",
  view: ["geometry"],
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

  // Structural edits — call the engine op → new model → re-derive preview/price in one place.
  divide(sectionId, opts) {
    const m = get().model;
    if (!m) return;
    try {
      const next = divideSection(m, sectionId, toDivideMode(opts));
      if (next === m) return; // engine no-op
      set({ model: next, selection: NO_SELECTION, ...derive(next) });
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
      set({ model: next, selection: reselect(next, get().selection), ...derive(next) });
    } catch {
      /* ignore */
    }
  },
  resize(_partId, _axis, _value_mm10) {
    /* TODO: no engine resize op yet — a resize maps to a section/line edit (S3-E1 follow-up) */
  },
  addPart(_sectionId, _kind) {
    /* TODO: no engine add op yet */
  },
  detach(instanceId) {
    const m = get().model;
    if (!m) return;
    try {
      const next = detachInstance(m, instanceId);
      set({ model: next, selection: reselect(next, get().selection), ...derive(next) });
    } catch {
      /* ignore */
    }
  },
  reattach(instanceId) {
    const m = get().model;
    if (!m) return;
    try {
      const next = reattachInstance(m, instanceId);
      set({ model: next, selection: reselect(next, get().selection), ...derive(next) });
    } catch {
      /* ignore */
    }
  },
  merge(_sectionIds) {
    /* TODO S3-E3: mergeSections — blocker #2 (engine op not built yet) */
  },
}));
