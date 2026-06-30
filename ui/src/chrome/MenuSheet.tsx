// src/chrome/MenuSheet.tsx — the ☰ app menu. OWNER: T2 (added by P as the S3-T2E ☰ fix).
//
// v3 design (construction-v3-preview.html): the top-bar hamburger (#i-menu) is a MENU,
// distinct from the separate layers icon (#i-layers). S3-T2E wrongly wired ☰ straight to the
// layers panel; the correct behaviour is ☰ → this menu, and «Слои · структура» here opens the
// Zone 5 layers panel. Global actions live in the menu; «Экспорт На ЧПУ» opens the CNC sheet.
// (Menu kept minimal — Save/Stages rows land when those features exist.)

import { View, Text, Pressable, StyleSheet } from "react-native";
import { useApp } from "../../store/appStore";
import { usePanelUi } from "../sheets/panelUi";
import { Grab, MenuRow, sheetBase } from "../sheets/controls";
import { C, FONT } from "../../theme";
import { Icon } from "./Icon";

export function MenuSheet() {
  const toggleLayers = useApp((s) => s.toggleLayers);
  const layersOpen = useApp((s) => s.layersOpen);
  const closeMenu = usePanelUi((s) => s.closeMenu);
  const openExport = usePanelUi((s) => s.openExport);

  return (
    <View style={[sheetBase, styles.over]}>
      <Grab />
      <View style={styles.head}>
        <Text style={styles.title}>Меню</Text>
        <Pressable style={styles.close} onPress={closeMenu} hitSlop={6}>
          <Icon name="close" size={18} color={C.ink} />
        </Pressable>
      </View>

      <MenuRow
        icon="layers"
        title="Слои · структура"
        sub={layersOpen ? "открыто · нажмите, чтобы скрыть" : "дерево деталей · видимость"}
        onPress={() => {
          toggleLayers();
          closeMenu();
        }}
      />
      <MenuRow
        icon="target"
        title="Экспорт На ЧПУ"
        sub="крой-лист · формат SWJ008"
        onPress={openExport}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  over: {
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -4 },
  },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 4 },
  title: { fontFamily: FONT, fontSize: 17, fontWeight: "800", color: C.ink },
  close: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
});
