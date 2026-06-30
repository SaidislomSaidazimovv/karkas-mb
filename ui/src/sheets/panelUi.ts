// src/sheets/panelUi.ts — T2-LOCAL ephemeral panel UI state (Zustand). OWNER: T2.
//
// NOT the app store. ui/store/appStore.ts (P) holds shared app truth (model/selection/mode).
// This holds only T2 panel-chrome state that no other track needs: which bottom-sheet flow is
// open and how deep the «Добавить» drill-menu is navigated. Kept separate so it never collides
// with P's store and carries no engine data.
import { create } from "zustand";

interface PanelUiState {
  /** «Добавить» drill-sheet open? */
  addOpen: boolean;
  /** Drill path — child-node ids entered, deepest last. Empty = the Add root. */
  drill: readonly string[];
  /** «Готово»/CNC-export sheet open? (cut-list preview + «Экспорт На ЧПУ») */
  exportOpen: boolean;
  openAdd(): void;
  closeAdd(): void;
  drillInto(nodeId: string): void;
  drillBack(): void;
  openExport(): void;
  closeExport(): void;
}

export const usePanelUi = create<PanelUiState>((set, get) => ({
  addOpen: false,
  drill: [],
  exportOpen: false,
  openAdd: () => set({ addOpen: true, drill: [] }),
  closeAdd: () => set({ addOpen: false, drill: [] }),
  drillInto: (nodeId) => set({ drill: [...get().drill, nodeId] }),
  drillBack: () => set({ drill: get().drill.slice(0, -1) }),
  openExport: () => set({ exportOpen: true, addOpen: false }),
  closeExport: () => set({ exportOpen: false }),
}));
