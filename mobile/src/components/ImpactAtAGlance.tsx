import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { theme } from "../lib/theme";
import { formatCompactAmount, formatCount } from "../lib/needMeta";
import { Skeleton } from "./ui";
import type { PublicStats } from "../lib/api";

const ICON_IMPACT_CREATED = require("../../assets/icons/stats/impact-created.webp");
const ICON_NEEDS_FULFILLED = require("../../assets/icons/stats/needs-fulfilled.webp");
const ICON_CASES_ACTIVE = require("../../assets/icons/stats/cases-active.webp");
const ICON_BLOOD_DONORS = require("../../assets/icons/stats/blood-donors.webp");

interface Stat {
  icon: any;
  value: string;
  label: string;
  tint: string;
  fill: string;
}

export function ImpactAtAGlance({ stats }: { stats: PublicStats | null }) {
  const items: Stat[] = stats
    ? [
        {
          icon: ICON_IMPACT_CREATED,
          value: formatCompactAmount(stats.impact.amountRaised),
          label: "Impact created",
          tint: theme.color.primary,
          fill: theme.color.primarySoft,
        },
        {
          icon: ICON_CASES_ACTIVE,
          value: formatCount(stats.impact.needsFulfilled),
          label: "Needs fulfilled",
          tint: theme.color.success,
          fill: theme.color.successSoft,
        },
        {
          icon: ICON_NEEDS_FULFILLED,
          value: formatCount(stats.impact.verifiedInstitutions),
          label: "Verified NGOs",
          tint: theme.color.warning,
          fill: theme.color.warningSoft,
        },
        {
          icon: ICON_BLOOD_DONORS,
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
          ? [0, 1, 2, 3].map((i) => (
              <View key={i} style={styles.item}>
                <Skeleton width={40} height={40} radius={20} />
                <Skeleton width={46} height={17} style={{ marginTop: theme.spacing.sm }} />
                <Skeleton width={54} height={11} style={{ marginTop: 6 }} />
              </View>
            ))
          : items.map((s) => (
              <View key={s.label} style={styles.item}>
                <View style={styles.iconCircle}>
                  <Image source={s.icon} style={styles.iconImage} contentFit="contain" />
                </View>
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
  iconCircle: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  iconImage: { width: 34, height: 34 },
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
