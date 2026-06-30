// src/layers/LayersPanel.tsx — Zone 5 (layers tree). OWNER: T2.
//
// S3-T2B: walks the LIVE engine model (store.model) — components × instances — into a badge
// tree. Badge vocabulary (v3 §4): plain=unique part(group-of-1) · 🔗=linked group(2+) ·
// ✂=detached(exception) · ●=material-role colour dot. design: construction-v3-preview.html §6.
//
// A Component placed once → plain unique row; placed 2+ (linked) → one «🔗 ×N» group row;
// each detached instance (link==="detached") → its own ✂ row. The demo cabinet has one type
// «Полка» ×3 linked, so this renders «Полка ×3 🔗» from real data.
import { View, Text, StyleSheet } from "react-native";
import { useApp } from "../../store/appStore";
import type { PanelRole, StructuralModel } from "../../engineBridge";
import { C, FONT, R } from "../../theme";
import { Icon, type IconName } from "../chrome/Icon";

type Row = {
  name: string;
  dot: string; // material-role colour (●)
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
        rows.push({ name: comp.name, dot, indent: true, count: linked.length, badges: [{ icon: "link", color: C.selLine }] });
      } else if (linked.length === 1) {
        rows.push({ name: comp.name, dot }); // unique → plain, no badge
      }
      for (const _d of detached) {
        rows.push({ name: comp.name, dot: C.selPink, indent: true, badges: [{ icon: "cut", color: "#D4392F" }] });
      }
    }
  }
  return rows;
}

export function LayersPanel() {
  const model = useApp((s) => s.model);
  const rows = model ? modelToRows(model) : [];
  return (
    <View style={styles.panel}>
      <View style={styles.head}>
        <Text style={styles.title}>Слои · структура</Text>
        <Icon name="layers" size={18} color={C.ink2} />
      </View>
      {rows.length === 0 ? (
        <Text style={styles.empty}>Нет деталей</Text>
      ) : (
        <View style={styles.tree}>
          {rows.map((r, i) => (
            <TreeRow key={i} row={r} />
          ))}
        </View>
      )}
    </View>
  );
}

function TreeRow({ row }: { row: Row }) {
  return (
    <View style={[styles.row, row.indent && styles.indent]}>
      <View style={[styles.dot, { backgroundColor: row.dot }]} />
      <Text style={styles.name}>{row.name}</Text>
      {row.badges?.map((b, i) => (
        <View key={i} style={styles.badge}>
          <Icon name={b.icon} size={13} color={b.color} />
        </View>
      ))}
      {row.count ? <Text style={styles.count}>×{row.count}</Text> : null}
      <View style={styles.eyes}>
        <Icon name="eye" size={14} color={C.ink2} />
      </View>
    </View>
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
  title: { fontFamily: FONT, fontSize: 17, fontWeight: "800", color: C.ink },
  empty: { fontFamily: FONT, fontSize: 13, color: C.ink2, paddingVertical: 12, textAlign: "center" },
  tree: { marginTop: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: "#F2F1EE" },
  indent: { paddingLeft: 18 },
  dot: { width: 11, height: 11, borderRadius: 999 },
  name: { fontFamily: FONT, fontSize: 14.5, fontWeight: "600", color: C.ink, flex: 1 },
  badge: { marginLeft: 2 },
  count: { fontFamily: FONT, fontSize: 11, color: C.ink2, marginLeft: 4 },
  eyes: { flexDirection: "row", alignItems: "center", gap: 8, marginLeft: 8 },
});
