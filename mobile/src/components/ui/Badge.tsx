import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { theme } from "../../lib/theme";

// PRD Appendix A.4 — "badges (verified, trust tier)" + need-status badges. `tone` is the visual
// language; callers map their own domain value (NeedStatus/Role/TrustTier/...) to a tone rather
// than this component knowing about any of them — keeps it reusable across every badge use case
// already in the app (status, role, trust tier, verified) without a domain-specific prop per use.
export type BadgeTone = "primary" | "accent" | "danger" | "blood" | "success" | "info" | "neutral";

type IconName = keyof typeof Feather.glyphMap;

// Soft tinted fills rather than saturated blocks: a feed row can carry three badges without the
// card turning into a colour chart. `solid` promotes one badge to a filled pill when a single
// item genuinely must dominate (Emergency).
const TONE = {
  primary: { soft: theme.color.primarySoft, solid: theme.color.primary, text: theme.color.primary },
  accent: { soft: theme.color.accentSoft, solid: theme.color.accent, text: "#8A5A00" },
  danger: { soft: theme.color.dangerSoft, solid: theme.color.danger, text: theme.color.danger },
  blood: { soft: theme.color.bloodSoft, solid: theme.color.blood, text: theme.color.blood },
  success: { soft: theme.color.successSoft, solid: theme.color.success, text: theme.color.success },
  info: { soft: theme.color.infoSoft, solid: theme.color.info, text: theme.color.info },
  neutral: { soft: theme.color.surfaceMuted, solid: theme.color.borderStrong, text: theme.color.textSecondary },
} as const;

export function Badge({
  label,
  tone = "neutral",
  icon,
  /** Filled pill with inverted text. Use for the one badge that must outrank the others. */
  solid = false,
  style,
}: {
  label: string;
  tone?: BadgeTone;
  icon?: IconName;
  solid?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const palette = TONE[tone];
  const background = solid ? palette.solid : palette.soft;
  const foreground = solid ? (tone === "accent" || tone === "neutral" ? theme.color.textPrimary : "#FFFFFF") : palette.text;

  return (
    <View style={[styles.badge, { backgroundColor: background }, style]}>
      {/* Embossed relief: a light wash on the lit half over a shadowed lower edge, plus a
          hairline rim. Applied to solid badges only — a tinted soft badge is a label, while a
          solid one is a *state* (Emergency, Verified, Partly funded) and should read as a
          physical tag pressed onto the card. */}
      {solid && (
        <>
          <LinearGradient
            colors={["rgba(255,255,255,0.32)", "rgba(255,255,255,0.04)", "rgba(0,0,0,0.18)"]}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.7, y: 1 }}
            style={[StyleSheet.absoluteFill, styles.emboss]}
            pointerEvents="none"
          />
          <View style={[StyleSheet.absoluteFill, styles.embossRim]} pointerEvents="none" />
        </>
      )}
      {icon && <Feather name={icon} size={11} color={foreground} />}
      <Text style={[styles.text, { color: foreground }, solid && styles.textEmbossed]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.pill,
    // Required so the emboss layers clip to the pill instead of painting a rectangle over it.
    overflow: "hidden",
  },
  emboss: { borderRadius: theme.radii.pill },
  embossRim: {
    borderRadius: theme.radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.45)",
  },
  text: { ...theme.typography.overline, textTransform: "uppercase" },
  // A tight dark shadow under light text is what makes lettering look stamped into the tag
  // rather than printed on it.
  textEmbossed: { textShadowColor: "rgba(0,0,0,0.35)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1 },
});
