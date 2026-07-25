import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { theme } from "../lib/theme";

export interface PickedPhoto {
  uri: string;
  mimeType: string;
}

const MAX_PHOTOS = 5;

// Reused by CreateMoneyNeedScreen and CreateKitNeedScreen — a poster can attach photos of the
// situation/kit when creating any need, not just at donation time (that's a separate flow —
// see signUpload/uploadToSignedUrl usage in NeedDetailScreen). Backend caps at 5 too.
export function PhotoPicker({ photos, onChange }: { photos: PickedPhoto[]; onChange: (photos: PickedPhoto[]) => void }) {
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

  return (
    <View>
      <Text style={styles.label}>Photos (optional, up to {MAX_PHOTOS})</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {photos.map((photo, index) => (
          <View key={photo.uri} style={styles.thumbWrap}>
            <Image source={{ uri: photo.uri }} style={styles.thumb} />
            <TouchableOpacity style={styles.removeBadge} onPress={() => handleRemove(index)}>
              <Text style={styles.removeBadgeText}>×</Text>
            </TouchableOpacity>
          </View>
        ))}
        {photos.length < MAX_PHOTOS && (
          <TouchableOpacity style={styles.addTile} onPress={handleAdd}>
            <Text style={styles.addTileText}>+ Add</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: "600", color: theme.color.textPrimary, marginBottom: theme.spacing.sm },
  row: { gap: theme.spacing.sm, paddingBottom: theme.spacing.md },
  thumbWrap: { position: "relative" },
  thumb: { width: 72, height: 72, borderRadius: theme.radius, backgroundColor: theme.color.border },
  removeBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.color.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  removeBadgeText: { color: theme.color.onPrimary, fontSize: 14, fontWeight: "700", lineHeight: 16 },
  addTile: {
    width: 72,
    height: 72,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  addTileText: { fontSize: 12, color: theme.color.primary, fontWeight: "600" },
});
