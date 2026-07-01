// src/sheets/controls.tsx — reusable bottom-sheet controls. OWNER: T2.
// Numeric stepper / segment / toggle / menu-row / list-row / badge — the control
// vocabulary the Selection card composes per mode (design: construction-v3-preview.html §3/§5).

import { useState } from "react";
import { View, Text, Pressable, StyleSheet, type ViewStyle } from "react-native";
import { C, FONT, R } from "../../theme";
import { Icon, type IconName } from "../chrome/Icon";

/* ---- grab handle ---- */
export function Grab() {
  return <View style={s.grab} />;
}

/* ---- selection header: icon + title + role + optional badge line ---- */
export function SheetHeader({
  icon,
  title,
  role,
  roleColor,
  children,
}: {
  icon: IconName;
  title: string;
  role: string;
  roleColor?: string;
  children?: React.ReactNode;
}) {
  return (
    <View style={s.head}>
      <View style={s.headIcon}>
        <Icon name={icon} size={18} color={C.ink} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.headTitle}>{title}</Text>
        <Text style={[s.headRole, roleColor ? { color: roleColor } : null]}>{role}</Text>
        {children ? <View style={s.badgeLine}>{children}</View> : null}
      </View>
    </View>
  );
}

/* ---- badge pill (used in header badge line) ---- */
export function Badge({
  icon,
  label,
  tone = "neutral",
}: {
  icon?: IconName;
  label: string;
  tone?: "neutral" | "link" | "cut" | "ok" | "warn" | "comp";
}) {
  const t = BADGE_TONE[tone];
  return (
    <View style={[s.badge, { backgroundColor: t.bg }]}>
      {icon ? <Icon name={icon} size={11} color={t.fg} /> : null}
      <Text style={[s.badgeTxt, { color: t.fg }]}>{label}</Text>
    </View>
  );
}
const BADGE_TONE = {
  neutral: { bg: C.field, fg: C.ink3 },
  link: { bg: "#EAF0FF", fg: C.selLine },
  cut: { bg: "#FBECED", fg: "#D4392F" },
  ok: { bg: "#E7F4EC", fg: C.ok },
  warn: { bg: "#FBF0E2", fg: C.warn },
  comp: { bg: "#EFEAFA", fg: "#6A4FB0" },
} as const;

/* ---- numeric stepper ( – | value мм | + ) ---- */
export function NumberStepper({
  label,
  value_mm,
  unit = "мм",
  step = 10,
  min = 0,
  max = 4000,
  onChange,
}: {
  label?: string;
  value_mm: number;
  unit?: string;
  step?: number;
  min?: number;
  max?: number;
  onChange?: (next_mm: number) => void;
}) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  return (
    <View style={s.ctl}>
      {label ? <Text style={s.ctlLabel}>{label}</Text> : null}
      <View style={s.num}>
        <Pressable style={s.pm} onPress={() => onChange?.(clamp(value_mm - step))} hitSlop={6}>
          <Text style={s.pmTxt}>–</Text>
        </Pressable>
        <View style={s.numVal}>
          <Text style={s.numNum}>{value_mm.toLocaleString("ru-RU")}</Text>
          <Text style={s.numUnit}> {unit}</Text>
        </View>
        <Pressable style={s.pm} onPress={() => onChange?.(clamp(value_mm + step))} hitSlop={6}>
          <Text style={s.pmTxt}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

/* ---- segmented control ---- */
export function Segment<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange?: (key: T) => void;
}) {
  return (
    <View style={s.seg}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable key={o.key} style={[s.segOpt, on && s.segOptOn]} onPress={() => onChange?.(o.key)}>
            <Text style={[s.segTxt, on && s.segTxtOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ---- toggle row ---- */
export function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange?: (next: boolean) => void;
}) {
  return (
    <Pressable style={s.tgl} onPress={() => onChange?.(!value)}>
      <Text style={s.tglLabel}>{label}</Text>
      <View style={[s.sw, value && s.swOn]}>
        <View style={[s.knob, value && s.knobOn]} />
      </View>
    </Pressable>
  );
}

/* ---- menu row (drill / action) ---- */
export function MenuRow({
  icon,
  title,
  sub,
  trailing = "chev",
  danger = false,
  onPress,
}: {
  icon: IconName;
  title: string;
  sub?: string;
  trailing?: "chev" | "check" | "none";
  danger?: boolean;
  onPress?: () => void;
}) {
  const fg = danger ? "#D4392F" : C.ink;
  return (
    <Pressable style={s.menuRow} onPress={onPress}>
      <View style={[s.menuIcon, danger && { backgroundColor: "#FBECED" }]}>
        <Icon name={icon} size={16} color={fg} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.menuTitle, danger && { color: fg }]}>{title}</Text>
        {sub ? <Text style={s.menuSub}>{sub}</Text> : null}
      </View>
      {trailing !== "none" ? <Icon name={trailing} size={16} color={C.ink2} /> : null}
    </Pressable>
  );
}

