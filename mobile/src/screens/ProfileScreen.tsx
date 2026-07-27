import { useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as ImagePicker from "expo-image-picker";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { theme } from "../lib/theme";
import { Avatar, Badge, Button, Chip, PressableScale, type TrustTier } from "../components/ui";
import { ProgressBar } from "../components/ProgressBar";
import { AnimatedCounter } from "../components/AnimatedCounter";
import { useTranslation } from "../lib/i18n";
import { updateMe, uploadProfilePhoto } from "../lib/api";
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
        <View style={[styles.sectionIcon, { backgroundColor: tint }]}>
          <Feather name={icon} size={15} color={tone} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

/** One label/value line. `muted` marks a value the user hasn't filled in yet. */
function InfoRow({ icon, label, value, muted }: { icon: IconName; label: string; value: string; muted?: boolean }) {
  return (
    <View style={styles.infoRow}>
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
  const { token, user, trustTierInfo, refreshUser, signOut } = useAuth();
  const { language, setLanguage, t } = useTranslation();
  const navigation = useNavigation<AppNavigationProp>();
  const [isToggling, setIsToggling] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

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

          <View style={styles.badgeRow}>
            {tier && <Badge label={`${TIER_LABEL[tier]} donor`} icon="award" tone="accent" />}
            {user?.role ? <Badge label={user.role} tone="neutral" /> : null}
          </View>

          {trustTierInfo && (
            <>
              <View style={styles.statsStrip}>
                <View style={styles.stat}>
                  <AnimatedCounter value={trustTierInfo.confirmedContributionsCount} style={styles.statValue} />
                  <Text style={styles.statLabel}>Confirmed contributions</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{formatBloodGroup(user?.bloodGroup ?? null)}</Text>
                  <Text style={styles.statLabel}>Blood group</Text>
                </View>
              </View>

              {/* Thresholds come from the server (D-014 trust tiers) — never hardcoded here, so
                  tuning them is a backend-only change. Absent fields mean an older backend, in
                  which case we simply show no progress rather than guessing. */}
              {trustTierInfo.nextTier && trustTierInfo.nextTierAt != null && (
                <View style={styles.tierProgress}>
                  <View style={styles.tierProgressLabels}>
                    <Text style={styles.tierProgressText}>
                      {trustTierInfo.contributionsToNextTier === 0
                        ? `${TIER_LABEL[trustTierInfo.nextTier]} unlocked`
                        : `${trustTierInfo.contributionsToNextTier} more to ${TIER_LABEL[trustTierInfo.nextTier]}`}
                    </Text>
                    <Text style={styles.tierProgressCount}>
                      {trustTierInfo.confirmedContributionsCount}/{trustTierInfo.nextTierAt}
                    </Text>
                  </View>
                  <ProgressBar
                    raised={trustTierInfo.confirmedContributionsCount}
                    target={trustTierInfo.nextTierAt}
                    tone="accent"
                    showLabel={false}
                    height={6}
                  />
                </View>
              )}
            </>
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
            <Switch
              value={isAvailable}
              onValueChange={handleToggleAvailability}
              disabled={isToggling}
              trackColor={{ false: theme.color.border, true: theme.color.blood }}
              thumbColor={Platform.OS === "android" ? theme.color.surface : undefined}
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
          />
        </Section>
      </Animated.View>

      {/* Language (D-009 — tri-language is committed for v1) */}
      <Animated.View entering={FadeInDown.delay(180).duration(360)}>
        <Section icon="globe" title={t.selectLanguage} tone={theme.color.info} tint={theme.color.infoSoft}>
          <View style={styles.chipGrid}>
            <Chip label={t.english} icon={language === "en" ? "check" : undefined} active={language === "en"} onPress={() => setLanguage("en")} />
            <Chip label={t.telugu} icon={language === "te" ? "check" : undefined} active={language === "te"} onPress={() => setLanguage("te")} />
            <Chip label={t.hindi} icon={language === "hi" ? "check" : undefined} active={language === "hi"} onPress={() => setLanguage("hi")} />
          </View>
        </Section>
      </Animated.View>

      {/* Actions */}
      <Animated.View entering={FadeInDown.delay(240).duration(360)} style={styles.actions}>
        <Button
          label="Edit profile details"
          icon="edit-2"
          onPress={() => navigation.navigate("Register", { isSkippable: true })}
        />
        <Button
          label="My contributions & certificates"
          icon="award"
          variant="secondary"
          onPress={() => navigation.navigate("Tabs", { screen: "Activity" } as any)}
        />
        <Button label="Log out" icon="log-out" variant="danger" onPress={signOut} />
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
    alignItems: "center",
    alignSelf: "stretch",
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
  infoLabelGroup: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  infoLabel: { ...theme.typography.bodySmall, color: theme.color.textSecondary },
  infoValue: { ...theme.typography.bodySmall, fontWeight: "700", color: theme.color.textPrimary, flexShrink: 1 },
  infoValueMuted: { color: theme.color.textTertiary, fontWeight: "500" },

  switchRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  switchText: { flex: 1, gap: 2 },
  switchLabel: { ...theme.typography.bodyMedium, fontWeight: "700", color: theme.color.textPrimary },
  switchHint: { ...theme.typography.caption, color: theme.color.textSecondary },

  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
  actions: { gap: theme.spacing.sm, marginTop: theme.spacing.xs },
});
