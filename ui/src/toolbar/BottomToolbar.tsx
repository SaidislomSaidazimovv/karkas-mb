// src/toolbar/BottomToolbar.tsx — Zone 6 (bottom toolbar, mode verbs). OWNER: T2.
// L7: mode sets the verbs. 5 slots; the 5th is "reserved" (—) in Material/Hardware/Frame.
// design: construction-v3-preview.html §5 (.toolbar per mode).
import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useApp, type Mode } from "../../store/appStore";
import { usePanelUi } from "../sheets/panelUi";
import { C, FONT, R } from "../../theme";
import { Icon, type IconName } from "../chrome/Icon";

type Slot = { key: string; label: string; icon: IconName; reserved?: boolean };

const SLOTS: Record<Mode, Slot[]> = {
  build: [
    { key: "select", label: "Выбор", icon: "select" },
    { key: "move", label: "Двиг.", icon: "move" },
    { key: "resize", label: "Разм.", icon: "resize" },
    { key: "divide", label: "Дел.", icon: "divide" },
    { key: "add", label: "Доб.", icon: "add" },
  ],
  material: [
    { key: "coat", label: "Покр.", icon: "coat" },
    { key: "color", label: "Цвет", icon: "color" },
    { key: "edge", label: "Кром.", icon: "edge" },
    { key: "role", label: "Роль", icon: "role" },
    { key: "r5", label: "—", icon: "add", reserved: true },
  ],
  hardware: [
    { key: "hinge", label: "Петли", icon: "hinge" },
    { key: "handle", label: "Ручки", icon: "handle" },
    { key: "slide", label: "Напр.", icon: "slide" },
    { key: "bearing", label: "Несущ.", icon: "target" },
    { key: "r5", label: "—", icon: "add", reserved: true },
  ],
  frame: [
    { key: "double", label: "Удвн.", icon: "double" },
    { key: "edge", label: "Кром.", icon: "edge" },
    { key: "junction", label: "Стык", icon: "rule" },
    { key: "offset", label: "Смещ.", icon: "step" },
    { key: "r5", label: "—", icon: "add", reserved: true },
  ],
};

export function BottomToolbar() {
  const mode = useApp((s) => s.mode);
  const selection = useApp((s) => s.selection);
  const open = usePanelUi((s) => s.open);
  const close = usePanelUi((s) => s.close);
  const slots = SLOTS[mode];
  const hasSel = selection.kind !== "none";

  // A build verb press either opens its sheet (needs a selection) or just clears a stray overlay.
  const runBuildVerb = (key: string) => {
    if (key === "add") return open("add");
    if (key === "resize" && hasSel) return open("resize");
    if (key === "divide" && selection.sectionId) return open("divide");
    close(); // select / move (canvas-driven) / preconditions unmet → clean slate
  };
  // Active verb is local toolbar state (the selected verb within a mode); the first
  // non-reserved slot is the default. Switching mode resets it via the keyed default below.
  const [activeByMode, setActiveByMode] = useState<Record<Mode, string>>({
    build: "select", material: "coat", hardware: "hinge", frame: "double",
  });
  const active = activeByMode[mode];

  return (
    <View style={styles.bar}>
      {slots.map((slot) => {
        const on = slot.key === active && !slot.reserved;
        return (
          <Pressable
            key={slot.key}
            style={styles.slot}
            disabled={slot.reserved}
            onPress={() => {
              setActiveByMode((m) => ({ ...m, [mode]: slot.key }));
              // Build verbs open their sheet (Разм.→resize, Дел.→divide, Доб.→add); other modes edit
              // in the always-visible SelectionSheet body, so their verbs just clear a stray overlay.
              if (mode === "build") runBuildVerb(slot.key);
              else close();
            }}
          >
            <View style={[styles.ic, on && styles.icOn, slot.reserved && styles.icReserved]}>
              <Icon name={slot.icon} size={20} color={on ? "#FFFFFF" : slot.reserved ? C.disabled : C.ink} />
            </View>
            <Text style={[styles.lbl, on && styles.lblOn, slot.reserved && styles.lblReserved]}>
              {slot.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-start",
    backgroundColor: C.bg,
    borderTopWidth: 1,
    borderTopColor: C.line,
    paddingTop: 10,
    paddingBottom: 16,
  },
  slot: { alignItems: "center", gap: 5, width: 64 },
  ic: {
    width: 50, height: 50, borderRadius: R.card, backgroundColor: C.field,
    alignItems: "center", justifyContent: "center",
  },
  icOn: { backgroundColor: C.black },
  icReserved: { backgroundColor: "transparent", borderWidth: 1, borderColor: C.line, borderStyle: "dashed" },
  lbl: { fontFamily: FONT, fontSize: 11, fontWeight: "700", color: C.ink3 },
  lblOn: { color: C.ink },
  lblReserved: { color: C.disabled },
});