/* ---- catalog list row (material) ---- */
export function ListRow({
  swatch,
  title,
  sub,
  selected = false,
  onPress,
}: {
  swatch: string;
  title: string;
  sub?: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable style={s.listRow} onPress={onPress}>
      <View style={[s.swatch, { backgroundColor: swatch }]} />
      <View style={{ flex: 1 }}>
        <Text style={s.listTitle}>{title}</Text>
        {sub ? <Text style={s.listSub}>{sub}</Text> : null}
      </View>
      <Icon name={selected ? "check" : "chev"} size={16} color={selected ? C.selLine : C.ink2} />
    </Pressable>
  );
}

/* ---- per-edge kromka (Material mode, §5) — band thickness per cabinet edge ---- */
export type EdgeBand = "none" | "16" | "32";
export type EdgeKey = "t" | "b" | "l" | "r";
export const NEXT_BAND: Record<EdgeBand, EdgeBand> = { none: "16", "16": "32", "32": "none" };
const EDGES: { key: EdgeKey; label: string }[] = [
  { key: "t", label: "Сверху" },
  { key: "b", label: "Снизу" },
  { key: "l", label: "Слева" },
  { key: "r", label: "Справа" },
];

export function EdgeKromka({
  values, onCycle,
}: {
  values: Record<EdgeKey, EdgeBand>;
  onCycle: (edge: EdgeKey) => void;
}) {
  return (
    <View style={ek.wrap}>
      <Text style={ek.label}>Кромка по краям (мм) · тап меняет</Text>
      <View style={ek.grid}>
        {EDGES.map((e) => {
          const v = values[e.key];
          const on = v !== "none";
          return (
            <Pressable key={e.key} style={[ek.chip, on && ek.chipOn]} onPress={() => onCycle(e.key)}>
              <Text style={[ek.edge, on && ek.edgeOn]}>{e.label}</Text>
              <Text style={[ek.val, on && ek.valOn]}>{v === "none" ? "нет" : v}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const ek = StyleSheet.create({
  wrap: { paddingTop: 10 },
  label: { fontFamily: FONT, fontSize: 12.5, color: C.ink3, marginBottom: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    width: "47%", flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    height: 44, paddingHorizontal: 12, borderRadius: 12, backgroundColor: C.field,
    borderWidth: 1, borderColor: C.field,
  },
  chipOn: { borderColor: C.selLine, backgroundColor: "#EAF0FF" },
  edge: { fontFamily: FONT, fontSize: 13, fontWeight: "600", color: C.ink2 },
  edgeOn: { color: C.ink },
  val: { fontFamily: FONT, fontSize: 14, fontWeight: "800", color: C.disabled },
  valOn: { color: C.selLine },
});

/* ---- non-blocking ⚠ warnings (S3-U3) — stability / hinge-fit / motion findings ----
   Collapsed pill «⚠ N …»; tap expands the per-finding message_ru list. risk=red, warn=amber. */
export type WarnLevel = "warn" | "risk";
export type WarnItem = { level: WarnLevel; message: string };

export function Warnings({ items }: { items: readonly WarnItem[] }) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  const worst: WarnLevel = items.some((i) => i.level === "risk") ? "risk" : "warn";
  const tone = worst === "risk" ? { bg: "#FBECED", fg: "#D4392F" } : { bg: "#FBF0E2", fg: C.warn };
  const summary = items.length === 1 ? "1 предупреждение" : `${items.length} предупреждения`;
  return (
    <View style={w.wrap}>
      <Pressable style={[w.pill, { backgroundColor: tone.bg }]} onPress={() => setOpen((v) => !v)}>
        <Icon name="warn" size={13} color={tone.fg} />
        <Text style={[w.pillTxt, { color: tone.fg }]}>{summary}</Text>
        <Text style={[w.caret, { color: tone.fg }]}>{open ? "▾" : "▸"}</Text>
      </Pressable>
      {open
        ? items.map((it, i) => (
            <View key={i} style={w.msgRow}>
              <View style={[w.dot, { backgroundColor: it.level === "risk" ? "#D4392F" : C.warn }]} />
              <Text style={w.msgTxt}>{it.message}</Text>
            </View>
          ))
        : null}
    </View>
  );
}

const w = StyleSheet.create({
  wrap: { paddingTop: 8, paddingBottom: 2 },
  pill: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", height: 26, paddingHorizontal: 10, borderRadius: 999 },
  pillTxt: { fontFamily: FONT, fontSize: 12.5, fontWeight: "700" },
  caret: { fontFamily: FONT, fontSize: 11, fontWeight: "700" },
  msgRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingTop: 8 },
  dot: { width: 7, height: 7, borderRadius: 999, marginTop: 5 },
  msgTxt: { fontFamily: FONT, fontSize: 12.5, color: C.ink3, flex: 1, lineHeight: 17 },
});

export const sheetBase: ViewStyle = {
  // Absolute bottom sheet ABOVE the toolbar — floats over the canvas instead of shrinking it, so the
  // 3D viewport stays full-height (the joystick/HUD no longer get crammed into a half-canvas).
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 84, // clears the bottom toolbar
  maxHeight: "70%",
  backgroundColor: C.bg,
  borderTopLeftRadius: R.sheet,
  borderTopRightRadius: R.sheet,
  borderTopWidth: 1,
  borderTopColor: C.line,
  paddingHorizontal: 16,
  paddingTop: 8,
  paddingBottom: 18,
  shadowColor: "#141414",
  shadowOpacity: 0.13,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: -6 },
  zIndex: 20,
};

const s = StyleSheet.create({
  grab: { width: 42, height: 5, borderRadius: 3, backgroundColor: "#E2E0DB", alignSelf: "center", marginBottom: 10 },

  head: { flexDirection: "row", gap: 10, alignItems: "flex-start", paddingBottom: 8 },
  headIcon: {
    width: 34, height: 34, borderRadius: 10, backgroundColor: C.field,
    alignItems: "center", justifyContent: "center",
  },
  headTitle: { fontFamily: FONT, fontSize: 17, fontWeight: "800", color: C.ink },
  headRole: { fontFamily: FONT, fontSize: 12.5, color: C.ink2, marginTop: 1 },
  badgeLine: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },

  badge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, height: 22, borderRadius: 999 },
  badgeTxt: { fontFamily: FONT, fontSize: 11, fontWeight: "700" },

  ctl: { paddingVertical: 10 },
  ctlLabel: { fontFamily: FONT, fontSize: 12.5, color: C.ink3, marginBottom: 8 },
  num: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pm: {
    width: 46, height: 46, borderRadius: 14, backgroundColor: C.field,
    alignItems: "center", justifyContent: "center",
  },
  pmTxt: { fontFamily: FONT, fontSize: 24, fontWeight: "600", color: C.ink, lineHeight: 26 },
  numVal: { flexDirection: "row", alignItems: "baseline" },
  numNum: { fontFamily: FONT, fontSize: 26, fontWeight: "800", color: C.ink },
  numUnit: { fontFamily: FONT, fontSize: 13, color: C.ink2 },

  seg: { flexDirection: "row", backgroundColor: C.field, borderRadius: 12, padding: 3, gap: 2 },
  segOpt: { flex: 1, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 9 },
  segOptOn: { backgroundColor: C.bg, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  segTxt: { fontFamily: FONT, fontSize: 13, fontWeight: "600", color: C.ink2 },
  segTxtOn: { color: C.ink },

  tgl: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10 },
  tglLabel: { fontFamily: FONT, fontSize: 13.5, color: C.ink, flex: 1, paddingRight: 12 },
  sw: { width: 46, height: 28, borderRadius: 999, backgroundColor: "#D8D6D1", padding: 3, justifyContent: "center" },
  swOn: { backgroundColor: C.selLine },
  knob: { width: 22, height: 22, borderRadius: 999, backgroundColor: C.bg },
  knobOn: { alignSelf: "flex-end" },

  menuRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11 },
  menuIcon: { width: 32, height: 32, borderRadius: 9, backgroundColor: C.field, alignItems: "center", justifyContent: "center" },
  menuTitle: { fontFamily: FONT, fontSize: 14.5, fontWeight: "600", color: C.ink },
  menuSub: { fontFamily: FONT, fontSize: 12, color: C.ink2, marginTop: 1 },

  listRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 9 },
  swatch: { width: 38, height: 38, borderRadius: 9, borderWidth: 1, borderColor: C.line },
  listTitle: { fontFamily: FONT, fontSize: 14.5, fontWeight: "600", color: C.ink },
  listSub: { fontFamily: FONT, fontSize: 12, color: C.ink2, marginTop: 1 },
});
