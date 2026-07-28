import { useCallback, useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { applyToVolunteer, fetchNgo, type Ngo, type VolunteerApplication } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { theme } from "../lib/theme";
import { Gradient } from "../components/Gradient";
import { IconPlate } from "../components/Depth";
import { Avatar, Button, ErrorState, Input, PressableScale, Skeleton } from "../components/ui";
import { SuccessCelebration } from "../components/SuccessCelebration";

/** What the CTA says depends entirely on where this user stands with this organisation. */
function ctaFor(application: VolunteerApplication | null): { label: string; disabled: boolean; icon: "heart" | "clock" | "check-circle" } {
  if (!application) return { label: "I can volunteer", disabled: false, icon: "heart" };
  if (application.status === "PENDING") return { label: "Application sent", disabled: true, icon: "clock" };
  if (application.status === "APPROVED") return { label: "You volunteer here", disabled: true, icon: "check-circle" };
  return { label: "Apply again", disabled: false, icon: "heart" };
}

export function NgoDetailScreen({ ngoId, initial }: { ngoId: string; initial?: Ngo }) {
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const [ngo, setNgo] = useState<Ngo | null>(initial ?? null);
  const [application, setApplication] = useState<VolunteerApplication | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");
  const [availability, setAvailability] = useState("");
  const [skills, setSkills] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const { ngo: fetched, myApplication } = await fetchNgo(token, ngoId);
      setNgo(fetched);
      setApplication(myApplication);
      setError(null);
    } catch (err) {
      if (!ngo) setError(err instanceof Error ? err.message : "Couldn't load this organisation");
    }
    // `ngo` excluded on purpose — it changes on every fetch and would loop the focus effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, ngoId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleApply() {
    if (!token) return;
    setFormError(null);
    setIsSubmitting(true);
    try {
      const { application: created } = await applyToVolunteer(token, ngoId, {
        message: message.trim() || undefined,
        availability: availability.trim() || undefined,
        skills: skills.trim() || undefined,
      });
      setApplication(created);
      setShowForm(false);
      setApplied(true);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Couldn't send your application");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (error && !ngo) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ErrorState message={error} onRetry={load} />
      </View>
    );
  }

  if (!ngo) {
    return (
      <View style={styles.screen}>
        <Skeleton width="100%" height={200} radius={0} />
        <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
          <Skeleton width="60%" height={26} />
          <Skeleton width="40%" height={14} />
          <Skeleton width="100%" height={70} />
        </View>
      </View>
    );
  }

  if (applied) {
    return (
      <SuccessCelebration
        visible
        title="Application sent"
        message={`${ngo.name ?? "The organisation"} will review it and get back to you. You'll be notified either way.`}
        actionLabel="Done"
        onDismiss={() => setApplied(false)}
      />
    );
  }

  const cover = ngo.coverPhotoUrl ?? ngo.galleryPhotos[0] ?? null;
  const location = [ngo.area, ngo.city].filter(Boolean).join(", ");
  const team = ngo.teamMembers;
  // The list payload carries `teamCount` but not the members themselves, so an undefined
  // `teamMembers` alongside a non-zero count is exactly "the detail fetch hasn't landed yet".
  // An organisation with no team never shimmers — a placeholder that resolves to nothing is worse
  // than no placeholder.
  const teamCount = ngo.teamCount ?? 0;
  const isTeamLoading = team === undefined && teamCount > 0;
  const cta = ctaFor(application);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 120 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {cover ? (
          <Image source={{ uri: cover }} style={styles.hero} contentFit="cover" cachePolicy="memory-disk" transition={220} />
        ) : (
          <Gradient colors={theme.gradient.heroDeep} direction="diagonal" style={styles.hero}>
            <View style={styles.heroFallback}>
              <IconPlate icon="users" size="lg" tone="neutral" />
            </View>
          </Gradient>
        )}

        <Animated.View entering={FadeInDown.duration(360)} style={styles.body}>
          <Text style={styles.name}>{ngo.name ?? ngo.legalName ?? "Organisation"}</Text>

          {location ? (
            <View style={styles.metaRow}>
              <Feather name="map-pin" size={14} color={theme.color.textSecondary} />
              <Text style={styles.metaText}>{location}</Text>
            </View>
          ) : null}
          {ngo.address ? <Text style={styles.address}>{ngo.address}</Text> : null}
          {ngo.about ? <Text style={styles.about}>{ngo.about}</Text> : null}

          {/* Your standing with this organisation, stated plainly — a rejected applicant should
              see why rather than just a button that works again. */}
          {application?.status === "APPROVED" && (
            <View style={[styles.statusCard, styles.statusApproved]}>
              <Feather name="check-circle" size={16} color={theme.color.success} />
              <Text style={styles.statusText}>You're an approved volunteer here.</Text>
            </View>
          )}
          {application?.status === "PENDING" && (
            <View style={[styles.statusCard, styles.statusPending]}>
              <Feather name="clock" size={16} color={theme.color.warning} />
              <Text style={styles.statusText}>Your application is with them — they'll be in touch.</Text>
            </View>
          )}
          {application?.status === "REJECTED" && (
            <View style={[styles.statusCard, styles.statusRejected]}>
              <Feather name="x-circle" size={16} color={theme.color.danger} />
              <Text style={styles.statusText}>
                {application.rejectionReason ?? "They couldn't take your application this time."}
              </Text>
            </View>
          )}

          {/* Shimmer while the detail response is in flight. Opening this screen from the list
              hands us the list payload, which has no `teamMembers` — without a placeholder the
              team simply appears a beat later and shoves the gallery down the page. */}
          {isTeamLoading ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>The team</Text>
              <View style={styles.teamRow}>
                {Array.from({ length: Math.min(teamCount, 4) }, (_, i) => (
                  <View key={i} style={styles.teamCard}>
                    <Skeleton width={56} height={56} radius={28} />
                    <Skeleton width={58} height={11} />
                    <Skeleton width={42} height={9} />
                  </View>
                ))}
              </View>
            </View>
          ) : team && team.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>The team</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.teamRow}>
                {team.map((member) => (
                  <View key={member.id} style={styles.teamCard}>
                    <Avatar name={member.name} photoUrl={member.photoUrl} size={56} />
                    <Text style={styles.teamName} numberOfLines={1}>
                      {member.name}
                    </Text>
                    {member.role ? (
                      <Text style={styles.teamRole} numberOfLines={1}>
                        {member.role}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {ngo.galleryPhotos.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Their work</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.galleryRow}>
                {ngo.galleryPhotos.map((url, i) => (
                  <PressableScale key={url} onPress={() => setViewerIndex(i)} scaleTo={0.97} accessibilityLabel={`Photo ${i + 1}`}>
                    <Image source={{ uri: url }} style={styles.galleryImage} contentFit="cover" cachePolicy="memory-disk" transition={200} />
                  </PressableScale>
                ))}
              </ScrollView>
            </View>
          )}
        </Animated.View>
      </ScrollView>

      <Modal visible={viewerIndex !== null} transparent animationType="fade" onRequestClose={() => setViewerIndex(null)}>
        <View style={styles.viewer}>
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} contentOffset={{ x: (viewerIndex ?? 0) * screenWidth, y: 0 }}>
            {ngo.galleryPhotos.map((url) => (
              <Image key={url} source={{ uri: url }} style={{ width: screenWidth, height: "100%" }} contentFit="contain" cachePolicy="memory-disk" />
            ))}
          </ScrollView>
          <PressableScale onPress={() => setViewerIndex(null)} scaleTo={0.9} hitSlop={12} accessibilityLabel="Close photo" style={styles.viewerClose}>
            <Feather name="x" size={22} color="#FFFFFF" />
          </PressableScale>
        </View>
      </Modal>

      {/* Volunteer form as a sheet: three optional fields shouldn't cost a whole screen push. */}
      <Modal visible={showForm} transparent animationType="slide" onRequestClose={() => setShowForm(false)}>
        <View style={styles.backdrop}>
          <View style={[styles.sheet, theme.elevation.level3, { paddingBottom: Math.max(insets.bottom, theme.spacing.lg) }]}>
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>Volunteer with {ngo.name ?? "them"}</Text>
                <Text style={styles.sheetHint}>They'll see this and your contact details.</Text>
              </View>
              <Button label="✕" variant="ghost" size="sm" onPress={() => setShowForm(false)} />
            </View>

            <Input label="What can you help with?" placeholder="e.g. Teaching, medical camps, logistics" value={skills} onChangeText={setSkills} />
            <Input label="When are you free?" placeholder="e.g. Weekends, evenings after 6" value={availability} onChangeText={setAvailability} />
            <Input label="Anything else" placeholder="A short note for the organisation" multiline value={message} onChangeText={setMessage} />

            {formError && (
              <Animated.View entering={FadeIn.duration(theme.motion.fast)} style={styles.errorRow}>
                <Feather name="alert-circle" size={13} color={theme.color.danger} />
                <Text style={styles.errorText}>{formError}</Text>
              </Animated.View>
            )}

            <Button
              label={isSubmitting ? "Sending…" : "Send application"}
              icon="send"
              onPress={handleApply}
              disabled={isSubmitting}
              loading={isSubmitting}
              fullWidth
            />
          </View>
        </View>
      </Modal>

      <View style={[styles.footer, theme.elevation.level3, { paddingBottom: Math.max(insets.bottom, theme.spacing.lg) }]}>
        <Button label={cta.label} icon={cta.icon} onPress={() => setShowForm(true)} disabled={cta.disabled} fullWidth />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.background },
  centered: { alignItems: "center", justifyContent: "center", padding: theme.spacing.xl },
  content: {},

  hero: { width: "100%", height: 200, backgroundColor: theme.color.surfaceMuted },
  heroFallback: { flex: 1, alignItems: "center", justifyContent: "center" },

  body: { padding: theme.spacing.lg, gap: theme.spacing.sm },
  name: { ...theme.typography.h1, color: theme.color.textPrimary },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaText: { ...theme.typography.bodySmall, color: theme.color.textSecondary },
  address: { ...theme.typography.caption, color: theme.color.textTertiary },
  about: { ...theme.typography.body, color: theme.color.textSecondary, marginTop: theme.spacing.sm, lineHeight: 22 },

  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
  },
  statusApproved: { backgroundColor: theme.color.successSoft },
  statusPending: { backgroundColor: theme.color.warningSoft },
  statusRejected: { backgroundColor: theme.color.dangerSoft },
  statusText: { ...theme.typography.caption, color: theme.color.textPrimary, flex: 1, fontWeight: "600" },

  section: { marginTop: theme.spacing.xl, gap: theme.spacing.sm },
  sectionTitle: { ...theme.typography.h3, color: theme.color.textPrimary },

  teamRow: { flexDirection: "row", gap: theme.spacing.md, paddingRight: theme.spacing.lg },
  teamCard: { alignItems: "center", width: 84, gap: 5 },
  teamName: { ...theme.typography.caption, color: theme.color.textPrimary, fontWeight: "700", textAlign: "center" },
  teamRole: { ...theme.typography.caption, color: theme.color.textTertiary, fontSize: 11, textAlign: "center" },

  galleryRow: { gap: theme.spacing.sm, paddingRight: theme.spacing.lg },
  galleryImage: { width: 150, height: 110, borderRadius: theme.radii.lg, backgroundColor: theme.color.surfaceMuted },

  viewer: { flex: 1, backgroundColor: "rgba(10,6,7,0.96)" },
  viewerClose: {
    position: "absolute",
    top: 48,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
  },

  backdrop: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.45)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: theme.color.surface,
    borderTopLeftRadius: theme.radii.xl,
    borderTopRightRadius: theme.radii.xl,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  sheetHeader: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  sheetTitle: { ...theme.typography.h3, color: theme.color.textPrimary },
  sheetHint: { ...theme.typography.caption, color: theme.color.textSecondary },
  errorRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  errorText: { ...theme.typography.caption, color: theme.color.danger, flex: 1 },

  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: theme.spacing.lg,
    backgroundColor: theme.color.surface,
    borderTopWidth: 1,
    borderTopColor: theme.color.borderSubtle,
  },
});
