// src/chrome/Icon.tsx — lightweight glyph icons. OWNER: T2.
//
// The design (construction-v3-preview.html) uses an SVG icon set (#i-select, #i-link …).
// react-native-svg is NOT yet in the app deps, so for S3-T2A we render crisp text glyphs
// — same approach as the E0 placeholders (e.g. «≡»). When react-native-svg lands (a P/E0
// infra add), swap GLYPH lookups for <Svg><Use/></> against the icons-mobile set; the
// <Icon name=… /> call-sites stay unchanged. This keeps the panels dependency-free now.

import { Text, type TextStyle } from "react-native";
import { C } from "../../theme";

export type IconName =
  // chrome / nav
  | "info" | "back" | "chev" | "menu" | "close" | "check" | "layers"
  // badges (v3 §4 vocabulary — exact glyphs from the frame)
  | "link" | "cut" | "double" | "warn" | "rule" | "dot"
  // build verbs
  | "select" | "move" | "resize" | "divide" | "add"
  // material verbs
  | "coat" | "color" | "edge" | "role"
  // hardware verbs
  | "hinge" | "handle" | "slide" | "target"
  // frame verbs
  | "step"
  // misc surfaces
  | "eye" | "lock" | "glass" | "filter" | "drawer" | "grid";

const GLYPH: Record<IconName, string> = {
  info: "ⓘ", back: "‹", chev: "›", menu: "≡", close: "✕", check: "✓", layers: "▤",
  link: "🔗", cut: "✂", double: "⧉", warn: "⚠", rule: "◇", dot: "●",
  select: "◉", move: "✥", resize: "⤢", divide: "⊟", add: "＋",
  coat: "▦", color: "◐", edge: "▭", role: "▥",
  hinge: "⚮", handle: "▬", slide: "⇕", target: "◎",
  step: "⤵",
  eye: "👁", lock: "🔒", glass: "▢", filter: "⚟", drawer: "▤", grid: "▦",
};

export function Icon({
  name,
  size = 18,
  color = C.ink,
  weight = "600",
}: {
  name: IconName;
  size?: number;
  color?: string;
  weight?: TextStyle["fontWeight"];
}) {
  return (
    <Text
      allowFontScaling={false}
      style={{ fontSize: size, lineHeight: size * 1.15, color, fontWeight: weight, textAlign: "center" }}
    >
      {GLYPH[name]}
    </Text>
  );
}
