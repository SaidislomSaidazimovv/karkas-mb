// src/canvas/cabinet.ts — engine geometry → r3f-ready boards. OWNER: T1.
//
// The viewport renders the store's live `scene` (PanelPlacement[] from solveLayout): the
// assembled cabinet, positioned panels with ids that match selection.partIds 1:1. When the
// scene is empty we fall back to DEMO_PREVIEW so the canvas is never blank. Both paths feed
// the SAME centring core (boxesToScene), so selection highlight + camera framing behave
// identically. We never reach into the engine beyond the types arriving via engineBridge.

import type { PanelPlacement, PreviewResult } from "../../engineBridge";

/** One preview part (derived from the seam type so we don't widen the engineBridge surface). */
type PreviewPart = PreviewResult["parts"][number];

/** A render-ready box: centre + full size, in metres (three.js units). */
export interface Board {
  id: string;
  name?: string;
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

/** Camera orbit angles (radians): [polar (pitch, around X), azimuth (yaw, around Y)]. */
export type Orbit = [number, number];

/** Props shared by the web (r3f) and native (fallback) scene renderers. */
export interface CanvasSceneProps {
  scene: Scene;
  selectedIds: readonly string[];
  onTapPart: (id: string) => void;
  orbit: Orbit;
  /** Drag on empty space → relative camera orbit (radians). Web only; native ignores it. */
  onOrbitDelta?: (dPol: number, dAz: number) => void;
}

/** mm10 (tenths of a millimetre) → metres. 16mm board = 160 mm10 = 0.016 m. */
const M = (mm10: number) => mm10 / 10_000;

/** A min-corner box in mm10 — the common shape of both a PreviewPart and a PanelPlacement. */
interface RawBox {
  id: string;
  name?: string;
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
}

/**
 * Centre + metre-scale a set of min-corner mm10 boxes. three.js boxes are centred, so we add
 * half-size; the cabinet is recentred on X/Z and stood on the floor (minY → 0).
 */
function boxesToScene(boxes: RawBox[]): Scene {
  if (boxes.length === 0) return { boards: [], center: [0, 0, 0], radius: 1 };

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (const b of boxes) {
    minX = Math.min(minX, b.x); maxX = Math.max(maxX, b.x + b.w);
    minY = Math.min(minY, b.y); maxY = Math.max(maxY, b.y + b.h);
    minZ = Math.min(minZ, b.z); maxZ = Math.max(maxZ, b.z + b.d);
  }
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  const boards: Board[] = boxes.map((b) => ({
    id: b.id,
    name: b.name,
    pos: [M(b.x + b.w / 2 - cx), M(b.y + b.h / 2 - minY), M(b.z + b.d / 2 - cz)],
    size: [M(b.w), M(b.h), M(b.d)],
  }));
  const w = M(maxX - minX), h = M(maxY - minY), d = M(maxZ - minZ);
  return { boards, center: [0, h / 2, 0], radius: Math.max(w, h, d) };
}

/** Live path: the assembled cabinet from the store (solveLayout → positioned panels). */
export function layoutToScene(panels: readonly PanelPlacement[]): Scene {
  return boxesToScene(
    panels.map((p) => ({
      id: p.id,
      name: p.name,
      x: p.x_mm10, y: p.y_mm10, z: p.z_mm10,
      w: p.w_mm10, h: p.h_mm10, d: p.d_mm10,
    })),
  );
}

/** Fallback path: the static preview bboxes (used only when the live scene is empty). */
export function previewToScene(preview: PreviewResult): Scene {
  return boxesToScene(
    preview.parts.map((p: PreviewPart) => ({
      id: p.id,
      x: p.bbox.x, y: p.bbox.y, z: p.bbox.z,
      w: p.bbox.w, h: p.bbox.h, d: p.bbox.d,
    })),
  );
}

// ---------------------------------------------------------------------------
// DEMO cabinet — fallback only (the store boots a real model, so this rarely shows).
// A plain 800×1800×400mm carcass with a 6mm back and two shelves.
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
