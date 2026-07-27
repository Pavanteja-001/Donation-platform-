import { useRef, useState } from "react";
import { Modal, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { Feather } from "@expo/vector-icons";
import { updateNeedLocation, type Need } from "../lib/api";
import { getCurrentGpsLocation } from "../lib/locationUtils";
import { useAuth } from "../context/AuthContext";
import { theme } from "../lib/theme";
import { Button, Input } from "./ui";

// Falls back to Visakhapatnam only as the *initial camera position* for a need that has no
// coordinate at all — nothing is submitted until the poster moves the pin, so this never
// becomes a stored location.
const FALLBACK_LAT = 17.6868;
const FALLBACK_LNG = 83.2185;

function buildPickerHtml(lat: number, lng: number) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    body, html, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #F1F5F9; }
    .pin-label {
      background: #E11D48; color: #fff; padding: 5px 10px; border-radius: 14px;
      font-family: sans-serif; font-size: 11px; font-weight: bold;
      border: 2px solid #fff; box-shadow: 0 3px 8px rgba(0,0,0,0.35); white-space: nowrap;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: true }).setView([${lat}, ${lng}], 14);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

    var pinIcon = L.divIcon({
      html: '<div class="pin-label">📍 Tap map to move</div>',
      iconSize: [118, 26], iconAnchor: [59, 13], className: ''
    });
    var marker = L.marker([${lat}, ${lng}], { icon: pinIcon, draggable: true }).addTo(map);

    function notify(la, ln) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'PICK', lat: la, lng: ln }));
    }
    map.on('click', function(e) { marker.setLatLng(e.latlng); notify(e.latlng.lat, e.latlng.lng); });
    marker.on('dragend', function() { var p = marker.getLatLng(); notify(p.lat, p.lng); });

    window.setPin = function(la, ln) { marker.setLatLng([la, ln]); map.panTo([la, ln]); };
  </script>
</body>
</html>`;
}

/**
 * Lets a poster place (or correct) the exact pin on a need they already submitted.
 *
 * The general need-edit path is DRAFT-only — the story admin verified must not change — but the
 * map pin is how a donor finds the hospital, so `PATCH /api/needs/:id/location` stays open for
 * as long as the need is non-terminal. This is the UI for it.
 */
export function LocationPinModal({
  need,
  visible,
  onClose,
  onSaved,
}: {
  need: Need;
  visible: boolean;
  onClose: () => void;
  onSaved: (updated: Need) => void;
}) {
  const { token } = useAuth();
  const webViewRef = useRef<any>(null);
  const initialLat = need.latitude ?? FALLBACK_LAT;
  const initialLng = need.longitude ?? FALLBACK_LNG;

  const [latStr, setLatStr] = useState(need.latitude != null ? String(need.latitude) : "");
  const [lngStr, setLngStr] = useState(need.longitude != null ? String(need.longitude) : "");
  const [isFetchingGps, setIsFetchingGps] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Built once per mount so moving the pin never reloads the map (which would reset zoom/pan).
  const htmlRef = useRef(buildPickerHtml(initialLat, initialLng));

  function movePin(lat: number, lng: number) {
    setLatStr(lat.toFixed(6));
    setLngStr(lng.toFixed(6));
    webViewRef.current?.injectJavaScript(`window.setPin(${lat}, ${lng}); true;`);
  }

  async function handleUseGps() {
    setIsFetchingGps(true);
    const loc = await getCurrentGpsLocation();
    setIsFetchingGps(false);
    if (!loc) {
      setError("Couldn't read your GPS location — check location permission.");
      return;
    }
    setError(null);
    movePin(loc.latitude, loc.longitude);
  }

  async function handleSave() {
    if (!token) return;
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);
    if (isNaN(lat) || isNaN(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      setError("Tap the map (or use GPS) to place the pin first.");
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      const { need: updated } = await updateNeedLocation(token, need.id, { latitude: lat, longitude: lng });
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update the location");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, theme.elevation.level3]}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heading}>
                {need.latitude != null ? "Update map location" : "Set map location"}
              </Text>
              <Text style={styles.subheading} numberOfLines={1}>
                {need.title}
              </Text>
            </View>
            <Button label="✕" variant="ghost" size="sm" onPress={onClose} />
          </View>

          <View style={styles.mapBox}>
            <WebView
              ref={webViewRef}
              originWhitelist={["*"]}
              source={{ html: htmlRef.current }}
              style={styles.map}
              onMessage={(event: any) => {
                try {
                  const data = JSON.parse(event.nativeEvent.data);
                  if (data.type === "PICK") {
                    setLatStr(data.lat.toFixed(6));
                    setLngStr(data.lng.toFixed(6));
                    setError(null);
                  }
                } catch (e) {}
              }}
            />
          </View>

          <View style={styles.coordRow}>
            <View style={{ flex: 1 }}>
              <Input
                label="Latitude"
                placeholder="17.7830"
                icon="crosshair"
                keyboardType="numeric"
                value={latStr}
                onChangeText={(txt) => {
                  setLatStr(txt);
                  const lat = parseFloat(txt);
                  const lng = parseFloat(lngStr);
                  if (!isNaN(lat) && !isNaN(lng)) movePin(lat, lng);
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                label="Longitude"
                placeholder="83.3830"
                icon="crosshair"
                keyboardType="numeric"
                value={lngStr}
                onChangeText={(txt) => {
                  setLngStr(txt);
                  const lat = parseFloat(latStr);
                  const lng = parseFloat(txt);
                  if (!isNaN(lat) && !isNaN(lng)) movePin(lat, lng);
                }}
              />
            </View>
          </View>

          {error && (
            <View style={styles.errorRow}>
              <Feather name="alert-circle" size={13} color={theme.color.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Button
            label={isFetchingGps ? "Reading GPS…" : "📍 Use my current location"}
            variant="secondary"
            size="sm"
            onPress={handleUseGps}
            disabled={isFetchingGps}
          />
          <Button
            label={isSaving ? "Saving…" : "Save location"}
            variant={need.type === "BLOOD" ? "blood" : "primary"}
            onPress={handleSave}
            disabled={isSaving}
            style={{ marginTop: theme.spacing.sm }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.45)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: theme.color.surface,
    borderTopLeftRadius: theme.radii.xl,
    borderTopRightRadius: theme.radii.xl,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  header: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  heading: { ...theme.typography.h3, color: theme.color.textPrimary },
  subheading: { ...theme.typography.caption, color: theme.color.textSecondary },
  mapBox: {
    height: 240,
    borderRadius: theme.radii.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.color.borderSubtle,
  },
  map: { width: "100%", height: "100%" },
  coordRow: { flexDirection: "row", gap: theme.spacing.md },
  errorRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  errorText: { ...theme.typography.caption, color: theme.color.danger, flex: 1 },
});
