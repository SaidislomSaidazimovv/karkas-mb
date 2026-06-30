// S3-E5 — edge-banding (shelf front edge). Slice 1.
// GROUNDED against tests/golden/xml/POLKA-1_7_1.XML, where a shelf bands Face 3 at 1.000 mm.
// L8 (CONSTRUCTION_FRAME_v3.md): the band must be EMITTED in the cut output, not implied —
// so we also assert it survives into the SWJ008 XML.
//
// HONEST SCOPE: only the shelf is grounded (its orientation matches POLKA-1: Length = span,
// Width = depth → front edge = Face 3). Carcass / divider / back front-edge face indices are
// NOT grounded yet (no SWJ edge-face convention doc / matching fixture), so they stay bare.

import { describe, expect, it } from "vitest";

import { buildDemoModel } from "../engine/structure/demoModel.js";
import { solveStructure, EDGE_BAND_MM10 } from "../engine/structure/solve.js";
import { exportSWJ008 } from "../engine/index.js";

describe("S3-E5 edge-banding (shelf front edge)", () => {
  it("bands the shelf front edge (Face 3 = edges[2]) at 1.0 mm — grounded by POLKA-1", () => {
    const shelves = solveStructure(buildDemoModel()).filter((p) => p.id.includes("__inst_"));
    expect(shelves.length).toBeGreaterThan(0);
    for (const s of shelves) {
      expect(s.edges).toEqual([0, 0, EDGE_BAND_MM10, 0]);
    }
  });

  it("leaves carcass / divider / back panels bare (their front-edge face is not grounded yet)", () => {
    const nonShelf = solveStructure(buildDemoModel()).filter((p) => !p.id.includes("__inst_"));
    expect(nonShelf.length).toBeGreaterThan(0);
    for (const p of nonShelf) {
      expect(p.edges).toEqual([0, 0, 0, 0]);
    }
  });

  it("emits the band into SWJ008 (L8 — present in the cut output, not implied)", () => {
    const parts = solveStructure(buildDemoModel());
    const xml = exportSWJ008({ id: "demo", name: "demo", parts });
    expect(xml).toContain('<Edge Face="3" Thickness="1.000" />');
  });
});
