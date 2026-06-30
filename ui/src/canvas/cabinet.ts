// src/canvas/cabinet.ts — engine PreviewResult → r3f-ready boards. OWNER: T1.
//
// The seam: while the solver is not wired yet (store.preview === null until S3-E1),
// DEMO_PREVIEW gives the viewport something real to render + select. The SAME mapping
// (previewToScene) draws the live solver output the instant store.preview turns non-null,
// so the canvas lights up with zero rework. We never reach into the engine beyond the
// PreviewResult type, which arrives through the engineBridge seam.

import type { PreviewResult } from "../../engineBridge";

/** One preview part (derived from the seam type so we don't widen the engineBridge surface). */
type PreviewPart = PreviewResult["parts"][number];

/** A render-ready box: centre + half-agnostic full size, in metres (three.js units). */
export interface Board {
  id: string;
  /** centre position [x, y, z] in metres */
  pos: [number, number, number];
  /** full size [w, h, d] in metres */
  size: [number, number, number];
}

export interface Scene {
  boards: Board[];
  /** centre of the whole cabinet (metres) — camera target */
  center: [number, number, number];
  /** largest extent (metres) — camera distance basis */
  radius: number;
}

/** Props shared by the web (r3f) and native (fallback) scene renderers. */
export interface CanvasSceneProps {
  scene: Scene;
  selectedIds: readonly string[];
  onTapPart: (id: string) => void;
}

/** mm10 (tenths of a millimetre) → metres. 16mm board = 160 mm10 = 0.016 m. */
const M = (mm10: number) => mm10 / 10_000;

/**
 * Map the engine preview to centred, metre-scaled boards. PreviewPart.bbox carries the
 * min-corner (x,y,z) and full size (w,h,d) in mm10; three.js boxes are centred, so we add
 * half-size. The cabinet is recentred on X/Z and stood on the floor (minY → 0).
 */
export function previewToScene(preview: PreviewResult): Scene {
  const parts = preview.parts;
  if (parts.length === 0) return { boards: [], center: [0, 0, 0], radius: 1 };

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (const p of parts) {
    const b = p.bbox;
    minX = Math.min(minX, b.x); maxX = Math.max(maxX, b.x + b.w);
    minY = Math.min(minY, b.y); maxY = Math.max(maxY, b.y + b.h);
    minZ = Math.min(minZ, b.z); maxZ = Math.max(maxZ, b.z + b.d);
  }
  // Recentre: X/Z about the middle, Y so the cabinet stands on the floor.
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  const boards: Board[] = parts.map((p: PreviewPart) => {
    const b = p.bbox;
    return {
      id: p.id,
      pos: [M(b.x + b.w / 2 - cx), M(b.y + b.h / 2 - minY), M(b.z + b.d / 2 - cz)],
      size: [M(b.w), M(b.h), M(b.d)],
    };
  });
  const w = M(maxX - minX), h = M(maxY - minY), d = M(maxZ - minZ);
  return {
    boards,
    center: [0, h / 2, 0],
    radius: Math.max(w, h, d),
  };
}

// ---------------------------------------------------------------------------
// DEMO cabinet (placeholder until S3-E1 feeds a real preview). A plain 800×1800×400mm
// carcass with a 6mm back and two shelves — enough to exercise tap-select + handles.
// Each id is a stable string so selection round-trips through the store.
// ---------------------------------------------------------------------------

const W = 8000;   // 800mm outer width  (mm10)
const H = 18000;  // 1800mm outer height
const D = 4000;   // 400mm depth
const T = 160;    // 16mm panel thickness
const BK = 60;    // 6mm back panel

const box = (id: string, x: number, y: number, z: number, w: number, h: number, d: number): PreviewPart => ({
  id,
  bbox: { x, y, z, w, h, d },
  drillZones: [],
});

export const DEMO_PREVIEW: PreviewResult = {
  parts: [
    box("demo-side-left", 0, 0, 0, T, H, D),
    box("demo-side-right", W - T, 0, 0, T, H, D),
    box("demo-bottom", T, 0, 0, W - 2 * T, T, D),
    box("demo-top", T, H - T, 0, W - 2 * T, T, D),
    box("demo-back", T, T, 0, W - 2 * T, H - 2 * T, BK),
    box("demo-shelf-1", T, H / 3, BK, W - 2 * T, T, D - BK),
    box("demo-shelf-2", T, (2 * H) / 3, BK, W - 2 * T, T, D - BK),
  ],
};
