import React, { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { theme } from "../lib/theme";
import { Avatar, Badge, Button, Card } from "../components/ui";
import { updateMe, uploadProfilePhoto } from "../lib/api";
import type { AppNavigationProp } from "../navigation/types";

const TIER_LABEL: Record<string, string> = { BRONZE: "Bronze", SILVER: "Silver", GOLD: "Gold" };

export function ProfileScreen() {
  const { token, user, trustTierInfo, refreshUser, signOut } = useAuth();
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
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card elevated style={styles.identityCard}>
        <View style={styles.identityRow}>
          <Pressable onPress={handlePickPhoto} disabled={isUploadingPhoto} style={styles.avatarWrap}>
            <Avatar name={user?.name} photoUrl={user?.profilePhotoUrl} size={64} />
            <View style={styles.cameraOverlay}>
              <Text style={styles.cameraIcon}>{isUploadingPhoto ? "…" : "✎"}</Text>
            </View>
          </Pressable>
          <View style={styles.identityText}>
            <Text style={styles.name}>{user?.name ?? "No name yet"}</Text>
            <Text style={styles.meta}>
              {user?.role} · {user?.phone}
            </Text>
            {user?.email && <Text style={styles.emailText}>{user.email}</Text>}
          </View>
        </View>
        {trustTierInfo && (
          <View style={styles.tierRow}>
            <Badge label={`${TIER_LABEL[trustTierInfo.trustTier]} donor`} tone="primary" />
            <Text style={styles.tierMeta}>{trustTierInfo.confirmedContributionsCount} confirmed contributions</Text>
          </View>
        )}
      </Card>

      <Card style={styles.infoCard}>
        <Text style={styles.infoTitle}>Profile details</Text>
        
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Location</Text>
          <Text style={styles.infoValue}>
            {user?.city && user?.area ? `${user.area}, ${user.city}` : "Not set"}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Date of birth</Text>
          <Text style={styles.infoValue}>{user?.dateOfBirth ? user.dateOfBirth.slice(0, 10) : "Not set"}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Gender</Text>
          <Text style={styles.infoValue}>{formatGender(user?.gender ?? null)}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Blood group</Text>
          <Text style={styles.infoValue}>{formatBloodGroup(user?.bloodGroup ?? null)}</Text>
        </View>
      </Card>

      <Card style={styles.switchCard}>
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchLabel}>Available to donate</Text>
            <Text style={styles.switchHint}>Visible to blood match requests in your city</Text>
          </View>
          <Switch
            value={user?.availableToDonate ?? true}
            onValueChange={handleToggleAvailability}
            disabled={isToggling}
          />
        </View>
      </Card>

      <View style={styles.section}>
        <Button
          label="Edit profile details"
          variant="primary"
          onPress={() => navigation.navigate("Register", { isSkippable: true })}
        />
      </View>

      <View style={styles.section}>
        <Button
          label="My contributions & certificates"
          variant="secondary"
          onPress={() => navigation.navigate("Tabs", { screen: "Activity" } as any)}
        />
      </View>

      <View style={styles.section}>
        <Button label="Log out" variant="danger" onPress={signOut} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.color.background },
  content: { padding: theme.spacing.lg },
  identityCard: { marginBottom: theme.spacing.md },
  identityRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  avatarWrap: { position: "relative" },
  cameraOverlay: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.color.primary,
    borderWidth: 2,
    borderColor: theme.color.background,
    alignItems: "center",
    justifyContent: "center",
  },
  cameraIcon: { fontSize: 10, color: theme.color.onPrimary, fontWeight: "700" },
  identityText: { flex: 1 },
  name: { ...theme.typography.h2, color: theme.color.textPrimary },
  meta: { ...theme.typography.caption, color: theme.color.textSecondary, marginTop: 2 },
  emailText: { ...theme.typography.caption, color: theme.color.textSecondary, marginTop: 2 },
  tierRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
  },
  tierMeta: { ...theme.typography.caption, color: theme.color.textSecondary },
  infoCard: { marginBottom: theme.spacing.md, padding: theme.spacing.lg },
  infoTitle: { fontSize: 16, fontWeight: "600", color: theme.color.textPrimary, marginBottom: theme.spacing.md },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  infoLabel: { fontSize: 14, color: theme.color.textSecondary },
  infoValue: { fontSize: 14, fontWeight: "500", color: theme.color.textPrimary },
  switchCard: { marginBottom: theme.spacing.lg, padding: theme.spacing.lg },
  switchRow: { flexDirection: "row", alignItems: "center" },
  switchLabel: { fontSize: 15, fontWeight: "600", color: theme.color.textPrimary },
  switchHint: { fontSize: 12, color: theme.color.textSecondary, marginTop: 2 },
  section: { marginBottom: theme.spacing.md },
});
