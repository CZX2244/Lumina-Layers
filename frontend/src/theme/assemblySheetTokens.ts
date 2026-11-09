/**
 * Colours for the printed assembly reference sheet (canvas, theme-independent).
 * Values follow 露点 Dewpoint 3 paper/ink so the sheet reads the same in
 * light and dark mode. 装配参考图（canvas）用色，与界面主题无关。
 */
export const ASSEMBLY_SHEET_COLORS = {
  paper: "#FAF9F5",
  ink: "#141413",
  muted: "#6B6B5B",
  rule: "#B3AE9C",
  leaf: "#B6C83F",
  labelFill: "rgba(250, 249, 245, 0.92)",
  missingShade: "rgba(20, 20, 19, 0.35)",
} as const;
