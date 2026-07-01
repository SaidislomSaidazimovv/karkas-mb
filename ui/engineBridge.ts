// ui/engineBridge.ts — THE single seam between the UI and the Каркас engine.
//
// The engine is consumed as a named local package "@karkas/engine" (built JS at
// ../engine/dist; see ui/metro.config.js + ui/tsconfig.json). Only this module reaches
// into it; the store imports engine functions + types from here, so the wiring can change
// behind this seam without touching UI code. Rebuild the engine after engine changes:
//   node scripts/build-engine.mjs   (tsc -p ../engine/tsconfig.build.json → vendor ui/_engine)

// ---- runtime ----
export { solveStructure, BOARD_MM10 } from "./_engine/structure/solve";
export { solveLayout } from "./_engine/structure/layout";
export { buildDemoModel } from "./_engine/structure/demoModel";
export { solvePreview, solveFull } from "./_engine/index";
// E1: manufacturing path — live model → drilled parts → byte-exact SWJ008 cut file. Metro-safe
// (the hardware catalog is a `.ts` data module, no JSON import-attribute).
export { solveModelToParts, exportModelToSWJ008 } from "./_engine/cnc";
// E7: L5 stability check (non-blocking ⚠). The store derives it; U13 renders the badge.
export { checkStability, SPAN_LIMIT_16MM_MM10 } from "./_engine/structure/stability";
export type { StabilityFinding, StabilityLevel } from "./_engine/structure/stability";
// E4: corner band-transition (#39). U9 (Frame body) sets Component.bandTransition; cut-list reads this.
export { bandCorners, resolveBandTransition } from "./_engine/structure/banding";
export type { BandCorner } from "./_engine/structure/banding";
export {
  divideSection,
  mergeSections,
  moveLine,
  selectByTap,
  detachInstance,
  reattachInstance,
  addInstance,
  resizeBlockDepth,
  resizeBlockWidth,
} from "./_engine/structure/operations";
export { countExceptions, leafSections } from "./_engine/contracts/structure";

// ---- types ----
export type {
  StructuralModel,
  Block,
  Zone,
  Section,
  Component,
  Instance,
  Line,
  Row,
  Scope,
  PanelRole,
  BandTransition,
  Junction3D,
  BlockId,
  ZoneId,
  SectionId,
  LineId,
  InstanceId,
  ComponentId,
} from "./_engine/contracts/structure";

export type { Part, PartId, PreviewResult, Project } from "./_engine/contracts/types";

export type { PanelPlacement } from "./_engine/structure/layout";

export type {
  Selection as EngineSelection,
  DivideMode,
} from "./_engine/structure/operations";
