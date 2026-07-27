import { useCallback, useState } from "react";
import { StyleSheet, Text, View, ScrollView } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import MapView, { Marker } from "react-native-maps";
import { Feather } from "@expo/vector-icons";
import { calculateDistanceKm, getCurrentGpsLocation, type GpsLocationResult } from "../lib/locationUtils";
import { fetchNeeds, type Need, type BloodPayload } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { theme } from "../lib/theme";
import { formatBloodGroup, isBloodPayload } from "../lib/needMeta";
import { Chip, Button } from "../components/ui";

const DEFAULT_REGION = {
  latitude: 17.6868,
  longitude: 83.2185,
  latitudeDelta: 0.25,
  longitudeDelta: 0.25,
};

type MapFilter = "ALL" | "BLOOD" | "EMERGENCY";

export function NeedsMapScreen({ onSelectNeed }: { onSelectNeed: (need: Need) => void }) {
  const { token } = useAuth();
  const [needs, setNeeds] = useState<Need[]>([]);
  const [selectedNeed, setSelectedNeed] = useState<Need | null>(null);
  const [userLocation, setUserLocation] = useState<GpsLocationResult | null>(null);
  const [filter, setFilter] = useState<MapFilter>("ALL");
  const [_isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const { needs: data } = await fetchNeeds(token);
      setNeeds(data);
      getCurrentGpsLocation().then((loc) => setUserLocation(loc));
    } catch (err) {
      // Best effort
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const filteredNeeds = needs.filter((n) => {
    if (filter === "BLOOD") return n.type === "BLOOD";
    if (filter === "EMERGENCY") return n.urgency === "EMERGENCY";
    return true;
  });

  return (
    <View style={styles.container}>
      {/* Interactive Map */}
      <MapView style={styles.map} initialRegion={DEFAULT_REGION} showsUserLocation showsMyLocationButton>
        {filteredNeeds.map((need, idx) => {
          const lat = need.latitude ?? (17.6868 + (idx % 4) * 0.02 - 0.03);
          const lng = need.longitude ?? (83.2185 + (idx % 3) * 0.02 - 0.02);
          const isBlood = need.type === "BLOOD";
          const isEmergency = need.urgency === "EMERGENCY";
          const blood = isBlood && isBloodPayload(need.payload) ? (need.payload as BloodPayload) : null;

          return (
            <Marker
              key={need.id}
              coordinate={{ latitude: lat, longitude: lng }}
              onPress={() => setSelectedNeed(need)}
              pinColor={isEmergency ? "#DC2626" : isBlood ? "#E11D48" : "#2563EB"}
            >
              <View
                style={[
                  styles.customMarker,
                  isEmergency ? styles.emergencyMarker : isBlood ? styles.bloodMarker : styles.defaultMarker,
                ]}
              >
                <Feather
                  name={isBlood ? "droplet" : isEmergency ? "alert-triangle" : "heart"}
                  size={12}
                  color="#FFFFFF"
                />
                <Text style={styles.markerText}>
                  {blood ? formatBloodGroup(blood.blood_group) : need.type}
                </Text>
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* Floating Category Filter Chips */}
      <View style={styles.filterOverlay}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <Chip label="All Needs" active={filter === "ALL"} onPress={() => setFilter("ALL")} />
          <Chip label="Blood Only" icon="droplet" tone="blood" active={filter === "BLOOD"} onPress={() => setFilter("BLOOD")} />
          <Chip label="Emergency" icon="alert-triangle" tone="blood" active={filter === "EMERGENCY"} onPress={() => setFilter("EMERGENCY")} />
        </ScrollView>
      </View>

      {/* Slide-Up Detail Card on Marker Tap */}
      {selectedNeed && (
        <View style={[styles.detailCard, theme.elevation.level3]}>
          <View style={styles.cardHeader}>
            <View style={styles.badgeRow}>
              <View
                style={[
                  styles.tagBadge,
                  selectedNeed.urgency === "EMERGENCY" ? styles.emergencyTag : styles.normalTag,
                ]}
              >
                <Text style={styles.tagText}>{selectedNeed.urgency}</Text>
              </View>
              <Text style={styles.typeText}>{selectedNeed.type}</Text>
            </View>
            <Button label="✕" variant="ghost" size="sm" onPress={() => setSelectedNeed(null)} />
          </View>

          <Text style={styles.cardTitle} numberOfLines={1}>
            {selectedNeed.title}
          </Text>

          <View style={styles.locationRow}>
            <Feather name="map-pin" size={13} color={theme.color.textSecondary} />
            <Text style={styles.locationText}>
              {selectedNeed.area ? `${selectedNeed.area}, ${selectedNeed.city}` : selectedNeed.city ?? "Nearby location"}
              {userLocation && selectedNeed.latitude && selectedNeed.longitude
                ? ` · ${calculateDistanceKm(userLocation.latitude, userLocation.longitude, selectedNeed.latitude, selectedNeed.longitude)} km away`
                : ""}
            </Text>
          </View>

          <Button
            label="View & Donate Now"
            variant={selectedNeed.type === "BLOOD" ? "blood" : "primary"}
            onPress={() => {
              onSelectNeed(selectedNeed);
              setSelectedNeed(null);
            }}
            style={{ marginTop: theme.spacing.md }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.color.background },
  map: { width: "100%", height: "100%" },
  filterOverlay: {
    position: "absolute",
    top: 50,
    left: 16,
    right: 16,
  },
  chipRow: { gap: 8, paddingRight: 16 },

  customMarker: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
  bloodMarker: { backgroundColor: "#E11D48" },
  emergencyMarker: { backgroundColor: "#DC2626" },
  defaultMarker: { backgroundColor: "#2563EB" },
  markerText: { color: "#FFFFFF", fontSize: 11, fontWeight: "700" },

  detailCard: {
    position: "absolute",
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: theme.color.surface,
    borderRadius: theme.radii.xl,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.color.borderSubtle,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  tagBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: theme.radii.pill },
  emergencyTag: { backgroundColor: "rgba(220, 38, 38, 0.15)" },
  normalTag: { backgroundColor: "rgba(37, 99, 235, 0.15)" },
  tagText: { fontSize: 10, fontWeight: "700", color: theme.color.primary, textTransform: "uppercase" },
  typeText: { ...theme.typography.caption, color: theme.color.textSecondary },
  cardTitle: { ...theme.typography.h3, color: theme.color.textPrimary, marginTop: theme.spacing.xs },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  locationText: { ...theme.typography.caption, color: theme.color.textSecondary },
});
