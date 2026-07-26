import React, { useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import * as ImagePicker from "expo-image-picker";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { theme } from "../lib/theme";
import { Avatar, Badge, Button, Card } from "../components/ui";
import { updateMe, uploadProfilePhoto } from "../lib/api";
import type { AppNavigationProp } from "../navigation/types";
import { Feather } from "@expo/vector-icons";

const TIER_LABEL: Record<string, string> = { BRONZE: "Bronze", SILVER: "Silver", GOLD: "Gold" };

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function ProfileScreen() {
  const { token, user, trustTierInfo, refreshUser, signOut } = useAuth();
  const navigation = useNavigation<AppNavigationProp>();
  const [isToggling, setIsToggling] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const avatarScale = useSharedValue(1);

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

  const animatedAvatarStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: avatarScale.value }],
    };
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Identity Card */}
      <Animated.View entering={FadeInDown.delay(100).duration(400)}>
        <Card elevated style={styles.identityCard}>
          <View style={styles.identityRow}>
            <AnimatedPressable
              onPress={handlePickPhoto}
              onPressIn={() => (avatarScale.value = withSpring(0.92, { damping: 15 }))}
              onPressOut={() => (avatarScale.value = withSpring(1, { damping: 15 }))}
              disabled={isUploadingPhoto}
              style={[styles.avatarWrap, animatedAvatarStyle]}
            >
              <Avatar name={user?.name} photoUrl={user?.profilePhotoUrl} size={72} />
              <View style={styles.cameraOverlay}>
                <Feather
                  name={isUploadingPhoto ? "loader" : "camera"}
                  size={10}
                  color={theme.color.onPrimary}
                />
              </View>
            </AnimatedPressable>
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
      </Animated.View>

      {/* Profile Details Card */}
      <Animated.View entering={FadeInDown.delay(200).duration(400)}>
        <Card elevated style={styles.infoCard}>
          <Text style={styles.infoTitle}>Profile Details</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Location</Text>
            <Text style={styles.infoValue}>
              {user?.city && user?.area ? `${user.area}, ${user.city}` : "Not set"}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Date of Birth</Text>
            <Text style={styles.infoValue}>{user?.dateOfBirth ? user.dateOfBirth.slice(0, 10) : "Not set"}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Gender</Text>
            <Text style={styles.infoValue}>{formatGender(user?.gender ?? null)}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Blood Group</Text>
            <Text style={styles.infoValue}>{formatBloodGroup(user?.bloodGroup ?? null)}</Text>
          </View>
        </Card>
      </Animated.View>

      {/* Switch Card */}
      <Animated.View entering={FadeInDown.delay(300).duration(400)}>
        <Card elevated style={styles.switchCard}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>Available to Donate</Text>
              <Text style={styles.switchHint}>Visible to blood match requests in your city</Text>
            </View>
            <Switch
              value={user?.availableToDonate ?? true}
              onValueChange={handleToggleAvailability}
              disabled={isToggling}
              trackColor={{ false: theme.color.border, true: theme.color.primary }}
              thumbColor={Platform.OS === "android" ? theme.color.surface : undefined}
            />
          </View>
        </Card>
      </Animated.View>

      {/* Action Buttons */}
      <Animated.View entering={FadeInDown.delay(400).duration(400)} style={styles.actionsContainer}>
        <Button
          label="Edit Profile Details"
          variant="primary"
          onPress={() => navigation.navigate("Register", { isSkippable: true })}
        />
        <Button
          label="My Contributions & Certificates"
          variant="secondary"
          onPress={() => navigation.navigate("Tabs", { screen: "Activity" } as any)}
        />
        <Button label="Log Out" variant="danger" onPress={signOut} />
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.color.background },
  content: { padding: theme.spacing.lg, paddingBottom: 40 },
  identityCard: { marginBottom: theme.spacing.md },
  identityRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  avatarWrap: { position: "relative" },
  cameraOverlay: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.color.primary,
    borderWidth: 2,
    borderColor: theme.color.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  identityText: { flex: 1 },
  name: { ...theme.typography.h2, color: theme.color.textPrimary },
  meta: { ...theme.typography.caption, color: theme.color.textSecondary, marginTop: 2, fontWeight: "500" },
  emailText: { ...theme.typography.caption, color: theme.color.textSecondary, marginTop: 2, fontWeight: "500" },
  tierRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
  },
  tierMeta: { ...theme.typography.caption, color: theme.color.textSecondary, fontWeight: "500" },
  infoCard: { marginBottom: theme.spacing.md, padding: theme.spacing.lg },
  infoTitle: { fontSize: 16, fontWeight: "700", color: theme.color.textPrimary, marginBottom: theme.spacing.md },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  infoLabel: { fontSize: 14, color: theme.color.textSecondary, fontWeight: "500" },
  infoValue: { fontSize: 14, fontWeight: "600", color: theme.color.textPrimary },
  switchCard: { marginBottom: theme.spacing.lg, padding: theme.spacing.lg },
  switchRow: { flexDirection: "row", alignItems: "center" },
  switchLabel: { fontSize: 15, fontWeight: "700", color: theme.color.textPrimary },
  switchHint: { fontSize: 12, color: theme.color.textSecondary, marginTop: 2, fontWeight: "500" },
  actionsContainer: { gap: theme.spacing.md },
});
