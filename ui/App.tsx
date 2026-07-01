// ui/App.tsx — S3-E0 shell. Mounts the six zones and proves the store wiring.
// On web (react-native-web) this renders a centred 390×844 phone; on a device it fills.
// T1 builds Rail + CanvasView; T2 builds TopBar + SelectionSheet + BottomToolbar + Layers.

import { StatusBar } from "expo-status-bar";
import { View, StyleSheet } from "react-native";
import { TopBar } from "./src/chrome/TopBar";
import { Rail } from "./src/rail/Rail";
import { CanvasView } from "./src/canvas/CanvasView";
import { SelectionSheet } from "./src/sheets/SelectionSheet";
import { LayersPanel } from "./src/layers/LayersPanel";
import { BottomToolbar } from "./src/toolbar/BottomToolbar";
import { usePanelUi } from "./src/sheets/panelUi";
import { C } from "./theme";

export default function App() {
  // Exactly one bottom overlay at a time (panelUi is the single coordinator). The layers panel and
  // the selection card share that one slot; the bottom toolbar (mode/verb switch) always shows.
  const overlay = usePanelUi((s) => s.overlay);
  return (
    <View style={styles.root}>
      <View style={styles.phone}>
        <TopBar />
        <View style={styles.body}>
          <Rail />
          <CanvasView />
        </View>
        {/* Single bottom-sheet slot: layers OR the selection/flow card (SelectionSheet yields to
            move/resize/divide, which CanvasView renders as its own bottom sheet). */}
        {overlay === "layers" ? <LayersPanel /> : <SelectionSheet />}
        <BottomToolbar />
      </View>
      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#E9E8E6" },
  phone: {
    width: 390,
    height: 844,
    maxWidth: "100%",
    maxHeight: "100%",
    backgroundColor: C.bg,
    borderRadius: 34,
    overflow: "hidden",
  },
  body: { flex: 1, flexDirection: "row" },
});
