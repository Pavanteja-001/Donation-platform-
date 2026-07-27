import { Platform } from "react-native";

// PRD Appendix A (D-014) — one design system, all three surfaces. This file is the mobile app's
// copy of the shared tokens (no monorepo/shared-package tooling exists yet, so each app keeps
// its own file — see web-panel/admin's lib/theme.ts for the same values in their own shape).
//
// Visual language: an off-white slate canvas with crisp white cards floating on soft ambient
// shadows. Emerald teal carries every default platform action; red is reserved — exclusively —
// for blood, emergency and danger. Nothing else may use it.

// Slate-harmonised neutral ramp. Every grey in the app comes from here so surfaces, borders and
// text share one temperature instead of drifting warm/cool per screen.
const slate = {
  50: "#F8FAFC",
  100: "#F1F5F9",
  200: "#E8ECF1",
  300: "#CBD5E1",
  400: "#94A3B8",
  500: "#64748B",
  700: "#334155",
  900: "#0F172A",
} as const;

export const theme = {
  color: {
    // --- Platform actions, money needs, primary navigation -------------------
    primary: "#0F766E",
    primaryBright: "#0D9488",
    primaryDeep: "#115E59",
    primarySoft: "#ECFDF5", // tinted fill behind teal icons/callouts
    onPrimary: "#FFFFFF",

    // --- Blood + emergency. Deep crimson, and ONLY for these ----------------
    // `blood` and `danger` are deliberately separate names for the same family: one is a
    // domain colour (a BLOOD need), the other is a state (destructive/error). Keeping them
    // distinct means restyling error states later can't silently repaint blood needs.
    blood: "#991B1B",
    bloodBright: "#DC2626",
    bloodSoft: "#FEF2F2",
    onBlood: "#FFFFFF",

    danger: "#DC2626",
    dangerDeep: "#991B1B",
    dangerSoft: "#FEF2F2",

    // --- Supporting semantics ------------------------------------------------
    accent: "#F2A900",
    accentSoft: "#FFF8E7",
    success: "#059669",
    successSoft: "#ECFDF5",
    warning: "#D97706",
    warningSoft: "#FFFBEB",
    info: "#2563EB",
    infoSoft: "#EFF6FF",

    // --- Canvas & surfaces ---------------------------------------------------
    background: slate[50], // the app canvas — cards must never match this
    backgroundAlt: slate[100], // sectioned/grouped backgrounds
    surface: "#FFFFFF", // floating cards
    surfaceMuted: slate[100], // image placeholders, inert fills, neutral badges
    surfaceSunken: "#E9EEF3", // skeleton base, progress tracks

    // --- Lines ---------------------------------------------------------------
    // `borderSubtle` is the near-invisible hairline that defines a floating white card without
    // boxing it in. `border` is the visible-but-quiet line for inputs, dividers and chips.
    borderSubtle: "rgba(15, 23, 42, 0.05)",
    border: slate[200],
    borderStrong: slate[300],

    // --- Text ----------------------------------------------------------------
    textPrimary: slate[900],
    textSecondary: slate[500],
    textTertiary: slate[400],
    textInverse: "#FFFFFF",
  },

  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 40 },

  // Extended corner geometry. Cards sit at xl/xxl (20–24), controls at md/lg (14–16).
  radii: {
    xs: 8,
    sm: 10,
    md: 14, // inputs, compact buttons
    lg: 16, // buttons, standard controls
    xl: 20, // cards
    xxl: 24, // hero cards, sheets, modals
    xxxl: 28,
    pill: 999,
  },

  // Legacy scalar alias. Kept as a NUMBER because ~24 call sites do arithmetic on it
  // (`theme.radius * 1.5`, `theme.radius / 2`). At 16 those land on the new scale for free:
  // bare = 16 (controls), ×1.5 = 24 (hero cards), ÷2 = 8 (skeleton blocks).
  // Prefer `theme.radii.*` in new code.
  radius: 16,

  font: {
    // Noto Sans (Latin + Devanagari + Telugu) is the eventual target once tri-language UI
    // (D-009) actually has non-Latin strings to render; loading a multi-script font now with
    // zero non-English text anywhere in the app would be pure dead weight. Tracked against the
    // i18n milestone — the scale below is what's real today.
    family: Platform.select({ ios: "System", android: "sans-serif", default: "System" }),
  },

  // A.2 — type scale. Negative tracking on the large sizes is what makes headings read as
  // designed rather than as default system text.
  typography: {
    display: { fontSize: 32, lineHeight: 38, fontWeight: "800" as const, letterSpacing: -0.8 },
    h1: { fontSize: 26, lineHeight: 32, fontWeight: "800" as const, letterSpacing: -0.6 },
    h2: { fontSize: 20, lineHeight: 26, fontWeight: "700" as const, letterSpacing: -0.4 },
    h3: { fontSize: 17, lineHeight: 23, fontWeight: "700" as const, letterSpacing: -0.2 },
    body: { fontSize: 15, lineHeight: 22, fontWeight: "400" as const },
    bodyMedium: { fontSize: 15, lineHeight: 22, fontWeight: "600" as const },
    bodySmall: { fontSize: 13, lineHeight: 19, fontWeight: "400" as const },
    caption: { fontSize: 12, lineHeight: 16, fontWeight: "500" as const },
    // Uppercase micro-label used on pills, section eyebrows and type tags.
    overline: { fontSize: 11, lineHeight: 14, fontWeight: "700" as const, letterSpacing: 0.6 },
    // Tabular-ish figures for amounts/counters, so progress numbers don't jitter as they animate.
    numeric: { fontSize: 22, lineHeight: 28, fontWeight: "800" as const, letterSpacing: -0.5 },
  },

  // A.3 — soft ambient elevation. RN needs both the iOS shadow props and Android's `elevation`,
  // bundled here so call sites never hand-roll either. Shadows stay low-opacity and wide-radius:
  // the goal is a card lifting off the canvas, not a hard drop shadow.
  elevation: {
    none: {},
    level1: {
      shadowColor: "#0F172A",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 8,
      elevation: 2,
    },
    level2: {
      shadowColor: "#0F172A",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
      elevation: 3,
    },
    level3: {
      shadowColor: "#0F172A",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.1,
      shadowRadius: 24,
      elevation: 8,
    },
  },

  // Coloured glow for the one primary CTA on a screen, and for emergency surfaces. Used
  // sparingly — if everything glows, nothing reads as important.
  glow: {
    primary: {
      shadowColor: "#0F766E",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.28,
      shadowRadius: 16,
      elevation: 8,
    },
    blood: {
      shadowColor: "#991B1B",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3,
      shadowRadius: 16,
      elevation: 8,
    },
  },

  // A.6 — motion. Durations for fades/colour, springs for anything the finger touches.
  // Springs are non-oscillating by design: UI that wobbles reads as toy-like, not premium.
  motion: {
    fast: 150,
    normal: 220,
    slow: 400,
    shimmer: 1100,
    spring: {
      /** Press feedback on buttons, cards, chips. Snappy, zero overshoot. */
      press: { damping: 18, stiffness: 340, mass: 0.6 },
      /** Entrances and layout settle. */
      gentle: { damping: 20, stiffness: 180, mass: 0.9 },
      /** Deliberate overshoot — reserve for success/celebration moments. */
      bouncy: { damping: 11, stiffness: 220, mass: 0.8 },
    },
  },

  /** Standard press-scale target, so every tappable surface shrinks by the same amount. */
  pressScale: 0.97,
} as const;

export type Theme = typeof theme;
