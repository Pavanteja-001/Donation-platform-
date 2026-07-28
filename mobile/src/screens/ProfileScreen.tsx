import { useCallback, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { theme } from "../lib/theme";
import { IconPlate, litRamp } from "../components/Depth";
import { Avatar, Badge, Button, PressableScale, type TrustTier } from "../components/ui";
import { Gradient } from "../components/Gradient";
import { TierEmblem } from "../components/illustrations";
import { TactileSwitch } from "../components/TactileSwitch";
import { fetchMemberships, updateMe, uploadProfilePhoto, type VolunteerApplication } from "../lib/api";
import type { AppNavigationProp } from "../navigation/types";

type IconName = keyof typeof Feather.glyphMap;

const TIER_LABEL: Record<string, string> = { BRONZE: "Bronze", SILVER: "Silver", GOLD: "Gold" };

/** Titled card wrapper — every block on this screen shares the same shape. */
function Section({ icon, title, children, tone = theme.color.primary, tint = theme.color.primarySoft }: {
  icon: IconName;
  title: string;
  children: React.ReactNode;
  tone?: string;
  tint?: string;
}) {
  return (
    <View style={[styles.card, theme.elevation.level2]}>
      <View style={styles.sectionHeader}>
        <IconPlate icon={icon} size="sm" tone="custom" colors={litRamp(tone)} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

/** One label/value line. `muted` marks a value the user hasn't filled in yet. */
function InfoRow({ icon, label, value, muted, isLast }: { icon: IconName; label: string; value: string; muted?: boolean; isLast?: boolean }) {
  return (
    <View style={[styles.infoRow, isLast && styles.infoRowLast]}>
      <View style={styles.infoLabelGroup}>
        <Feather name={icon} size={14} color={theme.color.textTertiary} />
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text style={[styles.infoValue, muted && styles.infoValueMuted]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export function ProfileScreen() {
  const { token, user, trustTierInfo, refreshUser } = useAuth();
  const navigation = useNavigation<AppNavigationProp>();
  const [isToggling, setIsToggling] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [memberships, setMemberships] = useState<VolunteerApplication[] | null>(null);

  // Refreshed on focus, so approving a volunteer in the panel shows up as soon as the user
  // returns to this tab rather than on a cold start.
  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      fetchMemberships(token)
        .then(({ applications }) => setMemberships(applications))
        .catch(() => setMemberships([]));
    }, [token])
  );

  const handleToggleAvailability = async (value: boolean) => {
    if (!token) return;
    setIsToggling(true);
    try {
      await updateMe(token, { availableToDonate: value });
      await refreshUser();
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to update availability");
    } finally {
      setIsToggling(false);
    }
  };

  const handlePickPhoto = async () => {
    if (!token) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Allow photo library access to change your profile picture.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const contentType = asset.mimeType ?? "image/jpeg";
    setIsUploadingPhoto(true);
    try {
      const publicUrl = await uploadProfilePhoto(token, asset.uri, contentType);
      await updateMe(token, { profilePhotoUrl: publicUrl });
      await refreshUser();
    } catch (err) {
      Alert.alert("Upload failed", err instanceof Error ? err.message : "Could not upload photo");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const formatBloodGroup = (g: string | null) => {
    if (!g) return "Not set";
    return g.replace("_POSITIVE", "+").replace("_NEGATIVE", "-");
  };

  const formatGender = (gender: string | null) => {
    if (!gender) return "Not set";
    return gender.charAt(0) + gender.slice(1).toLowerCase();
  };

  const location = user?.city && user?.area ? `${user.area}, ${user.city}` : "Not set";
  const tier = (trustTierInfo?.trustTier ?? null) as TrustTier | null;
  const isAvailable = user?.availableToDonate ?? true;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Identity */}
      <Animated.View entering={FadeInDown.duration(360)}>
        <View style={[styles.card, styles.identityCard, theme.elevation.level2]}>
          <PressableScale onPress={handlePickPhoto} disabled={isUploadingPhoto} scaleTo={0.94} style={styles.avatarWrap}>
            <Avatar name={user?.name} photoUrl={user?.profilePhotoUrl} size={84} tier={tier} />
            <View style={styles.cameraOverlay}>
              <Feather name={isUploadingPhoto ? "loader" : "camera"} size={12} color={theme.color.onPrimary} />
            </View>
          </PressableScale>

          <Text style={styles.name}>{user?.name ?? "No name yet"}</Text>
          <Text style={styles.phone}>{user?.phone}</Text>
          {user?.email ? <Text style={styles.email}>{user.email}</Text> : null}

          {tier ? (
            <View style={styles.tierRow}>
              <TierEmblem tier={tier} size={52} />
              <View style={styles.tierText}>
                <Text style={styles.tierName}>{TIER_LABEL[tier]} donor</Text>
                {trustTierInfo?.nextTier && trustTierInfo.contributionsToNextTier != null ? (
                  <Text style={styles.tierNext}>
                    {trustTierInfo.contributionsToNextTier === 0
                      ? `${TIER_LABEL[trustTierInfo.nextTier]} unlocked`
                      : `${trustTierInfo.contributionsToNextTier} more to ${TIER_LABEL[trustTierInfo.nextTier]}`}
                  </Text>
                ) : tier === "GOLD" ? (
                  <Text style={styles.tierNext}>Top tier donor</Text>
                ) : null}
              </View>
              {user?.role ? <Badge label={user.role} tone="neutral" /> : null}
            </View>
          ) : (
            <View style={styles.badgeRow}>{user?.role ? <Badge label={user.role} tone="neutral" /> : null}</View>
          )}
        </View>
      </Animated.View>

      {/* Availability — the highest-value control on this screen, so it sits directly under identity */}
      <Animated.View entering={FadeInDown.delay(60).duration(360)}>
        <View style={[styles.card, theme.elevation.level2]}>
          <View style={styles.switchRow}>
            <View style={[styles.sectionIcon, { backgroundColor: isAvailable ? theme.color.bloodSoft : theme.color.surfaceMuted }]}>
              <Feather name="droplet" size={15} color={isAvailable ? theme.color.blood : theme.color.textTertiary} />
            </View>
            <View style={styles.switchText}>
              <Text style={styles.switchLabel}>Available to donate</Text>
              <Text style={styles.switchHint}>
                {isAvailable
                  ? "You'll be notified about blood requests in your city"
                  : "You won't receive blood request alerts"}
              </Text>
            </View>
            <TactileSwitch
              value={isAvailable}
              onValueChange={handleToggleAvailability}
              disabled={isToggling}
              accessibilityLabel="Available to donate blood"
            />
          </View>
        </View>
      </Animated.View>

      {/* Details */}
      <Animated.View entering={FadeInDown.delay(120).duration(360)}>
        <Section icon="user" title="Profile details">
          <InfoRow icon="map-pin" label="Location" value={location} muted={location === "Not set"} />
          <InfoRow
            icon="calendar"
            label="Date of birth"
            value={user?.dateOfBirth ? user.dateOfBirth.slice(0, 10) : "Not set"}
            muted={!user?.dateOfBirth}
          />
          <InfoRow icon="users" label="Gender" value={formatGender(user?.gender ?? null)} muted={!user?.gender} />
          <InfoRow
            icon="droplet"
            label="Blood group"
            value={formatBloodGroup(user?.bloodGroup ?? null)}
            muted={!user?.bloodGroup}
            isLast
          />
        </Section>
      </Animated.View>

      {/* Volunteering — approved applications are what make someone an official member, so an
          approved badge is a real credential rather than decoration. A pending one is shown too,
          otherwise an application seems to vanish after it's sent. */}
      <Animated.View entering={FadeInDown.delay(180).duration(360)}>
        <Section icon="users" title="Volunteering" tone={theme.color.info} tint={theme.color.infoSoft}>
          {memberships === null ? (
            <Text style={styles.volunteerEmpty}>Loading…</Text>
          ) : memberships.length === 0 ? (
            <>
              <Text style={styles.volunteerEmpty}>
                You're not volunteering with any organisation yet.
              </Text>
              <Button
                label="Find an NGO"
                icon="search"
                variant="secondary"
                size="sm"
                onPress={() => navigation.navigate("Ngos")}
                style={{ marginTop: theme.spacing.sm }}
              />
            </>
          ) : (
            <View style={styles.volunteerList}>
              {memberships.map((m) => {
                const approved = m.status === "APPROVED";
                const rejected = m.status === "REJECTED";
                return (
                  <PressableScale
                    key={m.id}
                    onPress={() => m.ngo && navigation.navigate("NgoDetail", { ngoId: m.ngo.id })}
                    scaleTo={0.98}
                    style={[styles.volunteerPill, approved && styles.volunteerPillApproved]}
                  >
                    <Feather
                      name={approved ? "check-circle" : rejected ? "x-circle" : "clock"}
                      size={14}
                      color={approved ? theme.color.success : rejected ? theme.color.danger : theme.color.warning}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.volunteerName} numberOfLines={1}>
                        {m.ngo?.name ?? m.ngo?.legalName ?? "Organisation"}
                      </Text>
                      <Text style={styles.volunteerStatus}>
                        {approved ? "Official volunteer" : rejected ? "Not accepted" : "Application pending"}
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={16} color={theme.color.textTertiary} />
                  </PressableScale>
                );
              })}
            </View>
          )}
        </Section>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.color.background },
  content: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxxl, gap: theme.spacing.md },

  card: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radii.xl,
    padding: theme.spacing.xl,
  },

  identityCard: { alignItems: "center", borderRadius: theme.radii.xxl },
  editButton: {
    position: "absolute",
    top: theme.spacing.md,
    right: theme.spacing.md,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.color.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarWrap: { position: "relative", marginBottom: theme.spacing.lg },
  cameraOverlay: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.color.primary,
    borderWidth: 2,
    borderColor: theme.color.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { ...theme.typography.h1, color: theme.color.textPrimary, textAlign: "center" },
  phone: { ...theme.typography.bodySmall, color: theme.color.textSecondary, marginTop: theme.spacing.xs },
  email: { ...theme.typography.caption, color: theme.color.textTertiary, marginTop: 2 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: theme.spacing.sm, marginTop: theme.spacing.lg },

  statsStrip: {
    flexDirection: "row",
    alignItems: "stretch",
    alignSelf: "stretch",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xl,
    paddingTop: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.color.borderSubtle,
  },
  stat: { flex: 1, alignItems: "center", gap: 2 },
  statValue: { ...theme.typography.numeric, color: theme.color.textPrimary },
  statLabel: { ...theme.typography.caption, color: theme.color.textTertiary, textAlign: "center" },
  statDivider: { width: 1, alignSelf: "stretch", backgroundColor: theme.color.borderSubtle },

  tierProgress: { alignSelf: "stretch", marginTop: theme.spacing.lg, gap: theme.spacing.sm },
  tierProgressLabels: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  tierProgressText: { ...theme.typography.caption, color: theme.color.textSecondary, fontWeight: "700" },
  tierProgressCount: { ...theme.typography.caption, color: theme.color.textTertiary, fontWeight: "700" },

  sectionHeader: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md, marginBottom: theme.spacing.lg },
  sectionIcon: { width: 32, height: 32, borderRadius: theme.radii.sm, alignItems: "center", justifyContent: "center" },
  sectionTitle: { ...theme.typography.h3, color: theme.color.textPrimary, flex: 1 },

  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.borderSubtle,
  },
  infoRowLast: { borderBottomWidth: 0 },
  infoLabelGroup: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  infoLabel: { ...theme.typography.bodySmall, color: theme.color.textSecondary },
  infoValue: { ...theme.typography.bodySmall, fontWeight: "700", color: theme.color.textPrimary, flexShrink: 1 },
  infoValueMuted: { color: theme.color.textTertiary, fontWeight: "500" },

  switchRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  switchText: { flex: 1, gap: 2 },
  switchLabel: { ...theme.typography.bodyMedium, fontWeight: "700", color: theme.color.textPrimary },
  switchHint: { ...theme.typography.caption, color: theme.color.textSecondary },

  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },

  tierRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    marginTop: theme.spacing.xs,
    alignSelf: "stretch",
  },
  tierText: { flex: 1 },
  tierName: { ...theme.typography.h3, color: theme.color.textPrimary },
  tierNext: { ...theme.typography.caption, color: theme.color.textSecondary, marginTop: 1 },
  statBlock: {
    flex: 1,
    alignItems: "center",
    gap: 2,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.color.borderSubtle,
    backgroundColor: theme.color.surface,
    overflow: "hidden",
  },
  statValueBlood: { color: theme.color.blood },


  volunteerEmpty: { ...theme.typography.bodySmall, color: theme.color.textSecondary },
  volunteerList: { gap: theme.spacing.sm },
  volunteerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.surface,
  },
  volunteerPillApproved: { borderColor: "rgba(14,159,110,0.3)", backgroundColor: theme.color.successSoft },
  volunteerName: { ...theme.typography.bodyMedium, color: theme.color.textPrimary, fontWeight: "700" },
  volunteerStatus: { ...theme.typography.caption, color: theme.color.textSecondary },

  actions: { gap: theme.spacing.sm, marginTop: theme.spacing.xs },
});
