import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import * as ImagePicker from "expo-image-picker";
import { Feather } from "@expo/vector-icons";
import { theme } from "../lib/theme";
import { PressableScale } from "./ui";

export interface PickedPhoto {
  uri: string;
  mimeType: string;
}

// PRD §6.1 — a need carries up to 5 images. The backend enforces the same cap.
const MAX_PHOTOS = 5;

/**
 * Attach photos when creating any need (a separate flow from donation proof — see
 * signUpload/uploadToSignedUrl in NeedDetailScreen).
 *
 * The label is optional because the create forms render their own field labels; having both
 * produced a duplicated "Photos" heading on every create screen.
 */
export function PhotoPicker({
  photos,
  onChange,
  label = "Photos",
  helper = "Optional — up to 5 images",
}: {
  photos: PickedPhoto[];
  onChange: (photos: PickedPhoto[]) => void;
  label?: string | null;
  helper?: string | null;
}) {
  async function handleAdd() {
    if (photos.length >= MAX_PHOTOS) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Allow photo access to attach photos.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS - photos.length,
    });
    if (result.canceled) return;
    const picked = result.assets.map((a) => ({ uri: a.uri, mimeType: a.mimeType ?? "image/jpeg" }));
    onChange([...photos, ...picked].slice(0, MAX_PHOTOS));
  }

  function handleRemove(index: number) {
    onChange(photos.filter((_, i) => i !== index));
  }

  const isFull = photos.length >= MAX_PHOTOS;

  return (
    <View>
      {label ? (
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.counter}>
            {photos.length}/{MAX_PHOTOS}
          </Text>
        </View>
      ) : null}
      {helper ? <Text style={styles.helper}>{helper}</Text> : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {photos.map((photo, index) => (
          <Animated.View key={photo.uri} entering={ZoomIn.duration(theme.motion.normal)} style={styles.thumbWrap}>
            <Image source={{ uri: photo.uri }} style={styles.thumb} contentFit="cover" transition={180} />
            <PressableScale
              onPress={() => handleRemove(index)}
              scaleTo={0.85}
              hitSlop={8}
              accessibilityLabel={`Remove photo ${index + 1}`}
              style={styles.removeBadge}
            >
              <Feather name="x" size={12} color="#FFFFFF" />
            </PressableScale>
          </Animated.View>
        ))}

        {!isFull && (
          <PressableScale onPress={handleAdd} accessibilityLabel="Add photo" style={styles.addTile}>
            <Feather name="plus" size={20} color={theme.color.primary} />
            <Text style={styles.addTileText}>Add</Text>
          </PressableScale>
        )}
      </ScrollView>

      {isFull && (
        <Animated.Text entering={FadeIn.duration(theme.motion.fast)} style={styles.fullNote}>
          Maximum of {MAX_PHOTOS} photos reached.
        </Animated.Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  labelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  label: { ...theme.typography.caption, fontWeight: "700", color: theme.color.textPrimary },
  counter: { ...theme.typography.caption, color: theme.color.textTertiary, fontWeight: "700" },
  helper: { ...theme.typography.caption, color: theme.color.textTertiary, marginTop: 2 },
  row: { gap: theme.spacing.sm, paddingTop: theme.spacing.md, paddingBottom: theme.spacing.xs },
  thumbWrap: { position: "relative" },
  thumb: {
    width: 84,
    height: 84,
    borderRadius: theme.radii.md,
    backgroundColor: theme.color.surfaceMuted,
  },
  removeBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.color.danger,
    borderWidth: 2,
    borderColor: theme.color.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  addTile: {
    width: 84,
    height: 84,
    borderRadius: theme.radii.md,
    borderWidth: 1.5,
    borderColor: theme.color.borderStrong,
    borderStyle: "dashed",
    backgroundColor: theme.color.background,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  addTileText: { ...theme.typography.caption, color: theme.color.primary, fontWeight: "700" },
  fullNote: { ...theme.typography.caption, color: theme.color.textTertiary, marginTop: theme.spacing.xs },
});
