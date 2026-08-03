import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { theme } from "../lib/theme";
import { helplineIcon } from "../lib/helplineIcons";
import { eventSubtitle, formatBloodGroup, formatRupees } from "../lib/community";
import type { Helpline, PlatformEventCard, SuccessStoryCard, TopSupporter } from "../lib/api";
import { Avatar, PressableScale } from "./ui";

/**
 * The building blocks of the community panel.
 *
 * Every one of these renders in two places — inside the menu drawer, and again on its own
 * "View all" screen. They live here rather than inside the drawer so the two can never drift:
 * a helpline row that shows a category in the drawer but not on the helplines screen is the kind
 * of inconsistency nobody files a bug for and everybody notices.
 */

// =================================================================================================
// Section chrome
// =================================================================================================

/** A titled white card. `onViewAll` adds the red "View all" affordance on the right. */
export function SectionCard({
  title,
  onViewAll,
  viewAllLabel = "View all",
  children,
  style,
  tone = "brand",
}: {
  title: string;
  onViewAll?: () => void;
  viewAllLabel?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** "brand" titles are crimson (the default); "neutral" for blocks that aren't calls to action. */
  tone?: "brand" | "neutral";
}) {
  return (
    <View style={[styles.card, theme.elevation.level1, style]}>
      <View style={styles.cardHead}>
        <Text style={[styles.cardTitle, tone === "neutral" && { color: theme.color.textPrimary }]}>{title}</Text>
        {onViewAll ? (
          <PressableScale onPress={onViewAll} scaleTo={0.94} hitSlop={8}>
            <Text style={styles.viewAll}>{viewAllLabel}</Text>
          </PressableScale>
        ) : null}
      </View>
      {children}
    </View>
  );
}

// =================================================================================================
// Safety & emergency support
// =================================================================================================

export function HelplineRow({ helpline, onPress }: { helpline: Helpline; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} scaleTo={0.98} style={styles.row} accessibilityLabel={`Call ${helpline.name}`}>
      <View style={styles.helplineIcon}>
        {helpline.iconUrl ? (
          <Image source={{ uri: helpline.iconUrl }} style={styles.helplineImage} contentFit="contain" transition={150} />
        ) : (
          <Feather name={helplineIcon(helpline.iconKey)} size={18} color={theme.color.primary} />
        )}
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel} numberOfLines={1}>
          {helpline.name}
        </Text>
        {/* The number is the point of the row, so it is never truncated or hidden behind a tap. */}
        <Text style={styles.helplineNumber}>{helpline.number}</Text>
      </View>
      <Feather name="phone" size={16} color={theme.color.primary} />
    </PressableScale>
  );
}

// =================================================================================================
// Trust & transparency
// =================================================================================================

/**
 * Four fixed statements about how the platform works.
 *
 * Deliberately NOT admin-editable and not in the database (see routes/community.ts): "0% platform
 * fee" and "every update is visible" are promises the product is built on, not copy to be tuned.
 * If one of them stops being true, that is a code change and a decision record — not a form field.
 */
const TRUST_POINTS: { icon: React.ComponentProps<typeof Feather>["name"]; title: string; body: string }[] = [
  { icon: "shield", title: "100% Transparent", body: "Every update is visible" },
  { icon: "percent", title: "0% Platform Fee", body: "We are a mediator only" },
  { icon: "lock", title: "Verified & Secure", body: "Data privacy protected" },
  { icon: "share-2", title: "Direct Impact", body: "Help goes directly" },
];

