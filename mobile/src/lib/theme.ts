import { Platform } from "react-native";

// PRD Appendix A (D-014) — one design system, all three surfaces. This file is the mobile app's
// copy of the shared tokens (no monorepo/shared-package tooling exists yet, so each app keeps
// its own file — see web-panel/admin's lib/theme.ts for the same values in their own shape).
//
// Visual language: a warm blush off-white canvas with crisp white cards floating on soft ambient
// shadows, and deep crimson carrying every primary action.
//
// This supersedes the original emerald-teal palette (D-025). Under D-014 red was reserved for
// blood/emergency/danger; now that red IS the brand, urgency is signalled by intensity and
// treatment instead — hotter red (`emergency`), solid fills, and the radiating pulse — rather
// than by hue alone. Do not add a second accent hue to compensate.

// Warm neutral ramp. Every grey in the app comes from here so surfaces, borders and text share
// one temperature. Deliberately warm (a trace of red in each step) rather than the blue-grey
// slate this used to be — against a crimson brand, cool greys read as cheap and clinical.
const warm = {
  50: "#FBF7F7",
  100: "#F6EFEF",
  200: "#EDE2E2",
  300: "#D8C7C8",
  400: "#A6959A",
  500: "#75656B",
  700: "#3D3033",
  900: "#1C1416",
} as const;

