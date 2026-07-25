import { Platform } from "react-native";

// PRD Appendix A (D-014) — one design system, all three surfaces. This file is the mobile app's
// copy of the shared tokens (no monorepo/shared-package tooling exists yet, so each app keeps
// its own file — see web-panel/admin's lib/theme.ts for the same values in their own shape).
// Red is reserved for danger/emergency/blood urgency only.
export const theme = {
  color: {
    primary: "#0E7C66",
    onPrimary: "#FFFFFF",
    accent: "#F2A900",
    success: "#2E9E5B",
    warning: "#C98A00",
    danger: "#D7263D",
    info: "#2B6CB0",
    background: "#F7F8F8",
    surface: "#FFFFFF",
    border: "#E2E5E4",
    textPrimary: "#14201D",
    textSecondary: "#5B6B67",
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  radius: 12,
  // A.2 — font family + scale. Noto Sans (Latin + Devanagari + Telugu) is the eventual target
  // once tri-language UI (D-009) actually has non-Latin strings to render; loading a multi-
  // script font now with zero non-English text anywhere in the app would be pure dead weight.
  // Tracked against the i18n milestone, not forgotten — the scale below (sizes/weights/line
  // heights) is what's real today and what every screen should already be built against.
  font: {
    family: Platform.select({ ios: "System", android: "sans-serif", default: "System" }),
  },
  typography: {
    display: { fontSize: 32, lineHeight: 40, fontWeight: "700" as const },
    h1: { fontSize: 24, lineHeight: 32, fontWeight: "700" as const },
    h2: { fontSize: 18, lineHeight: 26, fontWeight: "700" as const },
    body: { fontSize: 15, lineHeight: 22, fontWeight: "400" as const },
    bodyMedium: { fontSize: 15, lineHeight: 22, fontWeight: "600" as const },
    caption: { fontSize: 12, lineHeight: 16, fontWeight: "400" as const },
  },
  // A.3 — a small, consistent elevation set for cards/modals. RN needs both the iOS shadow
  // props and Android's `elevation`; bundled here so call sites never hand-roll either.
  elevation: {
    none: {},
    level1: {
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 3,
      elevation: 1,
    },
    level2: {
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 10,
      elevation: 4,
    },
  },
  // A.6 — motion timing, so every animated transition uses the same feel.
  motion: { fast: 150, normal: 220 },
};
