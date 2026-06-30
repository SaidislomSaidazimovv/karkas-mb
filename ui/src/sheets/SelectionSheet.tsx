// src/sheets/SelectionSheet.tsx — Zone 3 (adaptive selection card / bottom-sheet). OWNER: T2.
//
// v3 §1 adaptive model:
//   • group-of-1 (isUnique) → «Уникальная деталь» — direct edit, NO detach, NO ✂ counter
//   • group-of-N (real group) → «Тип · N деталей» — edit travels, «связаны» + «✂ N», «Отделить»
//   • first edit of a fresh group → one-time «связать / каждая своя» choice (#36, ledger #14)
// Body switches by mode (L7): Build numeric · Material catalog · Hardware segment · Frame doubling.
// design: construction-v3-preview.html §3 + §5.
//
// NOTE (S3-E1 gap): part name + real dimensions come from the engine model/preview, which is
// null in E0. Until the solver lands, the header name falls back to the selection id and the
// numeric fields hold local display state; edits already call the store actions (resize/detach),
// whose engine effect wires in S3-E1.
import { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useApp } from "../../store/appStore";
import { C, FONT } from "../../theme";
import {
  Grab, SheetHeader, Badge, NumberStepper, Segment, Toggle, MenuRow, ListRow, sheetBase,
} from "./controls";

const MATERIAL_CATALOG = [
  { id: "oak-sonoma", name: "ЛДСП Дуб Сонома", sub: "покрытие · 16 мм", swatch: "#DCCDB4" },
  { id: "graphite", name: "ЛДСП Графит", sub: "покрытие · 16 мм", swatch: "#3A3A3A" },
  { id: "white", name: "ЛДСП Белый", sub: "покрытие · 16 мм", swatch: "#EFEEEA" },
];

export function SelectionSheet() {
  const selection = useApp((s) => s.selection);
  const mode = useApp((s) => s.mode);
  const resize = useApp((s) => s.resize);
  const detach = useApp((s) => s.detach);

  // local display state (real values arrive from model/preview in S3-E1)
  const [width, setWidth] = useState(980);
  const [depth, setDepth] = useState(320);
  const [hw, setHw] = useState<"hinge" | "handle" | "slide">("hinge");
  const [material, setMaterial] = useState("oak-sonoma");
  const [partial, setPartial] = useState(true);

  // one-time group choice (#36) — remembered per componentId
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<(() => void) | null>(null);

  if (selection.kind === "none") return null;

  const isGroup = selection.kind === "group" && !selection.isUnique;
  const count = selection.partIds.length;
  const cid = selection.componentId;
  const partId = selection.partIds[0];
  const instId = selection.instanceIds[0];

  // gate a fresh real group's first edit behind the one-time choice
  const guard = (apply: () => void) => {
    if (isGroup && cid && !chosen.has(cid)) {
      setPending(() => apply);
      return;
    }
    apply();
  };
  const resolveChoice = (keepLinked: boolean) => {
    if (cid) setChosen((prev) => new Set(prev).add(cid));
    // "each differs" dissolves the group into unique parts — engine-side (S3-E1). Mark chosen so
    // the prompt never re-fires; the dissolve itself lands when selectByTap is wired.
    pending?.();
    setPending(null);
  };

  // ---- one-time choice overlay (#36) ----
  if (pending) {
    return (
      <View style={[sheetBase, styles.over]}>
        <Grab />
        <SheetHeader icon="link" title={`Новая группа · ${count} полок`} role="Первая правка — как ведём?" />
        <Text style={styles.hint}>Один раз. Запомним выбор.</Text>
        <MenuRow
          icon="link"
          title="Держать связанными"
          sub={`правка одной → всем ${count} (как тип)`}
          trailing="check"
          onPress={() => resolveChoice(true)}
        />
        <MenuRow
          icon="cut"
          title="Каждая будет своя"
          sub={`группа распадётся → ${count} уникальных, без тах`}
          onPress={() => resolveChoice(false)}
        />
      </View>
    );
  }

  return (
    <View style={sheetBase}>
      <Grab />
      {mode === "build" && (
        <BuildBody
          isGroup={isGroup}
          count={count}
          exceptions={selection.exceptions}
          width={width}
          depth={depth}
          onWidth={(v) => guard(() => { setWidth(v); if (partId) resize(partId, "x", v * 10); })}
          onDepth={(v) => guard(() => { setDepth(v); if (partId) resize(partId, "z", v * 10); })}
          onDetach={() => { if (instId) detach(instId); }}
        />
      )}
      {mode === "material" && (
        <MaterialBody selected={material} onSelect={setMaterial} />
      )}
      {mode === "hardware" && (
        <HardwareBody value={hw} onChange={setHw} />
      )}
      {mode === "frame" && (
        <FrameBody partial={partial} onPartial={setPartial} />
      )}
    </View>
  );
}

