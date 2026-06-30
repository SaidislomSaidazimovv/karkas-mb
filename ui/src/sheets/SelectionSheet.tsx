// src/sheets/SelectionSheet.tsx — Zone 3 (adaptive selection card / bottom-sheet). OWNER: T2.
//
// S3-T2B: header NAME + dimensions now come from the LIVE engine — the selected part's
// Component.name (store.model) and its placed size (store.scene), no more local-only fallback.
// Steppers call store.resize / store.detach (engine resize op lands in a later slice; the call
// is wired now, the display is optimistic and re-seeds from the real scene on each selection).
//
// v3 §1 adaptive model:
//   • group-of-1 (isUnique) → «Уникальная деталь» — direct edit, NO detach, NO ✂ counter
//   • group-of-N → «Тип · N деталей» — edit travels, «связаны» + «✂ N», «Отделить»
//   • first edit of a fresh group → one-time «связать / каждая своя» choice (#36, ledger #14)
// Body switches by mode (L7). Material/Hardware/Frame controls are design placeholders until
// their engine backing (S3-E5/E6); their header shows the real selected part name.
// design: construction-v3-preview.html §3 + §5.
import { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useApp } from "../../store/appStore";
import type { PanelPlacement, StructuralModel } from "../../engineBridge";
import { C, FONT } from "../../theme";
import {
  Grab, SheetHeader, Badge, NumberStepper, Segment, Toggle, MenuRow, ListRow, sheetBase,
} from "./controls";

const MATERIAL_CATALOG = [
  { id: "oak-sonoma", name: "ЛДСП Дуб Сонома", sub: "покрытие · 16 мм", swatch: "#DCCDB4" },
  { id: "graphite", name: "ЛДСП Графит", sub: "покрытие · 16 мм", swatch: "#3A3A3A" },
  { id: "white", name: "ЛДСП Белый", sub: "покрытие · 16 мм", swatch: "#EFEEEA" },
];

function componentName(model: StructuralModel | null, componentId?: string): string | null {
  if (!model || !componentId) return null;
  for (const b of model.blocks) {
    const c = b.components.find((x) => x.id === componentId);
    if (c) return c.name;
  }
  return null;
}

export function SelectionSheet() {
  const model = useApp((s) => s.model);
  const scene = useApp((s) => s.scene);
  const selection = useApp((s) => s.selection);
  const mode = useApp((s) => s.mode);
  const resize = useApp((s) => s.resize);
  const detach = useApp((s) => s.detach);

  const partId = selection.partIds[0];
  const placement: PanelPlacement | undefined = scene.find((p) => p.id === partId);
  const name = componentName(model, selection.componentId) ?? placement?.name ?? "Деталь";

  // real placed size (mm) — the source of truth; steppers seed from this per selection
  const wReal = placement ? Math.round(placement.w_mm10 / 10) : 0;
  const dReal = placement ? Math.round(placement.d_mm10 / 10) : 0;

  // optimistic edit overrides; reset to real whenever the selected part changes
  const [wOver, setWOver] = useState<number | null>(null);
  const [dOver, setDOver] = useState<number | null>(null);
  useEffect(() => { setWOver(null); setDOver(null); }, [partId]);
  const width = wOver ?? wReal;
  const depth = dOver ?? dReal;

  // local UI state for placeholder modes
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
  const instId = selection.instanceIds[0];

  // gate a fresh real group's first edit behind the one-time choice
  const guard = (apply: () => void) => {
    if (isGroup && cid && !chosen.has(cid)) {
      setPending(() => apply);
      return;
    }
    apply();
  };
  const resolveChoice = () => {
    if (cid) setChosen((prev) => new Set(prev).add(cid));
    pending?.();
    setPending(null);
  };

  // ---- one-time choice overlay (#36) ----
  if (pending) {
    return (
      <View style={[sheetBase, styles.over]}>
        <Grab />
        <SheetHeader icon="link" title={`Новая группа · ${count} деталей`} role="Первая правка — как ведём?" />
        <Text style={styles.hint}>Один раз. Запомним выбор.</Text>
        <MenuRow icon="link" title="Держать связанными" sub={`правка одной → всем ${count} (как тип)`} trailing="check" onPress={resolveChoice} />
        <MenuRow icon="cut" title="Каждая будет своя" sub={`группа распадётся → ${count} уникальных, без тах`} onPress={resolveChoice} />
      </View>
    );
  }

  return (
    <View style={sheetBase}>
      <Grab />
      {mode === "build" && (
        <BuildBody
          name={name}
          isGroup={isGroup}
          count={count}
          exceptions={selection.exceptions}
          width={width}
          depth={depth}
          onWidth={(v) => guard(() => { setWOver(v); if (partId) resize(partId, "x", v * 10); })}
          onDepth={(v) => guard(() => { setDOver(v); if (partId) resize(partId, "z", v * 10); })}
          onDetach={() => { if (instId) detach(instId); }}
        />
      )}
      {mode === "material" && <MaterialBody selected={material} onSelect={setMaterial} />}
      {mode === "hardware" && <HardwareBody name={name} value={hw} onChange={setHw} />}
      {mode === "frame" && <FrameBody name={name} partial={partial} onPartial={setPartial} />}
    </View>
  );
}

/* ===================== BUILD ===================== */
function BuildBody({
  name, isGroup, count, exceptions, width, depth, onWidth, onDepth, onDetach,
}: {
  name: string; isGroup: boolean; count: number; exceptions: number;
  width: number; depth: number;
  onWidth: (v: number) => void; onDepth: (v: number) => void; onDetach: () => void;
}) {
  if (!isGroup) {
    return (
      <>
        <SheetHeader icon="select" title={name} role="Уникальная деталь">
          <Badge icon="check" label="прямое редактирование" tone="ok" />
        </SheetHeader>
        <NumberStepper label="Ширина" value_mm={width} onChange={onWidth} />
        <NumberStepper label="Глубина" value_mm={depth} onChange={onDepth} />
        <Text style={styles.note}>— нет «отделить», нет счётчика ✂ —</Text>
      </>
    );
  }
  return (
    <>
      <SheetHeader icon="link" title={name} role={`Тип · ${count} детали выделено`} roleColor={C.selLine}>
        <Badge icon="link" label="связаны" tone="link" />
        <Badge icon="cut" label={`✂ ${exceptions}`} tone="cut" />
      </SheetHeader>
      <NumberStepper label={`Глубина (применится ко всем ${count})`} value_mm={depth} onChange={onDepth} />
      <MenuRow icon="cut" title="Отделить эту деталь" sub="правка локальная · ✂ +1" danger onPress={onDetach} />
    </>
  );
}

/* ===================== MATERIAL (placeholder body — engine: S3-E5) ===================== */
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
        <ListRow key={m.id} swatch={m.swatch} title={m.name} sub={m.sub} selected={m.id === selected} onPress={() => onSelect(m.id)} />
      ))}
    </>
  );
}

/* ===================== HARDWARE (placeholder body — engine: S3-E6) ===================== */
function HardwareBody({
  name, value, onChange,
}: { name: string; value: "hinge" | "handle" | "slide"; onChange: (k: "hinge" | "handle" | "slide") => void }) {
  return (
    <>
      <SheetHeader icon="hinge" title={name} role="2 петли · накладная" />
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

/* ===================== FRAME (placeholder body — engine: S3-E6) ===================== */
function FrameBody({ name, partial, onPartial }: { name: string; partial: boolean; onPartial: (v: boolean) => void }) {
  return (
    <>
      <SheetHeader icon="double" title={name} role="⧉ удвоение · 32 мм фронт">
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
