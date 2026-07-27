import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View, ScrollView } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { WebView } from "react-native-webview";
import { Feather } from "@expo/vector-icons";
import { calculateRoadDistanceKm, getCurrentGpsLocation, type GpsLocationResult } from "../lib/locationUtils";
import { fetchNeeds, type Need, type BloodPayload } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { theme } from "../lib/theme";
import { formatBloodGroup, isBloodPayload } from "../lib/needMeta";
import { Chip, Button } from "../components/ui";

const DEFAULT_LAT = 17.7810;
const DEFAULT_LNG = 83.3770;

type MapFilter = "ALL" | "BLOOD" | "EMERGENCY";

const STATIC_LEAFLET_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    body, html, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #E2E8F0; }
    .custom-badge-pin {
      background: #E11D48;
      color: #FFFFFF;
      padding: 5px 10px;
      border-radius: 14px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 12px;
      font-weight: 800;
      border: 2px solid #FFFFFF;
      box-shadow: 0 3px 10px rgba(0,0,0,0.35);
      white-space: nowrap;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .user-gps-pin {
      background: #10B981;
      color: #FFFFFF;
      padding: 4px 9px;
      border-radius: 12px;
      font-family: -apple-system, sans-serif;
      font-size: 11px;
      font-weight: 800;
      border: 2px solid #FFFFFF;
      box-shadow: 0 3px 8px rgba(0,0,0,0.3);
      white-space: nowrap;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: true }).setView([${DEFAULT_LAT}, ${DEFAULT_LNG}], 13);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(map);

    var activeMarkers = [];
    // The map is only auto-framed once. After that the viewer owns the viewport — re-framing on
    // every data injection (which is what setView(bounds[0]) used to do) yanked the map back
    // mid-pan and made it feel broken.
    var hasFramed = false;

    window.updateMapData = function(userLoc, markers) {
      // Clear old markers
      activeMarkers.forEach(function(m) { map.removeLayer(m); });
      activeMarkers = [];

      // Render User GPS Marker
      if (userLoc) {
        var userIcon = L.divIcon({
          html: '<div class="user-gps-pin">📍 You</div>',
          iconSize: [54, 26],
          iconAnchor: [27, 13],
          className: ''
        });
        var uMarker = L.marker([userLoc.latitude, userLoc.longitude], { icon: userIcon }).addTo(map);
        activeMarkers.push(uMarker);
      }

      // Render Real-time Database Need Markers
      var bounds = [];
      markers.forEach(function(m) {
        var icon = L.divIcon({
          html: '<div class="custom-badge-pin" style="background:' + m.color + ';">' + m.badgeText + '</div>',
          iconSize: [56, 28],
          iconAnchor: [28, 14],
          className: ''
        });
        var marker = L.marker([m.lat, m.lng], { icon: icon }).addTo(map);
        marker.on('click', function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SELECT', id: m.id }));
        });
        activeMarkers.push(marker);
        bounds.push([m.lat, m.lng]);
      });

      if (!hasFramed && bounds.length > 0) {
        hasFramed = true;
        if (userLoc) bounds.push([userLoc.latitude, userLoc.longitude]);
        // fitBounds, not setView(bounds[0]) — a Guntur request and a Vizag request are 350 km
        // apart, and centring on whichever happened to be first hid every other pin off-screen.
        map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15 });
      }
    };
  </script>
