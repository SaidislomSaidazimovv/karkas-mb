// src/chrome/ExportSheet.tsx — «Готово»/CNC-export shell. OWNER: T2.
//
// S3-T2D: the visual «Каркас готов» flow — a real cut-list from store.scene + live price + count.
// S3-U1: «Экспорт На ЧПУ» is now WIRED to the engine — store.exportCutFile() returns byte-exact
//   SWJ008 XML (drill + emit-gate passed) or a gate error. On success we download it as an .xml
//   (web Blob + <a download>) and show «Готово ✓»; on failure we show the gate error in a red
//   banner and leave the button ready to retry. The cut-list preview is unchanged.
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

/** Trigger a browser file download (web only). Returns false on native (no DOM). */
function downloadXml(filename: string, text: string): boolean {
  const g = globalThis as any;
  if (typeof g.document === "undefined" || typeof g.Blob === "undefined") return false;
  const blob = new g.Blob([text], { type: "application/xml" });
  const url = g.URL.createObjectURL(blob);
  const a = g.document.createElement("a");
  a.href = url;
  a.download = filename;
  g.document.body.appendChild(a);
  a.click();
  g.document.body.removeChild(a);
  g.URL.revokeObjectURL(url);
  return true;
}

export function ExportSheet() {
  const scene = useApp((s) => s.scene);
  const price = useApp((s) => s.price_sum);
  const exportCutFile = useApp((s) => s.exportCutFile);
  const closeExport = usePanelUi((s) => s.closeExport);

  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onExport = () => {
    const res = exportCutFile();
    if (res.ok) {
      downloadXml("karkas_swj008.xml", res.text);
      setError(null);
      setDone(true);
    } else {
      setDone(false);
      setError(res.error);
    }
  };

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

      {error ? (
        <View style={styles.errBanner}>
          <Icon name="warn" size={14} color="#D4392F" />
          <Text style={styles.errTxt}>{error}</Text>
        </View>
      ) : null}

      <Pressable style={[styles.cnc, done && styles.cncDone]} onPress={onExport}>
        <Text style={styles.cncTxt}>{done ? "Готово ✓" : "Экспорт На ЧПУ"}</Text>
      </Pressable>
      <Text style={styles.seam}>
        {done ? "Файл SWJ008 загружен (karkas_swj008.xml)" : "Формат SWJ008 · крой-файл станка (byte-exact)"}
      </Text>
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

  errBanner: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: "#FBECED", borderRadius: 12, padding: 10, marginTop: 12,
  },
  errTxt: { fontFamily: FONT, fontSize: 12.5, color: "#D4392F", flex: 1, lineHeight: 17 },

  cnc: { height: 50, borderRadius: R.pill, backgroundColor: C.black, alignItems: "center", justifyContent: "center", marginTop: 14 },
  cncDone: { backgroundColor: C.ok },
  cncTxt: { fontFamily: FONT, fontSize: 15, fontWeight: "700", color: "#FFFFFF" },
  seam: { fontFamily: FONT, fontSize: 11, color: C.ink2, textAlign: "center", marginTop: 8 },
});
