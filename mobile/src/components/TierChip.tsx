import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { TrustTier } from "../lib/api";
import { theme } from "../lib/theme";

/**
 * A donor's trust tier, small enough to sit beside their name.
 *
 * The full `TierEmblem` is a 52dp illustrated shield — right for the profile screen, far too loud
 * inline in a comment thread. This is the same information at name-tag scale, which is all a
 * reader needs to weigh advice from a stranger.
 *
 * Bronze is deliberately unlabelled: it's the starting tier, so showing it on every new account
 * would make the badge meaningless as a signal. Only Silver and Gold have been earned.
 */
const TIER: Record<Exclude<TrustTier, "BRONZE">, { label: string; fg: string; bg: string }> = {
  SILVER: { label: "Silver", fg: "#6B7280", bg: "rgba(107,114,128,0.12)" },
  GOLD: { label: "Gold", fg: "#B45309", bg: "rgba(180,83,9,0.12)" },
};

export function TierChip({ tier }: { tier: TrustTier | undefined }) {
  if (!tier || tier === "BRONZE") return null;
  const meta = TIER[tier];

  return (
    <View style={[styles.chip, { backgroundColor: meta.bg }]}>
      <Feather name="award" size={9} color={meta.fg} />
      <Text style={[styles.text, { color: meta.fg }]}>{meta.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: theme.radii.pill,
  },
  text: { fontSize: 10, lineHeight: 13, fontWeight: "800" },
});
