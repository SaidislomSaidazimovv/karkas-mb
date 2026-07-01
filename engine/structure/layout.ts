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
import { BOARD_MM10, CORNER_FILLER_W, sectionOfLine } from "./solve.js";

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

interface Box6 {
  readonly x: mm10;
  readonly y: mm10;
  readonly z: mm10;
  readonly w: mm10;
  readonly h: mm10;
  readonly d: mm10;
}

/** Carcass positioned for a run along X: 2 sides + top + bottom (inner width) + back. `omitSideR`
 *  drops the right side (the L corner-join). */
function carcassPlace(idBase: string, label: string, box: Box6, omitSideR = false): PanelPlacement[] {
  const { x, y, z, w, h, d } = box;
  const ps = [
    place(`${idBase}__side_l`, `${label}Бок левый`, x, y, z, B, h, d),
    place(`${idBase}__side_r`, `${label}Бок правый`, x + w - B, y, z, B, h, d),
    place(`${idBase}__top`, `${label}Верх`, x + B, y + h - B, z, w - 2 * B, B, d),
    place(`${idBase}__bottom`, `${label}Низ`, x + B, y, z, w - 2 * B, B, d),
    place(`${idBase}__back`, `${label}Задняя стенка`, x, y, z + d - B, w, h, B),
  ];
  return omitSideR ? ps.filter((p) => !p.id.endsWith("__side_r")) : ps;
}

function carcass(block: Block): PanelPlacement[] {
  return carcassPlace(block.id, "", block.box);
}

/** Carcass positioned for a return run along Z (the L's second leg, rotated 90°). The corner-end
 *  side is omitted (it opens into leg-A); the far-end side is kept as `side_l`. Matches the 4 parts
 *  solveStructure emits for leg-B (side_r omitted). */
function carcassPlaceZ(idBase: string, label: string, box: Box6): PanelPlacement[] {
  const { x, y, z, w, h, d } = box;
  return [
    place(`${idBase}__side_l`, `${label}Бок левый`, x, y, z + d - B, w, h, B), // far end of the run
    place(`${idBase}__top`, `${label}Верх`, x, y + h - B, z + B, w, B, d - 2 * B),
    place(`${idBase}__bottom`, `${label}Низ`, x, y, z + B, w, B, d - 2 * B),
    place(`${idBase}__back`, `${label}Задняя стенка`, x + w - B, y, z, B, h, d), // wall side (far X)
  ];
}

/** Position an L-corner block: leg-A along X, leg-B as a Z-return behind it, + the corner filler. */
function lCornerLayout(block: Block): PanelPlacement[] {
  const fp = block.footprint!;
  const { x, y, z, h } = block.box;
  const aDepth = fp.legA.depth_mm10;
  const aBox: Box6 = { x, y, z, w: fp.legA.length_mm10, h, d: aDepth };
  const bBox: Box6 = { x, y, z: z + aDepth, w: fp.legB.depth_mm10, h, d: fp.legB.length_mm10 };
  return [
    ...carcassPlace(`${block.id}__legA`, "Плечо A · ", aBox),
    ...carcassPlaceZ(`${block.id}__legB`, "Плечо B · ", bBox),
    // A vertical filler strip at the inner corner (blocker #6).
    place(`${block.id}__corner_filler`, "Угловая планка", x + fp.legB.depth_mm10, y, z + aDepth - CORNER_FILLER_W, B, h, CORNER_FILLER_W),
  ];
}

/** Vertical divider (axis "x") positioned inside the SECTION it divides (leg-aware for L-blocks):
 *  its depth + z-origin follow that section, not the block's bounding box. */
function dividerPlacement(block: Block, line: Line): PanelPlacement {
  const box = sectionOfLine(block, line.id)?.box;
  const sy = box ? box.y : 0;
  const sz = box ? box.z : 0;
  const sh = box ? box.h : block.box.h;
  const sd = box ? box.d : block.box.d;
  const px = block.box.x + line.position_mm10;
  return place(`${block.id}__div_${line.id}`, "Перегородка", px - B / 2, block.box.y + sy + B, block.box.z + sz, B, sh - 2 * B, sd);
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
    out.push(...(block.footprint ? lCornerLayout(block) : carcass(block)));
    for (const line of block.lines) out.push(dividerPlacement(block, line));
    for (const inst of block.instances) {
      const p = shelfPlacement(block, inst);
      if (p) out.push(p);
    }
  }
  return out;
}
