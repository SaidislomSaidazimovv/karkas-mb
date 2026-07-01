// engine/index.ts — the ONLY public surface of the engine (13 v2.0 / 14 Part 1).
//
// The engine is UI-free: it imports no React, RN, Three.js, Zustand or Expo, and
// runs identically in a phone, a browser, a Node test, or a CLI. The UI reaches it
// through exactly these two functions. All internal coordinates are mm10 integers;
// floats appear only at the render/export edges.

import {
  SCHEMA_VERSION,
  type FullResult,
  type Part,
  type PreviewPart,
  type PreviewResult,
  type Project,
} from "./contracts/types.js";
import { FACE_TO_SWJ } from "./core/face.js";
import { validateParts } from "./core/validate.js";
import { exportSWJ008 } from "./postprocessors/swj008.js";

// Re-export the public model + the one exporter the UI/exporters consume.
export * from "./contracts/types.js";
// Construction-mode structural overlay (Block→Zone→Component→Part, Line/Section/Row).
export * from "./contracts/structure.js";
// S3-E1 parametric solver: structural model → flat manufacturing Part[] (the bridge).
export { solveStructure, BOARD_MM10 } from "./structure/solve.js";
// A realistic starter cabinet the UI initialises `model` with (S3-E1).
export { buildDemoModel } from "./structure/demoModel.js";
// Assembly layout (positioned panels) for the 3D viewport (S3-E1).
export { solveLayout } from "./structure/layout.js";
export type { PanelPlacement } from "./structure/layout.js";
export { exportSWJ008 } from "./postprocessors/swj008.js";
// E1: the manufacturing path — live structural model → drilled parts → byte-exact SWJ008 cut
// file. Metro-safe now that the hardware catalog is a `.ts` data module (no JSON import-attribute).
export { solveModelToParts, exportModelToSWJ008 } from "./cnc.js";
// E7: L5 stability check (non-blocking ⚠ on over-span load-bearing shelves). Separate from the
// export gate by design — it warns, never blocks (CONSTRUCTION_FRAME_v3 L5).
export { checkStability, SPAN_LIMIT_16MM_MM10 } from "./structure/stability.js";
export type { StabilityFinding, StabilityLevel } from "./structure/stability.js";
// E4: corner band-transition model (#39) — cosmetic + cut-list, not in SWJ008.
export { bandCorners, resolveBandTransition } from "./structure/banding.js";
export type { BandCorner, Face } from "./structure/banding.js";
// E6: hinge ↔ offset revalidation (#13) — non-blocking ⚠ when a #40 junction outreaches the hinge.
export { checkHingeFit, HINGE_MAX_PROUD_MM10 } from "./structure/hingeFit.js";
export type { HingeFitFinding } from "./structure/hingeFit.js";
// E12: L8 emit-completeness gate — blocks export when a declared feature never emitted its machining.
export { checkEmitCompleteness } from "./structure/emitCheck.js";
export type { EmitFinding } from "./structure/emitCheck.js";
// E9: sliding-accessory motion envelope + clearance (non-blocking ⚠ when the travel is obstructed).
export { checkMotionClearance, sweptEnvelope } from "./structure/motion.js";
export type { MotionFinding, MotionEnvelope } from "./structure/motion.js";
export { parseSWJ008, parseSWJ008Document } from "./postprocessors/swj008Parse.js";
export { canonicalizeParts, canonicalizePart } from "./core/canonical.js";
export type {
  CanonicalDoc,
  CanonicalPanel,
  CanonicalOp,
  CanonicalContour,
  CanonicalGroove,
} from "./core/canonical.js";

/**
 * solvePreview(project): sync, cheap (~2ms), bounded per gesture tick.
 * Returns bounding boxes + LOD drill ZONES/COUNTS per face — never the individual
 * operation coordinates. Safe to call on every drag frame (14 topology rule 1).
 */
export function solvePreview(project: Project): PreviewResult {
  const parts: PreviewPart[] = project.parts.map((part) => {
    const counts = new Map<Part["operations"][number]["face"], number>();
    for (const op of part.operations) {
      counts.set(op.face, (counts.get(op.face) ?? 0) + 1);
    }
    const drillZones = [...counts.entries()].map(([face, count]) => ({
      face,
      count,
      // LOD region = the whole panel face; full coordinates are withheld here.
      region: { x: 0, y: 0, w: part.length_mm10, h: part.width_mm10 },
    }));
    // Stable order so the preview packet is deterministic.
    drillZones.sort((a, b) => FACE_TO_SWJ[a.face] - FACE_TO_SWJ[b.face]);

    return {
      id: part.id,
      bbox: {
        x: 0,
        y: 0,
        z: 0,
        w: part.length_mm10,
        h: part.width_mm10,
        d: part.thickness_mm10,
      },
      drillZones,
    };
  });

  return { parts };
}

/**
 * solveFull(project): async, heavy. Debounced after gesture / on commit / for export.
 * Produces the manufacturing-grade MachiningPlan plus the validation report; the
 * safety gate runs here and export is blocked unless it is clean. The execution
 * location is swappable behind this Promise (on-device async now); the contract
 * never changes (14 topology rules 2–3).
 */
export async function solveFull(project: Project): Promise<FullResult> {
  // In V1 the parts already carry their operations (solver/custom-authored).
  // Later layers (Layer 2 parametric solver) plug in here behind the same contract.
  const parts = project.parts;
  const validation = validateParts(parts);

  return {
    plan: { parts, schemaVersion: SCHEMA_VERSION },
    validation,
  };
}

/**
 * Convenience for exporters/tests: run the full solve and, only if the safety gate
 * passes, emit SWJ008. Mirrors GATE 1 → exporter ordering (nothing exports dirty).
 */
export async function solveAndExportSWJ008(project: Project): Promise<string> {
  const { plan, validation } = await solveFull(project);
  if (!validation.ok) {
    throw new Error(
      `MACHINING_VALIDATION_FAILED: ${validation.findings.map((f) => f.code).join(", ")}`,
    );
  }
  return exportSWJ008({ ...project, parts: plan.parts });
}
