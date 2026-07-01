// src/toolbar/BottomToolbar.tsx — Zone 6 (bottom toolbar, mode verbs). OWNER: T2.
// L7: mode sets the verbs. 5 slots; the 5th is "reserved" (—) in Material/Hardware/Frame.
// design: construction-v3-preview.html §5 (.toolbar per mode).
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useApp, loadBearingTargets, anyLoadBearing, type Mode } from "../../store/appStore";
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
  const modeTab = useApp((s) => s.modeTab);
  const setModeTab = useApp((s) => s.setModeTab);
  const selection = useApp((s) => s.selection);
  const model = useApp((s) => s.model);
  const declareLoadBearing = useApp((s) => s.declareLoadBearing);
  const open = usePanelUi((s) => s.open);
  const close = usePanelUi((s) => s.close);
  const flashHint = usePanelUi((s) => s.flashHint);
  const slots = SLOTS[mode];
  const hasSel = selection.kind !== "none";

  // L5 «Несущ.» (Hardware): declare the selected part — or every shelf in the selected section —
  // load-bearing → stability ⚠ if over-span. Works from a reachable section tap, not only a shelf.
  const runBearing = () => {
    const targets = loadBearingTargets(model, selection);
    if (targets.length === 0) return flashHint("Коснитесь детали или секции, потом «Несущ.»");
    const cur = anyLoadBearing(model, targets);
    targets.forEach((id) => declareLoadBearing(id, !cur));
    flashHint(!cur ? "Помечено несущим — ⚠ при перегрузке" : "Отметка «несущая» снята");
  };

  // A build verb press opens its sheet (most need a selection) — and if the precondition isn't met
  // it flashes a hint instead of silently doing nothing (that "dead button" feel the founder hit).
  const runBuildVerb = (key: string) => {
    if (key === "add") return open("add");
    if (key === "resize") return hasSel ? open("resize") : flashHint("Коснитесь детали, потом «Разм.»");
    if (key === "divide") return hasSel ? open("divide") : flashHint("Коснитесь детали, потом «Дел.»");
    if (key === "move") return hasSel ? close() : flashHint("Двиг.: перетаскивайте деталь на модели");
    close(); // «Выбор» → clean slate (tap parts on the model to select)
  };
  // The active sub-verb per mode is SHARED (store) so the SelectionSheet body can render the section
  // this verb selects (L7: "mode sets verbs, the verb switches the card-body sub-section").
  const active = modeTab[mode];

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
              setModeTab(mode, slot.key);
              // Build verbs open their sheet (Разм.→resize, Дел.→divide, Доб.→add). In the other
              // modes the verb selects the card-body sub-section (Material/Hardware/Frame); «Несущ.»
              // also toggles load-bearing. Dismiss any takeover so the card (this section) shows.
              if (mode === "build") runBuildVerb(slot.key);
              else if (mode === "hardware" && slot.key === "bearing") { close(); runBearing(); }
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
