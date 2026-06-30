// src/chrome/ExportSheet.tsx — «Готово»/CNC-export shell. OWNER: T2.
//
// S3-T2D: the visual «Каркас готов» flow — a real cut-list built from store.scene (every solved
// panel) + the live price_sum + part count, with an «Экспорт На ЧПУ» button. The button is a
// SEAM: it stays a no-op placeholder until the engine emits the real SWJ008 file (S3-E2/E6).
// design: Part-1 «Готово» screen (cut-list · ticker · export-to-CNC).
import { useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { useApp } from "../../store/appStore";
import { usePanelUi } from "../sheets/panelUi";
import { sheetBase } from "../sheets/controls";
import { C, FONT, R } from "../../theme";
import { Icon } from "./Icon";

/** Panel face size = the two largest of (w,h,d); the smallest is the 16 mm thickness. */
function faceSize(w_mm10: number, h_mm10: number, d_mm10: number): string {
  const dims = [w_mm10, h_mm10, d_mm10].map((v) => Math.round(v / 10)).sort((a, b) => b - a);
  return `${dims[0]} × ${dims[1]} мм`;
}

export function ExportSheet() {
  const scene = useApp((s) => s.scene);
  const price = useApp((s) => s.price_sum);
  const closeExport = usePanelUi((s) => s.closeExport);
  const [queued, setQueued] = useState(false);

  return (
    <View style={[sheetBase, styles.over]}>
      <View style={styles.head}>
        <View style={styles.okIcon}>
          <Icon name="check" size={18} color={C.ok} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Каркас готов</Text>
          <Text style={styles.sub}>{scene.length} деталей · крой-лист</Text>
        </View>
        <Pressable style={styles.close} onPress={closeExport} hitSlop={6}>
          <Icon name="close" size={18} color={C.ink} />
        </Pressable>
      </View>

      <View style={styles.ticker}>
        <Text style={styles.price}>{price.toLocaleString("ru-RU")}</Text>
        <Text style={styles.cur}> сум</Text>
      </View>

      <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 4 }}>
        {scene.map((p) => (
          <View key={p.id} style={styles.row}>
            <Text style={styles.rowName} numberOfLines={1}>{p.name}</Text>
            <Text style={styles.rowDim}>{faceSize(p.w_mm10, p.h_mm10, p.d_mm10)}</Text>
          </View>
        ))}
      </ScrollView>

      <Pressable style={[styles.cnc, queued && styles.cncDone]} onPress={() => setQueued(true)}>
        <Text style={styles.cncTxt}>{queued ? "В очереди на ЧПУ ✓" : "Экспорт На ЧПУ"}</Text>
      </Pressable>
      <Text style={styles.seam}>Формат SWJ008 · подключается, когда движок эмитит файл (S3-E2/E6)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  over: { borderTopWidth: 0, shadowColor: "#000", shadowOpacity: 0.14, shadowRadius: 18, shadowOffset: { width: 0, height: -4 } },
  head: { flexDirection: "row", alignItems: "center", gap: 10, paddingBottom: 8 },
  okIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: "#E7F4EC", alignItems: "center", justifyContent: "center" },
  title: { fontFamily: FONT, fontSize: 17, fontWeight: "800", color: C.ink },
  sub: { fontFamily: FONT, fontSize: 12.5, color: C.ink2, marginTop: 1 },
  close: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },

  ticker: { flexDirection: "row", alignItems: "baseline", paddingVertical: 6 },
  price: { fontFamily: FONT, fontSize: 22, fontWeight: "800", color: C.ink },
  cur: { fontFamily: FONT, fontSize: 13, fontWeight: "600", color: C.ink2 },

  list: { maxHeight: 240, marginTop: 4 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F2F1EE" },
  rowName: { fontFamily: FONT, fontSize: 14, fontWeight: "600", color: C.ink, flex: 1, paddingRight: 10 },
  rowDim: { fontFamily: FONT, fontSize: 13, color: C.ink3 },

  cnc: { height: 50, borderRadius: R.pill, backgroundColor: C.black, alignItems: "center", justifyContent: "center", marginTop: 14 },
  cncDone: { backgroundColor: C.ok },
  cncTxt: { fontFamily: FONT, fontSize: 15, fontWeight: "700", color: "#FFFFFF" },
  seam: { fontFamily: FONT, fontSize: 11, color: C.ink2, textAlign: "center", marginTop: 8 },
});
