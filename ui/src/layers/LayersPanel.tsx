// src/layers/LayersPanel.tsx — Zone 5 (layers tree). OWNER: T2.
//
// Badge vocabulary (v3 §4): (plain)=unique part · ◇=rule slot · 🔗=linked group(2+) ·
//   ✂=detached · ⧉=doubled · ⚠=stability risk · ●=material-role colour dot.
// design: construction-v3-preview.html §6 (.tree / .tnode).
//
// Mounted as a togglable overlay (not in the default E0 shell).
// NOTE (S3-E1 gap): rows derive from the engine model, which is null in E0. Until the solver
// populates `model`, a labelled demonstration tree renders the full badge vocabulary so the
// design-system match is verifiable; swap DEMO_NODES for a model walk when the model is real.
import { View, Text, StyleSheet } from "react-native";
import { C, FONT, R } from "../../theme";
import { Icon, type IconName } from "../chrome/Icon";

type Node = {
  name: string;
  dot: string; // material-role colour (●)
  indent?: boolean;
  badges?: { icon: IconName; color: string }[];
  count?: number; // ×N for a group
  locked?: boolean;
};

// Demonstration data — mirrors design §6 (Полка-платье unique / Полка-обувь ×3 linked /
// Полка-обувь detached / Столешница doubled+risk / Штанга). Replace with a model walk in S3-E1.
const DEMO_NODES: Node[] = [
  { name: "Полка-платье", dot: "#CAA169", locked: true },
  { name: "Полка-обувь", dot: C.sel, indent: true, badges: [{ icon: "link", color: C.selLine }], count: 3 },
  { name: "Полка-обувь", dot: C.selPink, indent: true, badges: [{ icon: "cut", color: "#D4392F" }] },
  { name: "Столешница", dot: "#B88A52", badges: [{ icon: "double", color: "#6A4FB0" }, { icon: "warn", color: C.warn }] },
  { name: "Штанга", dot: "#9AA3AD" },
];

export function LayersPanel({ nodes = DEMO_NODES }: { nodes?: Node[] }) {
  return (
    <View style={styles.panel}>
      <View style={styles.head}>
        <Text style={styles.title}>Слои · структура</Text>
        <Icon name="layers" size={18} color={C.ink2} />
      </View>
      <View style={styles.tree}>
        {nodes.map((n, i) => (
          <TreeRow key={i} node={n} />
        ))}
      </View>
    </View>
  );
}

function TreeRow({ node }: { node: Node }) {
  return (
    <View style={[styles.row, node.indent && styles.indent]}>
      <View style={[styles.dot, { backgroundColor: node.dot }]} />
      <Text style={styles.name}>{node.name}</Text>
      {node.badges?.map((b, i) => (
        <View key={i} style={styles.badge}>
          <Icon name={b.icon} size={13} color={b.color} />
        </View>
      ))}
      {node.count ? <Text style={styles.count}>×{node.count}</Text> : null}
      <View style={styles.eyes}>
        <Icon name="eye" size={14} color={C.ink2} />
        {node.locked ? <Icon name="lock" size={14} color={C.ink2} /> : null}
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
  tree: { marginTop: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: "#F2F1EE" },
  indent: { paddingLeft: 18 },
  dot: { width: 11, height: 11, borderRadius: 999 },
  name: { fontFamily: FONT, fontSize: 14.5, fontWeight: "600", color: C.ink, flex: 1 },
  badge: { marginLeft: 2 },
  count: { fontFamily: FONT, fontSize: 11, color: C.ink2, marginLeft: 4 },
  eyes: { flexDirection: "row", alignItems: "center", gap: 8, marginLeft: 8 },
});