</body>
</html>
`;

export function NeedsMapScreen({ onSelectNeed }: { onSelectNeed: (need: Need) => void }) {
  const { token } = useAuth();
  const webViewRef = useRef<any>(null);
  const [needs, setNeeds] = useState<Need[]>([]);
  const [selectedNeed, setSelectedNeed] = useState<Need | null>(null);
  const [userLocation, setUserLocation] = useState<GpsLocationResult | null>(null);
  const [filter, setFilter] = useState<MapFilter>("ALL");
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const { needs: data } = await fetchNeeds(token);
      setNeeds(data);
      getCurrentGpsLocation().then((loc) => setUserLocation(loc));
    } catch (err) {
      // Best effort
    }
  }, [token]);

  const filteredNeeds = useMemo(
    () =>
      needs.filter((n) => {
        if (filter === "BLOOD") return n.type === "BLOOD";
        if (filter === "EMERGENCY") return n.urgency === "EMERGENCY";
        return true;
      }),
    [needs, filter]
  );

  // Plots the coordinate the poster actually pinned — nothing else. A need whose latitude or
  // longitude is null is NOT drawn: the old fallback (`DEFAULT_LAT + idx * 0.005`) fanned such
  // needs out around Rushikonda, so a Guntur request showed up on the Vizag coast and the
  // distance readout under it was equally fictional. They're surfaced as a count instead.
  const markersData = useMemo(
    () =>
      filteredNeeds
        .filter((need) => need.latitude != null && need.longitude != null)
        .map((need) => {
          const isBlood = need.type === "BLOOD";
          const isEmergency = need.urgency === "EMERGENCY";
          const blood = isBlood && isBloodPayload(need.payload) ? (need.payload as BloodPayload) : null;
          const badgeText = blood ? formatBloodGroup(blood.blood_group) : need.type;
          const color = isEmergency ? "#DC2626" : isBlood ? "#E11D48" : "#2563EB";

          return {
            id: need.id,
            lat: need.latitude as number,
            lng: need.longitude as number,
            title: need.title,
            badgeText,
            color,
          };
        }),
    [filteredNeeds]
  );

  const unmappedCount = filteredNeeds.length - markersData.length;

  const sendMapData = useCallback(() => {
    if (!webViewRef.current || !isMapLoaded) return;
    const script = `window.updateMapData(${JSON.stringify(userLocation)}, ${JSON.stringify(markersData)}); true;`;
    webViewRef.current.injectJavaScript(script);
  }, [isMapLoaded, userLocation, markersData]);

  // Refresh the feed on tab focus. `load` is the only dependency on purpose: `sendMapData`
  // changes identity whenever the marker list does, and depending on it here re-ran the effect
  // (and therefore `load()`) after every fetch — an endless refetch loop while the tab was open.
  // The effect below handles re-injecting markers once the new data lands.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    sendMapData();
  }, [sendMapData]);

  return (
    <View style={styles.container}>
      {/* Static WebView Map with Dynamic Real-time JS Injection */}
      <WebView
        ref={webViewRef}
        originWhitelist={["*"]}
        source={{ html: STATIC_LEAFLET_HTML }}
        style={styles.map}
        onLoadEnd={() => {
          setIsMapLoaded(true);
          sendMapData();
        }}
        onMessage={(event: any) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === "SELECT") {
              const target = needs.find((n) => n.id === data.id);
              if (target) setSelectedNeed(target);
            }
          } catch (e) {}
        }}
      />

      {/* Floating Category Filter Chips */}
      <View style={styles.filterOverlay}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <Chip label="All Needs" active={filter === "ALL"} onPress={() => setFilter("ALL")} />
          <Chip label="Blood Only" icon="droplet" tone="blood" active={filter === "BLOOD"} onPress={() => setFilter("BLOOD")} />
          <Chip label="Emergency" icon="alert-triangle" tone="blood" active={filter === "EMERGENCY"} onPress={() => setFilter("EMERGENCY")} />
        </ScrollView>
        {unmappedCount > 0 && (
          <Text style={styles.unmappedNotice}>
            {unmappedCount} {unmappedCount === 1 ? "need has" : "needs have"} no pinned location — if it's
            yours, set it from My Needs
          </Text>
        )}
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
              {/* No "Rushikonda, Visakhapatnam" stand-in — a need with no location text says so. */}
              {selectedNeed.area
                ? `${selectedNeed.area}, ${selectedNeed.city}`
                : (selectedNeed.city ?? "Location not specified")}
              {userLocation && selectedNeed.latitude && selectedNeed.longitude
                ? ` · ~${calculateRoadDistanceKm(userLocation.latitude, userLocation.longitude, selectedNeed.latitude, selectedNeed.longitude)} km by road`
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
  unmappedNotice: {
    ...theme.typography.caption,
    color: theme.color.textSecondary,
    backgroundColor: theme.color.surface,
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radii.pill,
    overflow: "hidden",
  },

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
