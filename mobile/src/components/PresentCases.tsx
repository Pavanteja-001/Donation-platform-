import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { theme } from "../lib/theme";
import { formatCount } from "../lib/needMeta";
import { Skeleton } from "./ui";
import type { PublicStats } from "../lib/api";

/**
 * Where every request on the platform currently stands.
 *
 * Deliberately shows `pending` — requests still waiting on admin verification — rather than only
 * the flattering numbers. A donor who can see that 63 people are queued for review understands
 * that verification is real work being done, not a rubber stamp; hiding the queue would make the
 * platform look either instant or empty, and neither is true.
 *
 * Four fixed tiles across, no scrolling — a summary that hides part of itself isn't a summary,
 * and a row that moves under your thumb while you're reading four numbers is worse than a tight
 * fit. What makes ~78dp per tile work is dropping the qualifier line entirely and shortening the
 * labels: the count and one word are the whole message, and "Completed / This month" was two
 * lines saying what "This month" says in one.
 */

interface CaseTile {
  icon: keyof typeof Feather.glyphMap;
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
          icon: "folder",
          value: stats.cases.total,
          label: "Total",
          tint: theme.color.primary,
          fill: theme.color.primarySoft,
        },
        {
          icon: "refresh-cw",
          value: stats.cases.active,
          label: "Active",
          tint: "#2563EB",
          fill: "#E7EFFD",
        },
        {
          icon: "clock",
          value: stats.cases.pending,
          label: "Pending",
          tint: theme.color.warning,
          fill: theme.color.warningSoft,
        },
        {
          // "This month" rather than "Completed": the number already means completions, and one
          // word of qualifier beats two lines saying the same thing at this width.
          icon: "check-circle",
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
              <View key={t.label} style={[styles.tile, { backgroundColor: t.fill }]}>
                <View style={styles.tileIcon}>
                  <Feather name={t.icon} size={15} color={t.tint} />
                </View>
                {/* Shrinks rather than wraps: "1,043" is nearly twice the width of "7", and a
                    tile that reflows when a count crosses a digit boundary makes the whole row
                    jump. */}
                <Text
                  style={[styles.tileValue, { color: t.tint }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  {formatCount(t.value)}
                </Text>
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
  // flex:1 rather than a fixed width — four equal shares of whatever the screen gives us, so the
  // row fits a 320dp phone and a 430dp one without a breakpoint.
  tile: {
    flex: 1,
    borderRadius: theme.radii.lg,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: 6,
    alignItems: "center",
  },
  tileSkeleton: { backgroundColor: theme.color.surfaceMuted, alignItems: "center" },
  tileIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: "rgba(255,255,255,0.72)",
    alignItems: "center",
    justifyContent: "center",
  },
  tileValue: { ...theme.typography.h3, marginTop: 6, textAlign: "center" },
  tileLabel: {
    ...theme.typography.caption,
    fontSize: 11,
    color: theme.color.textSecondary,
    textAlign: "center",
  },
});
