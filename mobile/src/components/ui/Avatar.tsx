import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import { theme } from "../../lib/theme";

export type TrustTier = "BRONZE" | "SILVER" | "GOLD";

// Tier ring colours. Metallic-leaning so a tier reads as an earned thing rather than a category.
const TIER_RING: Record<TrustTier, string> = {
  BRONZE: "#B26B3E",
  SILVER: "#94A3B8",
  GOLD: "#E0A32E",
};

function initialsFrom(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (first + last).toUpperCase() || "?";
}

// PRD Appendix A.4 — profile photo when available, initials circle otherwise.
export function Avatar({
  name,
  photoUrl,
  size = 40,
  /** Draws an earned trust-tier ring around the avatar (D-014 trust tiers). */
  tier,
  style,
}: {
  name: string | null | undefined;
  photoUrl?: string | null;
  size?: number;
  tier?: TrustTier | null;
  style?: StyleProp<ViewStyle>;
}) {
  const ringColor = tier ? TIER_RING[tier] : null;
  // The ring is a padded border around the avatar, so the photo itself never gets cropped by it.
  const ringPadding = ringColor ? Math.max(2, Math.round(size * 0.05)) : 0;
  const outerSize = size + ringPadding * 2 + (ringColor ? 4 : 0);

  const inner = photoUrl ? (
    <Image
      source={{ uri: photoUrl }}
      style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}
      contentFit="cover"
      cachePolicy="memory-disk"
      transition={200}
      recyclingKey={photoUrl}
    />
  ) : (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.initials, { fontSize: Math.round(size * 0.38) }]}>{initialsFrom(name)}</Text>
    </View>
  );

  if (!ringColor) return <View style={style}>{inner}</View>;

  return (
    <View
      style={[
        styles.ring,
        {
          width: outerSize,
          height: outerSize,
          borderRadius: outerSize / 2,
          borderColor: ringColor,
          padding: ringPadding,
        },
        style,
      ]}
    >
      {inner}
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
  initials: { color: theme.color.onPrimary, fontWeight: "800", letterSpacing: -0.3 },
  ring: {
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.color.surface,
  },
});
