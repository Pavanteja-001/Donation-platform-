import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import Animated, { FadeIn } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { fetchEvent, type PlatformEvent, type PlatformEventCard } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { theme } from "../lib/theme";
import { dial, formatEventDateTime, openLink } from "../lib/community";
import { Button, ErrorState, Skeleton } from "../components/ui";

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>
        <Feather name={icon} size={15} color={theme.color.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

/**
 * One event in full: when, where, what it is, and how to take part.
 *
 * Same pattern as the story detail — the card the user tapped paints the header immediately, and
 * only the description and contact details wait on the request.
 */
export function EventDetailScreen({ eventId, initial }: { eventId: string; initial?: PlatformEventCard }) {
  const { token } = useAuth();
  const [event, setEvent] = useState<PlatformEvent | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const { event: full } = await fetchEvent(token, eventId);
      setEvent(full);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load this event");
    }
  }, [token, eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = event ?? initial;

  if (error && !shown) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ErrorState message={error} onRetry={load} />
      </View>
    );
  }

  const banner = event?.bannerUrl ?? initial?.bannerUrl ?? null;
  const isOnline = shown?.mode === "ONLINE";
  const where = isOnline ? "Online" : event?.address?.trim() || shown?.location?.trim() || "Venue to be announced";

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {banner ? (
        <Image source={{ uri: banner }} style={styles.banner} contentFit="cover" cachePolicy="memory-disk" transition={220} />
      ) : null}

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <View style={styles.iconTile}>
            {shown?.iconUrl ? (
              <Image source={{ uri: shown.iconUrl }} style={styles.iconImage} contentFit="cover" transition={150} />
            ) : (
              <Feather name={isOnline ? "video" : "calendar"} size={20} color={theme.color.primary} />
            )}
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            {shown ? <Text style={styles.title}>{shown.title}</Text> : <Skeleton width="80%" height={24} />}
            {shown?.eventType ? (
              <View style={styles.typeChip}>
                <Text style={styles.typeChipText}>{shown.eventType}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.detailCard}>
          {shown ? <DetailRow icon="clock" label="Starts" value={formatEventDateTime(shown.startsAt)} /> : null}
          {shown?.endsAt ? <DetailRow icon="check-circle" label="Ends" value={formatEventDateTime(shown.endsAt)} /> : null}
          <DetailRow icon={isOnline ? "globe" : "map-pin"} label={isOnline ? "Mode" : "Where"} value={where} />
        </View>

        {event ? (
          <Animated.Text entering={FadeIn.duration(theme.motion.normal)} style={styles.description}>
            {event.description}
          </Animated.Text>
        ) : (
          <View style={{ gap: 10 }}>
            <Skeleton width="100%" height={13} />
            <Skeleton width="94%" height={13} />
            <Skeleton width="86%" height={13} />
          </View>
        )}

        {/* Both actions are optional on the model, so neither renders as a dead control. */}
        {event?.registrationUrl ? (
          <Button
            label="Register for this event"
            icon="external-link"
            onPress={() => void openLink(event.registrationUrl as string)}
            style={styles.action}
          />
        ) : null}
        {event?.contactPhone ? (
          <Button
            label={`Call ${event.contactPhone}`}
            icon="phone"
            variant="secondary"
            onPress={() => void dial(event.contactPhone as string)}
            style={styles.action}
          />
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.background },
  content: { paddingBottom: theme.spacing.xxl },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: theme.spacing.xl },
  banner: { width: "100%", height: 190, backgroundColor: theme.color.surfaceSunken },
  body: { padding: theme.spacing.lg, gap: theme.spacing.lg },
  titleRow: { flexDirection: "row", gap: theme.spacing.md, alignItems: "flex-start" },
  iconTile: {
    width: 46,
    height: 46,
    borderRadius: theme.radii.md,
    backgroundColor: theme.color.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  iconImage: { width: "100%", height: "100%" },
  title: { ...theme.typography.h2, color: theme.color.textPrimary },
  typeChip: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.color.primarySoft,
  },
  typeChipText: { fontSize: 10, fontWeight: "800", color: theme.color.primary },
  detailCard: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radii.xl,
    borderWidth: 1,
    borderColor: theme.color.borderSubtle,
    padding: theme.spacing.md,
    gap: theme.spacing.md,
    ...theme.elevation.level1,
  },
  detailRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  detailIcon: {
    width: 32,
    height: 32,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.color.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  detailLabel: { ...theme.typography.caption, color: theme.color.textTertiary },
  detailValue: { ...theme.typography.bodySmall, fontWeight: "600", color: theme.color.textPrimary },
  description: { ...theme.typography.body, color: theme.color.textSecondary, lineHeight: 24 },
  action: { marginTop: 0 },
});
