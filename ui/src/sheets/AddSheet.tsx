// src/sheets/AddSheet.tsx — «Добавить» nested drill-menu. OWNER: T2.
//
// S3-T2C: the visual add-flow (design: construction-v3-preview.html §6 «Добавить › Полка»,
// ‹ ortga · › chuqurlashadi). Navigation is real (drill stack in panelUi); the leaf action
// calls store.addPart — a stable no-op until the engine `addInstance` op lands (P, gated).
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useApp, type AddKind } from "../../store/appStore";
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
    ],
  },
  shelf: {
    title: "Добавить › Полка",
    items: [
      { id: "shelf-normal", icon: "divide", title: "Обычная полка", sub: "16 мм · по ширине секции", kind: "shelf" },
      { id: "shelf-double", icon: "double", title: "Удвоенная полка", sub: "2×16 → 32 мм · нагрузка", kind: "shelf" },
      { id: "shelf-pullout", icon: "slide", title: "Выдвижная", sub: "направляющие · конверт хода", kind: "drawer" },
      { id: "shelf-grid", icon: "grid", title: "Решётка / разделители", sub: "внутренняя сетка", kind: "divider" },
    ],
  },
};

export function AddSheet() {
  const drill = usePanelUi((s) => s.drill);
  const drillInto = usePanelUi((s) => s.drillInto);
  const drillBack = usePanelUi((s) => s.drillBack);
  const closeAdd = usePanelUi((s) => s.closeAdd);
  const addPart = useApp((s) => s.addPart);
  const sectionId = useApp((s) => s.selection.sectionId);

  const nodeId = drill.length ? drill[drill.length - 1]! : "root";
  const node = NODES[nodeId] ?? NODES.root!;
  const atRoot = drill.length === 0;

  const onItem = (item: Item) => {
    if (item.into) {
      drillInto(item.into);
      return;
    }
    // leaf — wire the action (no-op engine until addInstance lands), then close
    if (item.kind && sectionId) addPart(sectionId, item.kind);
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
      {node.items.map((it) => (
        <MenuRow
          key={it.id}
          icon={it.icon}
          title={it.title}
          sub={it.sub}
          trailing={it.into ? "chev" : "none"}
          onPress={() => onItem(it)}
        />
      ))}
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
});
