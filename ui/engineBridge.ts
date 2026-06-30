// ui/engineBridge.ts — THE single seam between the UI and the Каркас engine.
//
// The engine is consumed as a named local package "@karkas/engine" (built JS at
// ../engine/dist; see ui/metro.config.js + ui/tsconfig.json). Only this module reaches
// into it; the store imports engine functions + types from here, so the wiring can change
// behind this seam without touching UI code. Rebuild the engine after engine changes:
//   node scripts/build-engine.mjs   (tsc -p ../engine/tsconfig.build.json → vendor ui/_engine)

// ---- runtime ----
export { solveStructure, BOARD_MM10 } from "./_engine/structure/solve";
export { buildDemoModel } from "./_engine/structure/demoModel";
export { solvePreview, solveFull } from "./_engine/index";
export {
  divideSection,
  moveLine,
  selectByTap,
  detachInstance,
  reattachInstance,
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
  BlockId,
  ZoneId,
  SectionId,
  LineId,
  InstanceId,
  ComponentId,
} from "./_engine/contracts/structure";

export type { Part, PartId, PreviewResult, Project } from "./_engine/contracts/types";

export type {
  Selection as EngineSelection,
  DivideMode,
} from "./_engine/structure/operations";
