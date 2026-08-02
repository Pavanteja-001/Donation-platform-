import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { theme } from "../lib/theme";
import { formatCount } from "../lib/needMeta";
import { Skeleton } from "./ui";
import type { PublicStats } from "../lib/api";

const ICON_CASES_TOTAL = require("../../assets/icons/stats/cases-total.webp");
const ICON_CASES_ACTIVE = require("../../assets/icons/stats/cases-active.webp");
const ICON_CASES_PENDING = require("../../assets/icons/stats/cases-pending.webp");
const ICON_VERIFIED_NGOS = require("../../assets/icons/stats/verified-ngos.webp");
const ICON_CASES_COMPLETED = require("../../assets/icons/stats/cases-completed.webp");

interface CaseTile {
  icon: any;
  value: number;
  label: string;
  hint?: string;
  tint: string;
  fill: string;
}

export function PresentCases({ stats }: { stats: PublicStats | null }) {
  const tiles: CaseTile[] = stats
    ? [
        {
          icon: ICON_CASES_TOTAL,
          value: stats.cases.total,
          label: "Total",
          tint: theme.color.primary,
          fill: theme.color.primarySoft,
        },
        {
          icon: ICON_CASES_PENDING,
          value: stats.cases.active,
          label: "Active",
          tint: "#2563EB",
          fill: "#E7EFFD",
        },
        {
          icon: ICON_VERIFIED_NGOS,
          value: stats.cases.pending,
          label: "Pending",
          tint: theme.color.warning,
          fill: theme.color.warningSoft,
        },
        {
          icon: ICON_CASES_COMPLETED,
          value: stats.cases.completedThisMonth,
          label: "This month",
          tint: theme.color.success,
          fill: theme.color.successSoft,
        },
      ]
    : [];

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>PRESENT CASES SUMMARY</Text>

      <View style={styles.row}>
        {stats === null
          ? [0, 1, 2, 3].map((i) => (
              <View key={i} style={[styles.tile, styles.tileSkeleton]}>
                <Skeleton width={28} height={28} radius={9} />
                <Skeleton width={34} height={19} style={{ marginTop: 6 }} />
                <Skeleton width={44} height={11} style={{ marginTop: 4 }} />
              </View>
            ))
          : tiles.map((t) => (
              <View key={t.label} style={styles.tile}>
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    { backgroundColor: t.fill, opacity: 0.45, borderRadius: theme.radii.lg },
                  ]}
                />
                <View style={styles.topRow}>
                  <View style={styles.tileIcon}>
                    <Image source={t.icon} style={styles.iconImage} contentFit="contain" />
                  </View>
                  <Text
                    style={[styles.tileValue, { color: t.tint }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {formatCount(t.value)}
                  </Text>
                </View>
                <Text style={styles.tileLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                  {t.label}
                </Text>
              </View>
            ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.xl },
  sectionTitle: {
    ...theme.typography.caption,
    fontWeight: "800",
    letterSpacing: 0.6,
    color: theme.color.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  row: { flexDirection: "row", gap: 6 },
  tile: {
    flex: 1,
    borderRadius: theme.radii.lg,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  tileSkeleton: { backgroundColor: theme.color.surfaceMuted, alignItems: "center" },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  tileIcon: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  iconImage: { width: 20, height: 20 },
  tileValue: { ...theme.typography.h3, fontSize: 16, lineHeight: 20, textAlign: "center" },
  tileLabel: {
    ...theme.typography.caption,
    fontSize: 11,
    color: theme.color.textSecondary,
    textAlign: "center",
  },
});
