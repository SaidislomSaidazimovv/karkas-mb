// src/chrome/TopBar.tsx — Zone 1 (price ticker + nav) + breadcrumb. OWNER: T2.
// design: construction-v3-preview.html §2 (lines .topbar + .crumb).
//   [ 9 426 330 сум ⓘ ] ............ [‹] [ Дальше ] [≡]
//   Проект №1  ›  Шкаф №3 · каркас
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useApp } from "../../store/appStore";
import { usePanelUi } from "../sheets/panelUi";
import { C, FONT, R } from "../../theme";
import { Icon } from "./Icon";

export function TopBar({
  crumbProject = "Проект №1",
  crumbItem = "Шкаф №3 · каркас",
  canAdvance = true,
  onAdvance,
  onBack,
  onMenu,
}: {
  crumbProject?: string;
  crumbItem?: string;
  canAdvance?: boolean;
  onAdvance?: () => void;
  onBack?: () => void;
  onMenu?: () => void;
}) {
  const price = useApp((s) => s.price_sum);
  const open = usePanelUi((s) => s.open);
  const toggle = usePanelUi((s) => s.toggle);
  // «Дальше»/«Готово» → CNC-export sheet, unless the host wires its own advance handler
  const advance = onAdvance ?? (() => open("export"));
  // ☰ → app menu (Слои · Экспорт …) — a TOGGLE of the single overlay slot (tap again to close).
  const menu = onMenu ?? (() => toggle("menu"));
  return (
    <View>
      <View style={styles.bar}>
        <View style={styles.ticker}>
          <Text style={styles.price}>{price.toLocaleString("ru-RU")}</Text>
          <Text style={styles.cur}> сум</Text>
          <View style={{ marginLeft: 5 }}>
            <Icon name="info" size={15} color={C.ink2} />
          </View>
        </View>

        <Pressable style={styles.icirc} onPress={onBack} hitSlop={6}>
          <Icon name="back" size={20} color={C.ink} />
        </Pressable>

        <Pressable
          style={[styles.pill, !canAdvance && styles.pillOff]}
          onPress={canAdvance ? advance : undefined}
        >
          <Text style={[styles.pillTxt, !canAdvance && styles.pillTxtOff]}>Дальше</Text>
        </Pressable>

        <Pressable style={styles.hamb} onPress={menu} hitSlop={6}>
          <Icon name="menu" size={22} color={C.ink} />
        </Pressable>
      </View>

      <View style={styles.crumb}>
        <Text style={styles.crumbProject}>{crumbProject}</Text>
        <Icon name="chev" size={14} color={C.ink2} />
        <Text style={styles.crumbItem}>{crumbItem}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    backgroundColor: C.bg,
  },
  ticker: { flexDirection: "row", alignItems: "baseline", flex: 1 },
  price: { fontFamily: FONT, fontSize: 18, fontWeight: "800", color: C.ink, letterSpacing: 0.2 },
  cur: { fontFamily: FONT, fontSize: 13, fontWeight: "600", color: C.ink2 },

  icirc: {
    width: 34, height: 34, borderRadius: 999, backgroundColor: C.field,
    alignItems: "center", justifyContent: "center",
  },
  pill: {
    height: 34, paddingHorizontal: 16, borderRadius: R.pill, backgroundColor: C.black,
    alignItems: "center", justifyContent: "center",
  },
  pillOff: { backgroundColor: C.field },
  pillTxt: { fontFamily: FONT, fontSize: 13.5, fontWeight: "700", color: "#FFFFFF" },
  pillTxtOff: { color: C.disabled },
  hamb: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },

  crumb: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 16, paddingBottom: 8,
  },
  crumbProject: { fontFamily: FONT, fontSize: 12, color: C.ink2 },
  crumbItem: { fontFamily: FONT, fontSize: 12, fontWeight: "700", color: C.ink },
});
