// engine/structure/drilling.ts — S3-E2 primitive integration (slice 1: shelf pins).
//
// `solveStructure` produces blank panels (operations: []). THIS pass walks that part
// set and calls the Layer-1 drilling primitives to fill in `operations`. It is the
// "primitives are no longer dead code" bridge the kanban asks for.
//
// SLICE 1 wires the System-32 shelf-pin line-boring: every block that holds at least
// one internal shelf gets its two side panels line-bored with a front+back row of
// Ø-pin holes at the System-32 vertical pitch. Hinge cups (doors) and Rastex cams
// (carcass joints) land in later slices, once the solver emits those panel roles and
// the joint adjacency they need.
//
// PURITY / SAFETY: this module imports ONLY primitives + types — never the hardware
// catalog JSON. The spec is passed IN by the caller (engine/cnc.ts). That keeps the
// JSON import-attribute (`with { type: "json" }`) out of any module the UI bundles,
// so Metro never sees it. Same part in → same parts out; no mutation, no I/O.

import type { Part, mm10 } from "../contracts/types.js";
import type { HardwareSpec, System32Spec } from "../primitives/types.js";
import { shelfPinPattern } from "../primitives/shelfPinPattern.js";
import { mmToMm10 } from "../core/units.js";

/** The shelf-pin SKU drilled for adjustable internal shelves (dummy until factory). */
const SHELF_PIN_SKU = "DUMMY_PIN_5";

/** Part ids are `${block.id}__<role>...`; recover the owning block id. */
function blockIdOf(partId: string): string {
  const i = partId.indexOf("__");
  return i === -1 ? partId : partId.slice(0, i);
}

function isSidePanel(partId: string): boolean {
  return partId.endsWith("__side_l") || partId.endsWith("__side_r");
}

function hasShelf(partId: string): boolean {
  return partId.includes("__inst_");
}

/**
 * System-32 column: hole X-positions running up a side panel's Length (cabinet height).
 * Starts `firstHoleOffset` from the bottom edge and steps by `verticalPitch` until the
 * symmetric offset from the top edge — the continuous line-bore a real cabinet drills so
 * shelves can sit at any pitch stop (independent of where this design's shelves land).
 */
function system32ColumnX(length_mm10: mm10, system32: System32Spec): mm10[] {
  const first = mmToMm10(system32.firstHoleOffset);
  const pitch = mmToMm10(system32.verticalPitch);
  const last = length_mm10 - first;
  const xs: mm10[] = [];
  if (pitch <= 0) return xs;
  for (let x = first; x <= last; x += pitch) xs.push(x);
  return xs;
}

/**
 * Augment a solved part set with automatic drilling. Returns a NEW array; parts that
 * gain no operations are returned unchanged (referentially), drilled parts are copies
 * with their `operations` extended.
 */
export function applyDrilling(parts: Part[], spec: HardwareSpec): Part[] {
  const blocksWithShelf = new Set<string>();
  for (const part of parts) {
    if (hasShelf(part.id)) blocksWithShelf.add(blockIdOf(part.id));
  }

  const pin = spec.shelfPins[SHELF_PIN_SKU];
  const system32 = spec.system32;

  return parts.map((part) => {
    if (!pin || !isSidePanel(part.id) || !blocksWithShelf.has(blockIdOf(part.id))) {
      return part;
    }
    const xs = system32ColumnX(part.length_mm10, system32);
    if (xs.length === 0) return part;
    const ops = shelfPinPattern(part, xs, { pin, system32 });
    return { ...part, operations: [...part.operations, ...ops] };
  });
}