/* ===================== BUILD ===================== */
function BuildBody({
  isGroup, count, exceptions, width, depth, onWidth, onDepth, onDetach,
}: {
  isGroup: boolean; count: number; exceptions: number;
  width: number; depth: number;
  onWidth: (v: number) => void; onDepth: (v: number) => void; onDetach: () => void;
}) {
  if (!isGroup) {
    // group-of-1 — Уникальная деталь
    return (
      <>
        <SheetHeader icon="select" title="Полка-платье" role="Уникальная деталь">
          <Badge icon="check" label="прямое редактирование" tone="ok" />
        </SheetHeader>
        <NumberStepper label="Ширина" value_mm={width} onChange={onWidth} />
        <NumberStepper label="Глубина" value_mm={depth} onChange={onDepth} />
        <Text style={styles.note}>— нет «отделить», нет счётчика ✂ —</Text>
      </>
    );
  }
  // group-of-N — Тип · N деталей
  return (
    <>
      <SheetHeader icon="link" title="Полка-обувь" role={`Тип · ${count} детали выделено`} roleColor={C.selLine}>
        <Badge icon="link" label="связаны" tone="link" />
        <Badge icon="cut" label={`✂ ${exceptions}`} tone="cut" />
      </SheetHeader>
      <NumberStepper label={`Глубина (применится ко всем ${count})`} value_mm={depth} onChange={onDepth} />
      <MenuRow
        icon="cut"
        title="Отделить эту деталь"
        sub="правка локальная · ✂ +1"
        danger
        onPress={onDetach}
      />
    </>
  );
}

/* ===================== MATERIAL ===================== */
function MaterialBody({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
  return (
    <>
      <View style={styles.counts}>
        <Text style={styles.countsTxt}>{MATERIAL_CATALOG.length * 17} Товаров</Text>
        <View style={styles.filter}>
          <Text style={styles.filterTxt}>⚟ Все фильтры</Text>
        </View>
      </View>
      {MATERIAL_CATALOG.map((m) => (
        <ListRow
          key={m.id}
          swatch={m.swatch}
          title={m.name}
          sub={m.sub}
          selected={m.id === selected}
          onPress={() => onSelect(m.id)}
        />
      ))}
    </>
  );
}

/* ===================== HARDWARE ===================== */
function HardwareBody({
  value, onChange,
}: { value: "hinge" | "handle" | "slide"; onChange: (k: "hinge" | "handle" | "slide") => void }) {
  return (
    <>
      <SheetHeader icon="hinge" title="Дверь-фасад" role="2 петли · накладная" />
      <View style={{ paddingVertical: 6 }}>
        <Segment
          value={value}
          onChange={onChange}
          options={[
            { key: "hinge", label: "Петля" },
            { key: "handle", label: "Ручка" },
            { key: "slide", label: "Направл." },
          ]}
        />
      </View>
    </>
  );
}

/* ===================== FRAME ===================== */
function FrameBody({ partial, onPartial }: { partial: boolean; onPartial: (v: boolean) => void }) {
  return (
    <>
      <SheetHeader icon="double" title="Столешница" role="⧉ удвоение · 32 мм фронт">
        <Badge icon="double" label="2 слоя" tone="comp" />
        <Badge label="кромка 32мм" tone="neutral" />
        <Badge icon="warn" label="риск" tone="warn" />
      </SheetHeader>
      <Toggle label="Частичное удвоение (фронт 100мм)" value={partial} onChange={onPartial} />
    </>
  );
}

const styles = StyleSheet.create({
  over: { borderTopWidth: 0, shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: -4 } },
  hint: { fontFamily: FONT, fontSize: 12.5, color: "#6B6862", marginTop: 2, marginBottom: 6 },
  note: { fontFamily: FONT, fontSize: 12, color: C.ink2, textAlign: "center", paddingTop: 12 },
  counts: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8 },
  countsTxt: { fontFamily: FONT, fontSize: 13, fontWeight: "700", color: C.ink },
  filter: { height: 34, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: C.line, justifyContent: "center" },
  filterTxt: { fontFamily: FONT, fontSize: 12.5, fontWeight: "600", color: C.ink3 },
});
