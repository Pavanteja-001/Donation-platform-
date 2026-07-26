import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { theme } from "../../lib/theme";

function initialsFrom(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (first + last).toUpperCase() || "?";
}

// PRD Appendix A.4 — shows profile photo when available, falls back to initials circle.
// Overhauled with expo-image for aggressive caching and smooth load transitions.
export function Avatar({
  name,
  photoUrl,
  size = 40,
}: {
  name: string | null | undefined;
  photoUrl?: string | null;
  size?: number;
}) {
  if (photoUrl) {
    return (
      <Image
        source={{ uri: photoUrl }}
        style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={200}
      />
    );
  }
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.initials, { fontSize: size * 0.4 }]}>{initialsFrom(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    backgroundColor: theme.color.primary,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  initials: { color: theme.color.onPrimary, fontWeight: "700" },
});
