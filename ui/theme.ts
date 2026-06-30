// ui/theme.ts — shared design tokens. Owner: P. T1/T2 import from here (single source).
// Values are PIXEL-SAMPLED from the Part-1 netlify app (see design/construction-v3-preview.html §1).

export const C = {
  bg: "#FFFFFF", // фон страницы
  chrome: "#FAFAFA", // светлый фон
  ink: "#1C1C1D", // основной текст
  ink2: "#888888", // второстепенный текст (NEUTRAL, not warm)
  ink3: "#575757", // тёмная метка
  line: "#DEDCD8", // граница карточки
  field: "#F6F5F2", // фон поля
  black: "#000000", // кнопка-pill / иконка
  disabled: "#BDBCBC",
  sel: "#7E9BE6", // выделение (заливка) — KO'K
  selLine: "#2A6CEE", // выделение (линия)
  selPink: "#DF5B66", // выделение материала
  wall: "#9B9B9B", // 3D-стена
  warn: "#D9822B", // ⚠
  ok: "#1F8A4C",
} as const;

export const FONT = "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif";

export const R = { pill: 999, card: 15, sheet: 22, img: 10 } as const;
