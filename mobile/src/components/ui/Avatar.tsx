import { StyleSheet, Text, View } from "react-native";
import { theme } from "../../lib/theme";

function initialsFrom(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (first + last).toUpperCase() || "?";
}

// PRD Appendix A.4 — a plain initials avatar. No photo-upload-for-profile feature exists yet, so
// this is deliberately image-less rather than building an unused image slot.
export function Avatar({ name, size = 40 }: { name: string | null | undefined; size?: number }) {
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
  },
  initials: { color: theme.color.onPrimary, fontWeight: "700" },
});
