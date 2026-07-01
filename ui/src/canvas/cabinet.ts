// src/canvas/cabinet.ts — engine geometry → r3f-ready boards. OWNER: T1.
//
// The viewport renders the store's live `scene` (PanelPlacement[] from solveLayout): the
// assembled cabinet, positioned panels with ids that match selection.partIds 1:1. When the
// scene is empty we fall back to DEMO_PREVIEW so the canvas is never blank. Both paths feed
// the SAME centring core (boxesToScene), so selection highlight + camera framing behave
// identically. We never reach into the engine beyond the types arriving via engineBridge.

import { leafSections } from "../../engineBridge";
import type { PanelPlacement, PreviewResult, StructuralModel } from "../../engineBridge";

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
  /** Tap a panel. `point` is the 3D hit-point (world coords) — used to resolve the interior section. */
  onTapPart: (id: string, point?: [number, number, number]) => void;
  orbit?: Orbit; // legacy (OrbitControls now owns the camera); kept optional for the native fallback
  /** Active view lenses (rail toggles): "glass" → translucent, "lines" → edge overlay. */
  lenses: readonly string[];
  /** Part ids toggled off in Zone 5 (eye) — skipped in the 3D render. View-only, NOT export. */
  hiddenIds: readonly string[];
  /** Drag on empty space → relative camera orbit (radians). Web only; native ignores it. */
  onOrbitDelta?: (dPol: number, dAz: number) => void;
  /** Ref receiving the OrbitControls instance so the on-screen joystick can drive it (web only). */
  controlsRef?: { current: OrbitLike | null };
  /** Leaf-section volumes (metres) — only the selected one is drawn, as a highlight over the box. */
  sectionPicks?: readonly SectionPick[];
  /** The currently selected section id (drawn as a translucent highlight). */
  selectedSectionId?: string;
}

/** The bits of drei's OrbitControls the joystick uses (loosely typed to avoid a hard drei dep here). */
export interface OrbitLike {
  getAzimuthalAngle(): number;
  getPolarAngle(): number;
  setAzimuthalAngle(a: number): void;
  setPolarAngle(a: number): void;
  update(): void;
  reset(): void;
}

/** Overall cabinet size in millimetres — for the "dimension" view lens readout. */
export function sceneDimsMm(scene: Scene): { w: number; h: number; d: number } {
  if (scene.boards.length === 0) return { w: 0, h: 0, d: 0 };
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (const b of scene.boards) {
    minX = Math.min(minX, b.pos[0] - b.size[0] / 2); maxX = Math.max(maxX, b.pos[0] + b.size[0] / 2);
    minY = Math.min(minY, b.pos[1] - b.size[1] / 2); maxY = Math.max(maxY, b.pos[1] + b.size[1] / 2);
    minZ = Math.min(minZ, b.pos[2] - b.size[2] / 2); maxZ = Math.max(maxZ, b.pos[2] + b.size[2] / 2);
  }
  const mm = (m: number) => Math.round(m * 1000);
  return { w: mm(maxX - minX), h: mm(maxY - minY), d: mm(maxZ - minZ) };
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

/** A pickable interior leaf-section volume, in the SAME world coords as the scene boards. */
export interface SectionPick {
  id: string; // sectionId
  pos: [number, number, number]; // centre (metres)
  size: [number, number, number]; // full size (metres)
}

/** The centring offset boxesToScene applies, derived from the panel bounds. */
function sceneOffset(boxes: readonly RawBox[]): { cx: number; cz: number; minY: number } {
  let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (const b of boxes) {
    minX = Math.min(minX, b.x); maxX = Math.max(maxX, b.x + b.w);
    minY = Math.min(minY, b.y);
    minZ = Math.min(minZ, b.z); maxZ = Math.max(maxZ, b.z + b.d);
  }
  return { cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2, minY };
}

/**
 * Pickable volumes for every LEAF section, mapped into the panel scene's world coords so a tap in
 * the 3D can select the exact interior section (→ divide/add target it). Each box is inset to ~70%
 * of the section so it floats inside — the surrounding carcass walls stay tappable for a part
 * selection, and the front face sits behind the (open) front so it's reachable through the opening.
 */
export function sectionPicks(
  model: StructuralModel | null,
  panels: readonly PanelPlacement[],
): SectionPick[] {
  if (!model || panels.length === 0) return [];
  const { cx, cz, minY } = sceneOffset(
    panels.map((p) => ({ id: p.id, x: p.x_mm10, y: p.y_mm10, z: p.z_mm10, w: p.w_mm10, h: p.h_mm10, d: p.d_mm10 })),
  );
  const INSET = 0.15; // trim 15% off each side → central 70% is the section, edges are walls
  const picks: SectionPick[] = [];
  for (const b of model.blocks) {
    for (const z of b.zones) {
      for (const s of leafSections(z.root)) {
        const ax = b.box.x + s.box.x, ay = b.box.y + s.box.y, az = b.box.z + s.box.z;
        const w = s.box.w * (1 - 2 * INSET), h = s.box.h * (1 - 2 * INSET), d = s.box.d * (1 - 2 * INSET);
        const x = ax + s.box.w * INSET, y = ay + s.box.h * INSET, zz = az + s.box.d * INSET;
        picks.push({
          id: s.id,
          pos: [M(x + w / 2 - cx), M(y + h / 2 - minY), M(zz + d / 2 - cz)],
          size: [M(w), M(h), M(d)],
        });
      }
    }
  }
  return picks;
}

/**
 * Which LEAF section does a 3D tap fall in? `world` is the ray hit-point (from onTapPart), `center`
 * is scene.center (the group offset). We invert the board transform to model mm10 and test x/y
 * containment (sections span the full depth, and the hit lands on a bounding wall, so z is ignored).
 * Lets a tap ANYWHERE on the cabinet resolve the interior section behind that spot — no need to
 * reach an occluded volume.
 */
export function sectionAtPoint(
  model: StructuralModel | null,
  panels: readonly PanelPlacement[],
  center: readonly [number, number, number],
  world: readonly [number, number, number],
): string | undefined {
  if (!model || panels.length === 0) return undefined;
  const { cx, minY } = sceneOffset(
    panels.map((p) => ({ id: p.id, x: p.x_mm10, y: p.y_mm10, z: p.z_mm10, w: p.w_mm10, h: p.h_mm10, d: p.d_mm10 })),
  );
  const mx = (world[0] + center[0]) * 10_000 + cx;
  const my = (world[1] + center[1]) * 10_000 + minY;
  const EPS = 60; // 6mm — a tap on a bounding wall face can sit a hair outside the section box
  for (const b of model.blocks) {
    for (const z of b.zones) {
      for (const s of leafSections(z.root)) {
        const ax = b.box.x + s.box.x, ay = b.box.y + s.box.y;
        if (mx >= ax - EPS && mx <= ax + s.box.w + EPS && my >= ay - EPS && my <= ay + s.box.h + EPS) return s.id;
      }
    }
  }
  return undefined;
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
