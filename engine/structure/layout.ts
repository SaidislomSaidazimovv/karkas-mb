// engine/structure/layout.ts — assembly layout for the 3D viewport (S3-E1).
//
// `solveStructure` emits flat manufacturing panels (dimensions only — every Part sits at
// the origin, because the SWJ008 machine doesn't care where a panel lives in the cabinet).
// The 3D editor needs the OPPOSITE: each panel POSITIONED in the cabinet so the viewport can
// draw the assembled box. `solveLayout` produces exactly that — positioned panels in the
// block-local mm10 frame — derived from the same geometry. Pure & deterministic.
//
// Panel ids match solveStructure's, so a selected part id maps 1:1 to its placement.

import type {
  Block,
  Component,
  Instance,
  Line,
  Section,
  StructuralModel,
} from "../contracts/structure.js";
import { leafSections } from "../contracts/structure.js";
import type { mm10 } from "../contracts/types.js";
import { BOARD_MM10 } from "./solve.js";

/** A panel placed in the cabinet: position + size in mm10 (block-local; X=width, Y=height, Z=depth). */
export interface PanelPlacement {
  readonly id: string;
  readonly name: string;
  readonly x_mm10: mm10;
  readonly y_mm10: mm10;
  readonly z_mm10: mm10;
  readonly w_mm10: mm10;
  readonly h_mm10: mm10;
  readonly d_mm10: mm10;
}

const B = BOARD_MM10;

function place(
  id: string,
  name: string,
  x: mm10,
  y: mm10,
  z: mm10,
  w: mm10,
  h: mm10,
  d: mm10,
): PanelPlacement {
  return { id, name, x_mm10: x, y_mm10: y, z_mm10: z, w_mm10: w, h_mm10: h, d_mm10: d };
}

/** Carcass box: 2 sides (full height × depth) + top + bottom (inner width), positioned. */
function carcass(block: Block): PanelPlacement[] {
  const { x, y, z, w, h, d } = block.box;
  return [
    place(`${block.id}__side_l`, "Бок левый", x, y, z, B, h, d),
    place(`${block.id}__side_r`, "Бок правый", x + w - B, y, z, B, h, d),
    place(`${block.id}__top`, "Верх", x + B, y + h - B, z, w - 2 * B, B, d),
    place(`${block.id}__bottom`, "Низ", x + B, y, z, w - 2 * B, B, d),
  ];
}

/** Vertical divider (axis "x") at its block-local position, between top and bottom. */
function dividerPlacement(block: Block, line: Line): PanelPlacement {
  const { x, y, z, h, d } = block.box;
  const px = x + line.position_mm10;
  return place(`${block.id}__div_${line.id}`, "Перегородка", px - B / 2, y + B, z, B, h - 2 * B, d);
}

function sectionById(block: Block, sectionId: string): Section | null {
  for (const zone of block.zones) {
    for (const leaf of leafSections(zone.root)) {
      if (leaf.id === sectionId) return leaf;
    }
  }
  return null;
}

function componentById(block: Block, componentId: string): Component | null {
  return block.components.find((c) => c.id === componentId) ?? null;
}

/** A shelf placement: spans its section's width (between sides/dividers) at the anchor height. */
function shelfPlacement(block: Block, inst: Instance): PanelPlacement | null {
  const section = sectionById(block, inst.sectionId);
  const component = componentById(block, inst.componentId);
  if (!section || !component || component.role !== "internal_shelf") return null;
  const s = section.box;
  return place(
    `${block.id}__inst_${inst.id}`,
    component.name,
    block.box.x + s.x + B,
    block.box.y + inst.anchor.y,
    block.box.z + s.z,
    s.w - 2 * B,
    B,
    s.d,
  );
}

/**
 * Positioned panels for the 3D viewport. Same panels (and ids) as `solveStructure`, but
 * each carries its place in the cabinet so the editor can render the assembled box.
 */
export function solveLayout(model: StructuralModel): PanelPlacement[] {
  const out: PanelPlacement[] = [];
  for (const block of model.blocks) {
    out.push(...carcass(block));
    for (const line of block.lines) out.push(dividerPlacement(block, line));
    for (const inst of block.instances) {
      const p = shelfPlacement(block, inst);
      if (p) out.push(p);
    }
  }
  return out;
}
