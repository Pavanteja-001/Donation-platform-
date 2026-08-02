import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { theme } from "../lib/theme";
import { formatCompactAmount, formatCount } from "../lib/needMeta";
import { Skeleton } from "./ui";
import type { PublicStats } from "../lib/api";

/**
 * The home screen's headline figures.
 *
 * Every number arrives from `/api/stats`, aggregated server-side. Nothing here is derived on the
 * client, rounded up, or padded with a "+" — on a platform asking strangers for money, the first
 * donor who reconciles a headline against what they can actually count in the feed decides
 * whether to believe anything else on the page.
 */

interface Stat {
  icon: keyof typeof Feather.glyphMap;
  value: string;
  label: string;
  tint: string;
  fill: string;
}

export function ImpactAtAGlance({ stats }: { stats: PublicStats | null }) {
  const items: Stat[] = stats
    ? [
        {
          icon: "heart",
          value: formatCompactAmount(stats.impact.amountRaised),
          label: "Impact created",
          tint: theme.color.primary,
          fill: theme.color.primarySoft,
        },
        {
          icon: "check-circle",
          // Labelled for what the backend actually counts. The original design said "Lives
          // Helped", but one fulfilled need can serve twenty children and another serves one —
          // there is no beneficiary count behind that claim, so it isn't made.
          value: formatCount(stats.impact.needsFulfilled),
          label: "Needs fulfilled",
          tint: theme.color.success,
          fill: theme.color.successSoft,
        },
        {
          icon: "shield",
          value: formatCount(stats.impact.verifiedInstitutions),
          label: "Verified NGOs",
          tint: theme.color.warning,
          fill: theme.color.warningSoft,
        },
        {
          icon: "droplet",
          value: formatCount(stats.impact.bloodDonors),
          label: "Blood donors",
          tint: theme.color.blood,
          fill: theme.color.bloodSoft,
        },
      ]
    : [];

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>IMPACT AT A GLANCE</Text>

      <View style={[styles.card, theme.elevation.level1]}>
        {stats === null
          ? // Four skeletons in the real geometry — the row must not resize when numbers land,
            // or the whole page below it jumps.
            [0, 1, 2, 3].map((i) => (
              <View key={i} style={styles.item}>
                <Skeleton width={40} height={40} radius={20} />
                <Skeleton width={46} height={17} style={{ marginTop: theme.spacing.sm }} />
                <Skeleton width={54} height={11} style={{ marginTop: 6 }} />
              </View>
            ))
          : items.map((s) => (
              <View key={s.label} style={styles.item}>
                <View style={[styles.iconCircle, { backgroundColor: s.fill }]}>
                  <Feather name={s.icon} size={19} color={s.tint} />
                </View>
                {/* One line, shrunk if needed. ₹40.1Cr and 12,684 differ enough in width that a
                    fixed size would either clip the long one or waste space on the short one. */}
                <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                  {s.value}
                </Text>
                <Text style={styles.label} numberOfLines={2}>
                  {s.label}
                </Text>
              </View>
            ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.lg },
  sectionTitle: {
    ...theme.typography.caption,
    fontWeight: "800",
    letterSpacing: 0.6,
    color: theme.color.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  card: {
    flexDirection: "row",
    backgroundColor: theme.color.surface,
    borderRadius: theme.radii.xl,
    borderWidth: 1,
    borderColor: theme.color.borderSubtle,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.sm,
  },
  // Equal quarters rather than content-sized: four columns of differing widths read as a mistake,
  // and the widths would shift every time a number crossed a digit boundary.
  item: { flex: 1, alignItems: "center", paddingHorizontal: 2 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  value: {
    ...theme.typography.h3,
    color: theme.color.textPrimary,
    marginTop: theme.spacing.sm,
    textAlign: "center",
  },
  label: {
    ...theme.typography.caption,
    fontSize: 10,
    lineHeight: 13,
    color: theme.color.textSecondary,
    textAlign: "center",
    marginTop: 2,
  },
});