export const theme = {
  color: {
    // --- Brand. Deep crimson carries every primary action ---------------------
    // This supersedes the emerald-teal primary (see D-025). Because red is now the brand, it can
    // no longer signal urgency on its own — emergency is distinguished by *intensity and
    // treatment* instead: hotter red, solid fills, and the radiating pulse.
    primary: "#B91C1C",
    primaryBright: "#DC2626",
    primaryDeep: "#7F1D1D",
    primarySoft: "#FDECEC", // tinted fill behind crimson icons/callouts
    onPrimary: "#FFFFFF",

    // --- Blood domain. Same family as the brand, one step deeper -------------
    // Kept as its own token rather than aliased to `primary`: a BLOOD need is a domain concept,
    // and keeping the name means the two can diverge again without hunting call sites.
    blood: "#991B1B",
    bloodBright: "#DC2626",
    bloodSoft: "#FDECEC",
    onBlood: "#FFFFFF",

    // --- Emergency + danger. Hotter and brighter than the brand ---------------
    emergency: "#EF4444",
    danger: "#E02424",
    dangerDeep: "#7F1D1D",
    dangerSoft: "#FDECEC",

    // --- Supporting semantics ------------------------------------------------
    accent: "#E8A317",
    accentSoft: "#FDF4E3",
    // Success stays green — it's the only way "confirmed" can read as distinct now that the
    // brand is red. Used sparingly: confirmed contributions, verified badges, completed needs.
    success: "#0E9F6E",
    successSoft: "#E8F8F1",
    warning: "#D97706",
    warningSoft: "#FDF6E7",
    info: "#2563EB",
    infoSoft: "#EEF3FE",

    // --- Canvas & surfaces ---------------------------------------------------
    // Warm, faintly blush off-white rather than a cold near-white. This is what stops the app
    // reading as "very white" — cards still separate cleanly, but the canvas has a temperature.
    background: warm[50],
    backgroundAlt: warm[100],
    surface: "#FFFFFF",
    surfaceMuted: warm[100],
    surfaceSunken: "#EFE3E4", // skeleton base, progress tracks

    // --- Lines ---------------------------------------------------------------
    // `borderSubtle` is the near-invisible hairline that defines a floating white card without
    // boxing it in. `border` is the visible-but-quiet line for inputs, dividers and chips.
    borderSubtle: "rgba(124, 45, 45, 0.07)",
    border: warm[200],
    borderStrong: warm[300],

    // --- Text ----------------------------------------------------------------
    textPrimary: warm[900],
    textSecondary: warm[500],
    textTertiary: warm[400],
    textInverse: "#FFFFFF",
  },

  // Gradient stops for hero surfaces — the dark crimson→near-black wash from the reference
  // designs. Consumed by <Gradient>, which renders them without a native dependency.
  gradient: {
    /** Splash / login hero / emergency panel. */
    brand: ["#7F1D1D", "#B91C1C", "#3B0A0A"] as string[],
    /** Deep, near-black variant for full-bleed panels behind white text. */
    brandDeep: ["#4C0D0D", "#8C1616", "#240505"] as string[],
    /** Scrim laid over hero photography so overlaid text stays legible. */
    scrim: ["rgba(28,20,22,0)", "rgba(28,20,22,0.55)"] as string[],

    // --- Depth washes --------------------------------------------------------
    // Everything below assumes one consistent light source: **top-left**. A surface is lighter
    // where the light hits it and darker where it falls away; that single rule is what reads as
    // dimensional rather than "a flat rectangle with a shadow under it".
    /** Laid over a white card, top-left → bottom-right. Barely visible on its own. */
    surfaceSheen: ["rgba(255,255,255,0.9)", "rgba(255,255,255,0)", "rgba(124,45,45,0.035)"] as string[],
    /** Fill for a raised crimson icon plate. */
    plateBrand: ["#D4383A", "#B91C1C", "#8A1414"] as string[],
    /** Neutral plate for secondary/inactive icons. */
    plateNeutral: ["#FFFFFF", "#F7ECEC", "#EADCDC"] as string[],
    /** Highlight arc across the top of a plate or pill — the "lit" edge. */
    gloss: ["rgba(255,255,255,0.55)", "rgba(255,255,255,0.06)"] as string[],

    // --- Premium pass -------------------------------------------------------
    // Deep red falling into charcoal rather than red→black. Charcoal keeps the hero from
    // reading as a flat crimson block and gives glass cards something to sit against.
    heroDeep: ["#8C1616", "#5A1015", "#241F22"] as string[],
    /** Same wash rotated for wide surfaces (detail headers, profile header). */
    heroWide: ["#7F1D1D", "#4A1218", "#2A2427"] as string[],
    /** Metallic gold for tier emblems and achievement accents. Lit top-left like everything. */
    gold: ["#F5D98B", "#D9A441", "#9C6B1E"] as string[],
    /** Brushed silver, for the lower trust tiers. */
    silver: ["#F2F3F5", "#C9CDD4", "#8B9099"] as string[],
    /** Fill behind a glass card so blurred content underneath doesn't wash out the text. */
    glass: ["rgba(255,255,255,0.22)", "rgba(255,255,255,0.08)"] as string[],
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
  // Opacities were raised from 0.04/0.06/0.10 — at those values the shadow was below the
  // perceptual threshold on most phone screens in daylight, which is the main reason the UI read
  // as flat. They are still warm and wide (never a hard drop shadow), just actually visible.
  elevation: {
    none: {},
    level1: {
      shadowColor: "#3B0A0A",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
    },
    level2: {
      shadowColor: "#3B0A0A",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.12,
      shadowRadius: 14,
      elevation: 5,
    },
    level3: {
      shadowColor: "#3B0A0A",
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.18,
      shadowRadius: 26,
      elevation: 12,
    },
    /** Floating above everything: tab bar, bottom sheets, the one hero CTA. */
    level4: {
      shadowColor: "#2A0606",
      shadowOffset: { width: 0, height: 18 },
      shadowOpacity: 0.24,
      shadowRadius: 34,
      elevation: 18,
    },
  },

  // Coloured glow for the one primary CTA on a screen, and for emergency surfaces. Used
  // sparingly — if everything glows, nothing reads as important.
  glow: {
    primary: {
      shadowColor: "#B91C1C",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.34,
      shadowRadius: 18,
      elevation: 8,
    },
    blood: {
      shadowColor: "#991B1B",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.36,
      shadowRadius: 18,
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
