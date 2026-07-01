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
import { hingeCupPattern } from "../primitives/hingeCupPattern.js";

/** The shelf-pin SKU drilled for adjustable internal shelves (dummy until factory sign-off). */
const SHELF_PIN_SKU = "DUMMY_PIN_5";
/** The hinge SKU drilled into facade/door panels (verified vs SHKOF_ORTA_CHAP_ESHIK_7_1.XML). */
const HINGE_SKU = "DUMMY_CUP_110";

// Hinge placement is a Layer-2 (solver) rule; the primitive takes the positions as input.
// GROUNDED against the golden door (Length 2170mm → 4 cups at 100 / 756 / 1414 / 2070): first &
// last hinge 100mm from each end, the rest evenly spaced with a gap ≤ ~700mm. Even spacing lands
// within ~1mm of the factory's exact positions — confirm the precise rule with more door exports.
const HINGE_END_INSET: mm10 = 1000; // 100 mm
const HINGE_MAX_GAP: mm10 = 7000; // ~700 mm

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

/** Instance id encoded in a part id `${block}__inst_${instId}` (optionally a doubling layer). */
function instIdOf(partId: string): string | null {
  const marker = "__inst_";
  const i = partId.indexOf(marker);
  if (i === -1) return null;
  return partId.slice(i + marker.length).replace(/__[ab]$/, "");
}

/** Instance ids whose component is a facade/door (they carry hinge drilling). */
function facadeInstanceIds(model: StructuralModel): Set<string> {
  const out = new Set<string>();
  for (const block of model.blocks) {
    const roleOf = new Map(block.components.map((c) => [c.id, c.role] as const));
    for (const inst of block.instances) {
      if (roleOf.get(inst.componentId) === "facade") out.add(inst.id);
    }
  }
  return out;
}

/** Hinge X-positions up a door of the given Length (see the constants above for the grounding). */
function hingePositions(length: mm10): mm10[] {
  const usable = length - 2 * HINGE_END_INSET;
  if (usable <= 0) return [Math.round(length / 2)]; // tiny door → one central hinge
  const gaps = Math.max(1, Math.ceil(usable / HINGE_MAX_GAP));
  const xs: mm10[] = [];
  for (let i = 0; i <= gaps; i += 1) xs.push(HINGE_END_INSET + Math.round((usable * i) / gaps));
  return xs;
}

/**
 * Augment a solved part set with automatic drilling: shelf-pins on side panels (for the block's
 * shelves) and hinge cups on facade/door panels. Returns a NEW array; parts that gain no
 * operations are returned unchanged, drilled parts are copies with extended `operations`.
 */
export function applyDrilling(
  parts: Part[],
  model: StructuralModel,
  spec: HardwareSpec,
): Part[] {
  const shelfX = shelfXByBlock(model);
  const facades = facadeInstanceIds(model);
  const pin = spec.shelfPins[SHELF_PIN_SKU];
  const system32 = spec.system32;
  const hinge = spec.hinges[HINGE_SKU];

  return parts.map((part) => {
    // Side panel → shelf-pin line for the block's shelves.
    if (pin && isSidePanel(part.id)) {
      const xs = shelfX.get(blockIdOf(part.id));
      if (!xs || xs.length === 0) return part;
      return { ...part, operations: [...part.operations, ...shelfPinPattern(part, xs, { pin, system32 })] };
    }
    // Facade/door → hinge cups on the y0 edge (GROUNDED: SHKOF door cups at Y=21.5 → y0 edge).
    const instId = instIdOf(part.id);
    if (hinge && instId && facades.has(instId)) {
      const ops = hingeCupPattern(part, "y0", hingePositions(part.length_mm10), hinge);
      return { ...part, operations: [...part.operations, ...ops] };
    }
    return part;
  });
}
