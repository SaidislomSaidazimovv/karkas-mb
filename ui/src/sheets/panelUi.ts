// src/sheets/panelUi.ts — the SINGLE overlay coordinator for the whole screen. OWNER: P (integration).
//
// Before: overlay state was scattered across appStore.layersOpen, this store's add/export/menu, and
// CanvasView's local move/resize/divide — so several bottom panels could show at once and pile up.
// Now there is ONE active overlay at a time. Opening any overlay closes every other. The canvas
// handles, the ☰ menu, the layers panel, the add/export flows and the selection card all share this
// one slot. This holds only chrome state (which overlay + how deep the Add drill is) — no engine data.
import { create } from "zustand";

/** The one bottom overlay that may be visible. "none" = only the selection card (if a part is
 *  selected) shows; everything else is a takeover of the single bottom-sheet slot. */
export type Overlay =
  | "none"
  | "add"
  | "export"
  | "menu"
  | "layers"
  | "move"
  | "resize"
  | "divide";

interface PanelUiState {
  overlay: Overlay;
  /** Add-flow drill path — child-node ids entered, deepest last. Empty = the Add root. */
  drill: readonly string[];
  /** Transient one-line hint (auto-clears) — feedback when an action needs a precondition, e.g.
   *  tapping «Разм.» with nothing selected. null = nothing to show. */
  hint: string | null;
  /** Open an overlay (single slot — closes any other). Resets the Add drill. */
  open(o: Overlay): void;
  /** Toggle an overlay (☰ / layers behave as toggles). */
  toggle(o: Overlay): void;
  /** Close whatever is open → back to "none". */
  close(): void;
  drillInto(nodeId: string): void;
  drillBack(): void;
  /** Flash a transient hint for ~2s (replaces any current one). */
  flashHint(msg: string): void;
}

let hintTimer: ReturnType<typeof setTimeout> | null = null;

export const usePanelUi = create<PanelUiState>((set, get) => ({
  overlay: "none",
  drill: [],
  hint: null,
  open: (o) => set({ overlay: o, drill: [] }),
  toggle: (o) => set({ overlay: get().overlay === o ? "none" : o, drill: [] }),
  close: () => set({ overlay: "none", drill: [] }),
  drillInto: (nodeId) => set({ drill: [...get().drill, nodeId] }),
  drillBack: () => set({ drill: get().drill.slice(0, -1) }),
  flashHint: (msg) => {
    set({ hint: msg });
    if (hintTimer) clearTimeout(hintTimer);
    hintTimer = setTimeout(() => set({ hint: null }), 2000);
  },
}));
