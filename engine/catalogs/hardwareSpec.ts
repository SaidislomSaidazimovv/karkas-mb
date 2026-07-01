// Layer 0 — catalog loader. Reads the hardware spec once (pure data, no logic).
// Primitives never import JSON or fs; they receive a typed spec object as a
// parameter. This is the seam where tomorrow's verified values slot in by editing
// the DATA MODULE only — never the primitive functions (15_PRIMITIVES_STEP2.md, "the one rule").
//
// The data lives in a `.ts` const (hardware_specs.dummy.ts), NOT a `.json`, so the drilling +
// SWJ008-export path stays bundlable by Metro (no `with { type: "json" }` attribute). See E1.

import { hardwareSpecRaw } from "./hardware_specs.dummy.js";
import type { HardwareSpec } from "../primitives/types.js";

// The data carries documentation keys (_README, comment_*) the type does not model;
// the cast narrows to the structural fields the primitives consume.
export const hardwareSpec = hardwareSpecRaw as unknown as HardwareSpec;

export function loadHardwareSpec(): HardwareSpec {
  return hardwareSpec;
}
