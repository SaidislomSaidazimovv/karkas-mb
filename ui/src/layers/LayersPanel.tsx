// src/layers/LayersPanel.tsx — Zone 5 (layers tree). OWNER: T2.
//
// S3-T2B: walks the LIVE engine model (store.model) — components × instances — into a badge
// tree. Badge vocabulary (v3 §4): plain=unique part(group-of-1) · 🔗=linked group(2+) ·
// ✂=detached(exception) · ●=material-role colour dot. design: construction-v3-preview.html §6.
//
// S3-T2C: rows are tappable → select that part (node → `${blockId}__inst_${id}` → store.tapPart);
// the selected row highlights (group row lights when its type is selected). The eye toggle is a
// visual affordance for now — wires to 3D-hide when store.hiddenIds lands (P, gated).
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useApp } from "../../store/appStore";
import { usePanelUi } from "../sheets/panelUi";
import type { PanelRole, StructuralModel } from "../../engineBridge";
import { C, FONT, R } from "../../theme";
import { Icon, type IconName } from "../chrome/Icon";

type Row = {
  name: string;
  dot: string; // material-role colour (●)
  partId: string; // the leaf part this row taps to select
  componentId: string; // for group-highlight (whole type selected)
  group: boolean; // true = linked group(2+) row → highlight by componentId
  indent?: boolean;
  badges?: { icon: IconName; color: string }[];
  count?: number; // ×N for a linked group
};

const ROLE_DOT: Record<PanelRole, string> = {
  carcass_side: "#B88A52",
  carcass_back: "#9AA3AD",
  carcass_bottom: "#A4763F",
  carcass_top: "#A4763F",
  facade: "#9AA3AD",
  internal_shelf: "#C9A273",
};
const roleDot = (role: PanelRole | null) => (role ? ROLE_DOT[role] : "#9AA3AD");
const partIdOf = (blockId: string, instanceId: string) => `${blockId}__inst_${instanceId}`;

/** Component × instance → tree rows, applying the v3 §4 badge rules. */
function modelToRows(model: StructuralModel): Row[] {
  const rows: Row[] = [];
  for (const block of model.blocks) {
    for (const comp of block.components) {
      const insts = block.instances.filter((i) => i.componentId === comp.id);
      if (insts.length === 0) continue;
      const linked = insts.filter((i) => i.link !== "detached");
      const detached = insts.filter((i) => i.link === "detached");
      const dot = roleDot(comp.role);

      if (linked.length >= 2) {
        rows.push({
          name: comp.name, dot, partId: partIdOf(block.id, linked[0]!.id), componentId: comp.id,
          group: true, indent: true, count: linked.length, badges: [{ icon: "link", color: C.selLine }],
        });
      } else if (linked.length === 1) {
        rows.push({ name: comp.name, dot, partId: partIdOf(block.id, linked[0]!.id), componentId: comp.id, group: false });
      }
      for (const d of detached) {
        rows.push({
          name: comp.name, dot: C.selPink, partId: partIdOf(block.id, d.id), componentId: comp.id,
          group: false, indent: true, badges: [{ icon: "cut", color: "#D4392F" }],
        });
      }
    }
  }
  return rows;
}

export function LayersPanel() {
  const model = useApp((s) => s.model);
  const selection = useApp((s) => s.selection);
  const tapPart = useApp((s) => s.tapPart);
  const hiddenIds = useApp((s) => s.hiddenIds);
  const toggleHidden = useApp((s) => s.toggleHidden);
  const showAll = useApp((s) => s.showAll);
  const close = usePanelUi((s) => s.close);
  const rows = model ? modelToRows(model) : [];

  const isSelected = (r: Row) =>
    r.group ? selection.componentId === r.componentId : selection.partIds.includes(r.partId);

  return (
    <View style={styles.panel}>
      <View style={styles.head}>
        <Text style={styles.title}>Слои · структура</Text>
        <View style={styles.headRight}>
          {hiddenIds.length > 0 ? (
            <Pressable hitSlop={6} onPress={showAll}>
              <Text style={styles.showAll}>Показать все</Text>
            </Pressable>
          ) : null}
          <Pressable style={styles.close} hitSlop={6} onPress={close}>
            <Icon name="close" size={18} color={C.ink} />
          </Pressable>
        </View>
      </View>
      {rows.length === 0 ? (
        <Text style={styles.empty}>Нет деталей</Text>
      ) : (
        <View style={styles.tree}>
          {rows.map((r, i) => (
            <TreeRow
              key={i}
              row={r}
              selected={isSelected(r)}
              hidden={hiddenIds.includes(r.partId)}
              onSelect={() => tapPart(r.partId)}
              onToggleHidden={() => toggleHidden(r.partId)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function TreeRow({
  row, selected, hidden, onSelect, onToggleHidden,
}: {
  row: Row; selected: boolean; hidden: boolean; onSelect: () => void; onToggleHidden: () => void;
}) {
  return (
    <Pressable style={[styles.row, row.indent && styles.indent, selected && styles.rowOn]} onPress={onSelect}>
      <View style={[styles.dot, { backgroundColor: row.dot }, hidden && styles.faded]} />
      <Text style={[styles.name, selected && styles.nameOn, hidden && styles.nameHidden]}>{row.name}</Text>
      {row.badges?.map((b, i) => (
        <View key={i} style={[styles.badge, hidden && styles.faded]}>
          <Icon name={b.icon} size={13} color={b.color} />
        </View>
      ))}
      {row.count ? <Text style={[styles.count, hidden && styles.faded]}>×{row.count}</Text> : null}
      <Pressable style={styles.eye} hitSlop={6} onPress={onToggleHidden}>
        <Icon name="eye" size={14} color={hidden ? C.disabled : C.ink2} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: C.bg,
    borderTopLeftRadius: R.sheet,
    borderTopRightRadius: R.sheet,
    borderTopWidth: 1,
    borderTopColor: C.line,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 18,
  },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  headRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  close: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: FONT, fontSize: 17, fontWeight: "800", color: C.ink },
  showAll: { fontFamily: FONT, fontSize: 13, fontWeight: "700", color: C.selLine },
  empty: { fontFamily: FONT, fontSize: 13, color: C.ink2, paddingVertical: 12, textAlign: "center" },
  tree: { marginTop: 2 },
  row: {
    flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 9, paddingHorizontal: 8,
    marginHorizontal: -8, borderRadius: 10, borderBottomWidth: 1, borderBottomColor: "#F2F1EE",
  },
  rowOn: { backgroundColor: "#EAF0FF", borderBottomColor: "#EAF0FF" },
  indent: { paddingLeft: 18 },
  dot: { width: 11, height: 11, borderRadius: 999 },
  name: { fontFamily: FONT, fontSize: 14.5, fontWeight: "600", color: C.ink, flex: 1 },
  nameOn: { color: C.selLine, fontWeight: "700" },
  nameHidden: { color: C.disabled },
  faded: { opacity: 0.4 },
  badge: { marginLeft: 2 },
  count: { fontFamily: FONT, fontSize: 11, color: C.ink2, marginLeft: 4 },
  eye: { marginLeft: 8, padding: 2 },
});
