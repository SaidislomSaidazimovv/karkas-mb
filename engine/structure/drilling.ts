// engine/structure/drilling.ts — S3-E2 primitive integration (shelf pins).
//
// `solveStructure` produces blank panels (operations: []). THIS pass walks that part set
// plus the structural model and calls the Layer-1 drilling primitives to fill in `operations`.
//
// GROUNDING (real factory file tests/golden/xml/ORTA_BAK_6_1.XML — a side panel):
// a side panel carries Ø5 shelf-pin holes ONLY where a shelf actually sits — a front+back
// pair per shelf, NOT a continuous System-32 column. So we drill at the REAL shelf positions
// (each internal_shelf instance's anchor height), at the factory setback (System-32 spec,
// 91.5 mm from each Y edge per ORTA_BAK), depth 11 mm, Ø5.
//
// HONEST GAPS (provisional until S3-E2-proper + S3-E7 verified specs):
//   • Section adjacency: every side panel is drilled for ALL of its block's shelves; the
//     precise "which panel bounds which section" mapping (outer side vs divider, left vs right)
//     is not yet resolved — can over-drill on multi-section blocks.
//   • Both faces: the factory drills Face A AND Face B on a middle panel (a shelf each side);
//     shelfPinPattern emits Face A only here.
//   • Spec verified:false (dummy catalog) — values now match the ORTA_BAK file but await full
//     factory sign-off (S3-E7). This path is NOT wired to any shipped CNC export yet.
//
// PURITY / SAFETY: imports ONLY primitives + types — never the hardware catalog JSON. The
// spec is passed IN by the caller (engine/cnc.ts), keeping the JSON import-attribute out of
// any UI-bundled module (Metro stays clean). Same input in → same parts out; no mutation.

import type { Part, mm10 } from "../contracts/types.js";
import type { HardwareSpec } from "../primitives/types.js";
import type { StructuralModel } from "../contracts/structure.js";
import { shelfPinPattern } from "../primitives/shelfPinPattern.js";

/** The shelf-pin SKU drilled for adjustable internal shelves (dummy until factory sign-off). */
const SHELF_PIN_SKU = "DUMMY_PIN_5";

/** Part ids are `${block.id}__<role>...`; recover the owning block id. */
function blockIdOf(partId: string): string {
  const i = partId.indexOf("__");
  return i === -1 ? partId : partId.slice(0, i);
}

function isSidePanel(partId: string): boolean {
  return partId.endsWith("__side_l") || partId.endsWith("__side_r");
}

/**
 * Real shelf X-positions (heights up a side panel) per block — read from each internal_shelf
 * instance's anchor, NOT synthesised as a full column. These are the X the factory drills at.
 */
function shelfXByBlock(model: StructuralModel): Map<string, mm10[]> {
  const out = new Map<string, mm10[]>();
  for (const block of model.blocks) {
    const roleOf = new Map(block.components.map((c) => [c.id, c.role] as const));
    const xs: mm10[] = [];
    for (const inst of block.instances) {
      if (roleOf.get(inst.componentId) === "internal_shelf") xs.push(inst.anchor.y);
    }
    if (xs.length > 0) out.set(block.id, xs);
  }
  return out;
}

/**
 * Augment a solved part set with automatic shelf-pin drilling. Returns a NEW array; parts that
 * gain no operations are returned unchanged, drilled parts are copies with extended `operations`.
 */
export function applyDrilling(
  parts: Part[],
  model: StructuralModel,
  spec: HardwareSpec,
): Part[] {
  const shelfX = shelfXByBlock(model);
  const pin = spec.shelfPins[SHELF_PIN_SKU];
  const system32 = spec.system32;
  if (!pin) return parts;

  return parts.map((part) => {
    if (!isSidePanel(part.id)) return part;
    const xs = shelfX.get(blockIdOf(part.id));
    if (!xs || xs.length === 0) return part;
    const ops = shelfPinPattern(part, xs, { pin, system32 });
    return { ...part, operations: [...part.operations, ...ops] };
  });
}