export function TrustPoints() {
  return (
    <View style={styles.trustList}>
      {TRUST_POINTS.map((point) => (
        <View key={point.title} style={styles.trustRow}>
          <Feather name={point.icon} size={17} color={theme.color.success} style={styles.trustIcon} />
          <View style={styles.rowText}>
            <Text style={styles.trustTitle}>{point.title}</Text>
            <Text style={styles.trustBody}>{point.body}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// =================================================================================================
// Success stories
// =================================================================================================

export function StoryCard({
  story,
  onPress,
  width,
}: {
  story: SuccessStoryCard;
  onPress: () => void;
  /** Set by the carousel so each page is exactly one panel wide; omitted in a vertical list. */
  width?: number;
}) {
  return (
    <PressableScale onPress={onPress} scaleTo={0.985} style={[styles.storyCard, width ? { width } : null]}>
      {story.coverImageUrl ? (
        <Image
          source={{ uri: story.coverImageUrl }}
          style={styles.storyImage}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={200}
        />
      ) : (
        <View style={[styles.storyImage, styles.storyImageFallback]}>
          <Feather name="image" size={20} color={theme.color.primary} />
        </View>
      )}

      <View style={styles.storyBody}>
        <Text style={styles.storySummary} numberOfLines={4}>
          {story.summary}
        </Text>
        <View style={styles.readMoreRow}>
          <Text style={styles.readMore}>Read more</Text>
          <Feather name="arrow-right" size={13} color={theme.color.primary} />
        </View>
      </View>
    </PressableScale>
  );
}

/** Carousel position dots — one per story, the active one widened into a pill. */
export function Dots({ count, active }: { count: number; active: number }) {
  if (count <= 1) return null;
  return (
    <View style={styles.dots}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[styles.dot, i === active && styles.dotActive]} />
      ))}
    </View>
  );
}

// =================================================================================================
// Top supporters
// =================================================================================================

/** Podium colours for the first three rows; everyone below gets the neutral ring. */
const RANK_COLORS = ["#E0A32E", "#94A3B8", "#B26B3E"];

export function SupporterRow({ supporter }: { supporter: TopSupporter }) {
  const bloodGroup = formatBloodGroup(supporter.bloodGroup);
  const rankColor = RANK_COLORS[supporter.rank - 1] ?? theme.color.border;

  return (
    <View style={styles.row}>
      <View>
        <Avatar name={supporter.name} photoUrl={supporter.profilePhotoUrl} size={36} />
        <View style={[styles.rankBadge, { backgroundColor: rankColor }]}>
          <Text style={styles.rankText}>{supporter.rank}</Text>
        </View>
      </View>

      <View style={styles.rowText}>
        <Text style={styles.rowLabel} numberOfLines={1}>
          {supporter.name}
        </Text>
        {/* Blood group is the only extra detail shown, and only for donors who are publicly
            available to donate — nothing else about a supporter is revealed here. */}
        <View style={styles.supporterMeta}>
          {supporter.isInstitution ? <Text style={styles.supporterTag}>Organisation</Text> : null}
          {bloodGroup ? (
            <View style={styles.bloodChip}>
              <Feather name="droplet" size={9} color={theme.color.blood} />
              <Text style={styles.bloodChipText}>{bloodGroup}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <Text style={styles.amount}>{formatRupees(supporter.totalAmount)}</Text>
    </View>
  );
}

// =================================================================================================
// Upcoming events
// =================================================================================================

export function EventRow({ event, onPress }: { event: PlatformEventCard; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} scaleTo={0.98} style={styles.row}>
      <View style={styles.eventIcon}>
        {event.iconUrl || event.bannerUrl ? (
          <Image
            source={{ uri: event.iconUrl ?? event.bannerUrl ?? "" }}
            style={styles.eventImage}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={150}
          />
        ) : (
          <Feather name={event.mode === "ONLINE" ? "video" : "calendar"} size={17} color={theme.color.primary} />
        )}
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel} numberOfLines={2}>
          {event.title}
        </Text>
        <Text style={styles.eventMeta} numberOfLines={1}>
          {eventSubtitle(event)}
        </Text>
      </View>
      <Feather name="chevron-right" size={16} color={theme.color.textTertiary} />
    </PressableScale>
  );
}

// =================================================================================================
// Make an impact today
// =================================================================================================

const IMPACT_HEART = require("../../assets/impact-heart.webp");

/**
 * The closing call to action.
 *
 * Built from real components rather than shipped as one flat image: the artwork in the design
 * includes the button, and a picture of a button is not tappable, does not resize with the
 * panel, and cannot show a pressed state. Only the heart is an image — everything else is text
 * and a real control, so it reflows on a 320dp phone and stays legible at large font sizes.
 */
export function ImpactCta({ onPress }: { onPress: () => void }) {
  return (
    <View style={styles.impactCard}>
      <View style={styles.impactText}>
        <Text style={styles.impactTitle}>MAKE AN IMPACT TODAY</Text>
        <Text style={styles.impactSub}>Your small help can create a big change.</Text>

        <PressableScale
          onPress={onPress}
          scaleTo={0.96}
          style={[styles.impactButton, theme.elevation.level2]}
          accessibilityLabel="Create a need"
        >
          <Feather name="heart" size={15} color={theme.color.primary} />
          <Text style={styles.impactButtonText}>Create a Need</Text>
        </PressableScale>
      </View>

      <Image source={IMPACT_HEART} style={styles.impactHeart} contentFit="contain" transition={200} />
    </View>
  );
}

const styles = StyleSheet.create({
  // --- section chrome ---
  card: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radii.xl,
    borderWidth: 1,
    borderColor: theme.color.borderSubtle,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing.xs,
    gap: theme.spacing.sm,
  },
  cardTitle: {
    ...theme.typography.overline,
    color: theme.color.primary,
    flex: 1,
  },
  viewAll: { ...theme.typography.caption, color: theme.color.primary, fontWeight: "700" },

  // --- generic row ---
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  rowText: { flex: 1, gap: 1 },
  rowLabel: { ...theme.typography.bodySmall, fontWeight: "600", color: theme.color.textPrimary },

  // --- helplines ---
  helplineIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: theme.color.primarySoft,
    backgroundColor: theme.color.surface,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  helplineImage: { width: 22, height: 22 },
  helplineNumber: { ...theme.typography.caption, color: theme.color.textSecondary },

  // --- trust ---
  trustList: { gap: theme.spacing.md, paddingBottom: theme.spacing.sm },
  trustRow: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.md },
  trustIcon: { marginTop: 1 },
  trustTitle: { ...theme.typography.bodySmall, fontWeight: "700", color: theme.color.success },
  trustBody: { ...theme.typography.caption, color: theme.color.textSecondary },

  // --- stories ---
  storyCard: {
    flexDirection: "row",
    gap: theme.spacing.md,
    backgroundColor: theme.color.backgroundAlt,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.sm,
    alignItems: "center",
  },
  storyImage: { width: 84, height: 96, borderRadius: theme.radii.md, backgroundColor: theme.color.surfaceSunken },
  storyImageFallback: { alignItems: "center", justifyContent: "center", backgroundColor: theme.color.primarySoft },
  storyBody: { flex: 1, gap: theme.spacing.sm },
  storySummary: { ...theme.typography.caption, color: theme.color.textPrimary, lineHeight: 17 },
  readMoreRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  readMore: { ...theme.typography.caption, color: theme.color.primary, fontWeight: "700" },

  dots: { flexDirection: "row", justifyContent: "center", gap: 5, paddingTop: theme.spacing.sm },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: theme.color.border },
  dotActive: { width: 14, backgroundColor: theme.color.primary },

  // --- supporters ---
  rankBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: theme.color.surface,
  },
  rankText: { fontSize: 9, fontWeight: "800", color: theme.color.textInverse },
  supporterMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
  supporterTag: { ...theme.typography.caption, fontSize: 11, color: theme.color.textSecondary },
  bloodChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.color.bloodSoft,
  },
  bloodChipText: { fontSize: 10, fontWeight: "800", color: theme.color.blood },
  amount: { ...theme.typography.bodySmall, fontWeight: "800", color: theme.color.textPrimary },

  // --- events ---
  eventIcon: {
    width: 38,
    height: 38,
    borderRadius: theme.radii.md,
    backgroundColor: theme.color.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  eventImage: { width: "100%", height: "100%" },
  eventMeta: { ...theme.typography.caption, color: theme.color.textSecondary },

  // --- impact CTA ---
  impactCard: {
    flexDirection: "row",
    alignItems: "center",
    // Sampled from the artwork so the heart's own background melts into the card instead of
    // sitting on it as a visible rectangle.
    backgroundColor: "#FCE9E9",
    borderRadius: theme.radii.xl,
    paddingLeft: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
    overflow: "hidden",
  },
  impactText: { flex: 1, gap: theme.spacing.sm, paddingRight: theme.spacing.sm },
  impactTitle: { ...theme.typography.h3, color: theme.color.primaryDeep, letterSpacing: 0.2 },
  impactSub: { ...theme.typography.caption, color: theme.color.textSecondary, lineHeight: 17 },
  impactButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    alignSelf: "flex-start",
    backgroundColor: theme.color.surface,
    borderRadius: theme.radii.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    marginTop: theme.spacing.xs,
  },
  impactButtonText: { ...theme.typography.bodySmall, fontWeight: "800", color: theme.color.primary },
  // Sized in dp and pinned to the right edge; the text column takes the remaining width, so the
  // card works from a 240dp drawer panel up to a full-width screen.
  impactHeart: { width: 96, height: 116, marginRight: -6 },
});
