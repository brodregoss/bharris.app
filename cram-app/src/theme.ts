export const theme = {
  colors: {
    background: "#0f1419",
    surface: "#1a2332",
    surfaceElevated: "#243044",
    border: "#2d3a4f",
    text: "#f0f4f8",
    textMuted: "#94a3b8",
    textDim: "#64748b",
    primary: "#3b82f6",
    primaryMuted: "#1d4ed8",
    success: "#22c55e",
    successBg: "#14532d",
    danger: "#ef4444",
    dangerBg: "#450a0a",
    warning: "#f59e0b",
    cardFront: "#1e293b",
    cardBack: "#172554",
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  radii: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    card: 20,
  },
  typography: {
    title: { fontSize: 22, fontWeight: "700" as const },
    heading: { fontSize: 18, fontWeight: "600" as const },
    body: { fontSize: 16, fontWeight: "400" as const },
    caption: { fontSize: 13, fontWeight: "400" as const },
    label: { fontSize: 11, fontWeight: "600" as const, letterSpacing: 1 },
  },
};

export type Theme = typeof theme;
