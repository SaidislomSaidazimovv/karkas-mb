// engine/cnc.ts — model → manufacturing parts WITH drilling (S3-E2).
//
// This is the ONLY engine module that loads the hardware catalog (the JSON spec). It is
// deliberately NOT re-exported by index.ts and NOT imported by ui/engineBridge.ts, so the
// catalog's JSON import-attribute (`with { type: "json" }`) never enters the Metro bundle
// graph the UI builds. The UI renders geometry through solveStructure / solveLayout (no
// drilling, no catalog); the CNC drilling path lives here, engine-side, where Node ESM and
// vitest resolve the JSON attribute natively.

import type { StructuralModel } from "./contracts/structure.js";
import type { Part } from "./contracts/types.js";
import { solveStructure } from "./structure/solve.js";
import { applyDrilling } from "./structure/drilling.js";
import { loadHardwareSpec } from "./catalogs/hardwareSpec.js";

/**
 * Full structural solve for manufacturing: geometry (solveStructure) + automatic drilling
 * (applyDrilling) using the loaded hardware catalog. The drilled Part[] is ready for
 * validateParts → exportSWJ008 (the SWJ008 emit wires in a later slice).
 */
export function solveModelToParts(model: StructuralModel): Part[] {
  return applyDrilling(solveStructure(model), model, loadHardwareSpec());
}
