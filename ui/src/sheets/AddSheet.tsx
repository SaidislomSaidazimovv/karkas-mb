// src/sheets/AddSheet.tsx — «Добавить» nested drill-menu. OWNER: T2.
//
// S3-T2C: the visual add-flow (design: construction-v3-preview.html §6 «Добавить › Полка»,
// ‹ ortga · › chuqurlashadi). Navigation is real (drill stack in panelUi).
// S3-U10: leaf rows are WIRED to the live engine — store.addPart(sectionId, kind, opts):
//   shelf / shelf+{doubled} / door / divider all create real parts (E11 addInstance), undo-able.
//   A leaf needs a target leaf-section (selection.sectionId); without one the row is disabled.
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useApp, targetSectionId, type AddKind } from "../../store/appStore";
import { usePanelUi } from "./panelUi";
import { C, FONT } from "../../theme";
import { Grab, MenuRow, sheetBase } from "./controls";
import { Icon, type IconName } from "../chrome/Icon";

type Item = {
  id: string;
  icon: IconName;
  title: string;
  sub: string;
  into?: string; // child node id → drill deeper
  kind?: AddKind; // leaf → store.addPart(kind)
  doubled?: boolean; // leaf shelf → addPart(kind, { doubled: true }) — 2×16 → 32 мм
  glazedGrid?: { lights: number }; // leaf door → addPart("door", { glazedGrid }) — витрина (E2/E3)
};
type Node = { title: string; items: Item[] };

const NODES: Record<string, Node> = {
  root: {
    title: "Добавить",
    items: [
      { id: "shelf", icon: "divide", title: "Полка", sub: "горизонтальная", into: "shelf" },
      { id: "divider", icon: "add", title: "Перегородка", sub: "вертикальная", kind: "divider" },
      { id: "drawer", icon: "slide", title: "Ящик", sub: "направляющие · конверт хода", kind: "drawer" },
      { id: "door", icon: "hinge", title: "Дверь / фасад", sub: "петли · накладная", kind: "door" },
      { id: "vitrine", icon: "glass", title: "Витрина (стекло)", sub: "3 секции · рама + мунтины + стекло", kind: "door", glazedGrid: { lights: 3 } },
    ],
  },
  shelf: {
    title: "Добавить › Полка",
    items: [
      { id: "shelf-normal", icon: "divide", title: "Обычная полка", sub: "16 мм · по ширине секции", kind: "shelf" },
      { id: "shelf-double", icon: "double", title: "Удвоенная полка", sub: "2×16 → 32 мм · нагрузка", kind: "shelf", doubled: true },
      { id: "shelf-pullout", icon: "slide", title: "Выдвижная", sub: "направляющие · конверт хода", kind: "drawer" },
      { id: "shelf-grid", icon: "grid", title: "Решётка / разделители", sub: "внутренняя сетка", kind: "divider" },
    ],
  },
};

export function AddSheet() {
  const drill = usePanelUi((s) => s.drill);
  const drillInto = usePanelUi((s) => s.drillInto);
  const drillBack = usePanelUi((s) => s.drillBack);
  const closeAdd = usePanelUi((s) => s.close);
  const addPart = useApp((s) => s.addPart);
  // Target the tapped leaf section, or a sensible default (a wall tap has none) — so «Добавить»
  // always has somewhere to put the new part instead of being permanently disabled.
  const model = useApp((s) => s.model);
  const selection = useApp((s) => s.selection);
  const sectionId = targetSectionId(model, selection);

  const nodeId = drill.length ? drill[drill.length - 1]! : "root";
  const node = NODES[nodeId] ?? NODES.root!;
  const atRoot = drill.length === 0;

  const onItem = (item: Item) => {
    if (item.into) {
      drillInto(item.into);
      return;
    }
    if (!item.kind) {
      closeAdd();
      return;
    }
    if (item.kind === "drawer") return; // ящик/выдвижная — out of scope (engine no-op), disabled
    if (!sectionId) return; // disabled — a leaf needs a target section
    const opts = item.doubled
      ? { doubled: true }
      : item.glazedGrid
        ? { glazedGrid: item.glazedGrid }
        : undefined;
    addPart(sectionId, item.kind, opts);
    closeAdd();
  };

  return (
    <View style={[sheetBase, styles.over]}>
      <Grab />
      <View style={styles.head}>
        <Pressable style={styles.hbtn} onPress={atRoot ? undefined : drillBack} disabled={atRoot} hitSlop={6}>
          <Icon name="back" size={20} color={atRoot ? C.disabled : C.ink} />
        </Pressable>
        <Text style={styles.title}>{node.title}</Text>
        <Pressable style={styles.hbtn} onPress={closeAdd} hitSlop={6}>
          <Icon name="close" size={18} color={C.ink} />
        </Pressable>
      </View>
      {node.items.map((it) => {
        const isDrawer = it.kind === "drawer"; // out of scope → shown but disabled with a «скоро» note
        const leafDisabled = isDrawer || (!it.into && !!it.kind && !sectionId);
        return (
          <View key={it.id} style={leafDisabled ? styles.disabled : undefined}>
            <MenuRow
              icon={it.icon}
              title={it.title}
              sub={isDrawer ? "скоро" : it.sub}
              trailing={it.into ? "chev" : "none"}
              onPress={() => onItem(it)}
            />
          </View>
        );
      })}
      {!sectionId ? <Text style={styles.hint}>Выберите секцию, чтобы добавить деталь</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  over: { borderTopWidth: 0, shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: -4 } },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  hbtn: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: FONT, fontSize: 16, fontWeight: "800", color: C.ink, flex: 1, textAlign: "center" },
  hint: { fontFamily: FONT, fontSize: 12, color: C.ink2, textAlign: "center", paddingTop: 8 },
  disabled: { opacity: 0.4 },
});
