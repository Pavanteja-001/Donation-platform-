import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { WebView } from "react-native-webview";
import { Feather } from "@expo/vector-icons";
import { fetchLocations, postBloodNeed, uploadPhotos, type BloodGroup, type DistrictLocation } from "../lib/api";
import { getCurrentGpsLocation } from "../lib/locationUtils";
import { useAuth } from "../context/AuthContext";
import { theme } from "../lib/theme";
import { formatBloodGroup } from "../lib/needMeta";
import { PhotoPicker, type PickedPhoto } from "../components/PhotoPicker";
import { CreateNeedScaffold, Field } from "../components/CreateNeedScaffold";
import { Input, Chip, Button } from "../components/ui";

const BLOOD_GROUPS: BloodGroup[] = [
  "A_POSITIVE",
  "A_NEGATIVE",
  "B_POSITIVE",
  "B_NEGATIVE",
  "AB_POSITIVE",
  "AB_NEGATIVE",
  "O_POSITIVE",
  "O_NEGATIVE",
];

const DEFAULT_DISTRICTS: DistrictLocation[] = [
  { id: "d1", name: "Visakhapatnam", state: "Andhra Pradesh", areas: ["Rushikonda", "Gajuwaka", "MVP Colony", "Madhurawada", "Anandapuram", "Jagadamba"] },
  { id: "d2", name: "Vizianagaram", state: "Andhra Pradesh", areas: ["Cantonment", "Phool Bagh", "Ring Road", "Balaji Nagar"] },
  { id: "d3", name: "NTR (Vijayawada)", state: "Andhra Pradesh", areas: ["Governorpet", "Benz Circle", "MG Road", "Eluru Road"] },
  { id: "d4", name: "Guntur", state: "Andhra Pradesh", areas: ["Brodipet", "Arundelpet", "Pattabhipuram", "Vidya Nagar"] },
  { id: "d5", name: "Srikakulam", state: "Andhra Pradesh", areas: ["PN Colony", "Day & Night Junction", "Seven Road Junction"] },
  { id: "d6", name: "Kakinada", state: "Andhra Pradesh", areas: ["Bhanugudi", "Main Road", "Suryaraopeta"] },
  { id: "d7", name: "Tirupati", state: "Andhra Pradesh", areas: ["Alipiri", "KT Road", "Bairagipatteda"] },
];

const CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
  visakhapatnam: { lat: 17.7231, lng: 83.3012 },
  rushikonda: { lat: 17.7810, lng: 83.3770 },
  gajuwaka: { lat: 17.6930, lng: 83.2050 },
  mvpcolony: { lat: 17.7420, lng: 83.3250 },
  madhurawada: { lat: 17.8010, lng: 83.3410 },
  jagadamba: { lat: 17.7120, lng: 83.3010 },
  vizianagaram: { lat: 18.1066, lng: 83.3956 },
  vijayawada: { lat: 16.5062, lng: 80.648 },
  "ntr (vijayawada)": { lat: 16.5062, lng: 80.648 },
  guntur: { lat: 16.3067, lng: 80.4365 },
  srikakulam: { lat: 18.2949, lng: 83.8938 },
  kakinada: { lat: 16.9891, lng: 82.2475 },
  tirupati: { lat: 13.6288, lng: 79.4192 },
};

export function CreateBloodNeedScreen({ onDone }: { onDone: () => void }) {
  const { token, user } = useAuth();
  const webViewRef = useRef<any>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState(user?.city ?? "Visakhapatnam");
  const [area, setArea] = useState(user?.area ?? "Rushikonda");
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | null>(null);
  const [unitsNeeded, setUnitsNeeded] = useState("1");
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [customLatStr, setCustomLatStr] = useState("17.7819");
  const [customLngStr, setCustomLngStr] = useState("83.3853");
  const [isFetchingGps, setIsFetchingGps] = useState(false);

  const [districts, setDistricts] = useState<DistrictLocation[]>(DEFAULT_DISTRICTS);
  const [showDistrictSelector, setShowDistrictSelector] = useState(false);
  const [showAreaSelector, setShowAreaSelector] = useState(false);

  useEffect(() => {
    fetchLocations()
      .then(({ districts: fetched }) => {
        if (fetched && fetched.length > 0) setDistricts(fetched);
      })
      .catch(() => {});
  }, []);

  async function handleFetchGps() {
    setIsFetchingGps(true);
    const loc = await getCurrentGpsLocation();
    setIsFetchingGps(false);
    if (loc) {
      updateCoordinates(loc.latitude, loc.longitude);
      if (loc.city) setCity(loc.city);
      if (loc.area) setArea(loc.area);
    }
  }

  function updateCoordinates(lat: number, lng: number) {
    const latStr = lat.toFixed(6);
    const lngStr = lng.toFixed(6);
    setCustomLatStr(latStr);
    setCustomLngStr(lngStr);

    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(
        `window.setPinLocation(${lat}, ${lng}); true;`
      );
    }
  }

  function handleSelectDistrict(districtName: string) {
    setCity(districtName);
    setArea("");
    setShowDistrictSelector(false);
    const key = districtName.toLowerCase();
    const coords = CITY_COORDINATES[key] || CITY_COORDINATES["visakhapatnam"];
    updateCoordinates(coords.lat, coords.lng);
    setError(null);
  }

  function handleSelectArea(areaName: string) {
    setArea(areaName);
    setShowAreaSelector(false);
    const key = areaName.toLowerCase().replace(/\s+/g, "");
    if (CITY_COORDINATES[key]) {
      updateCoordinates(CITY_COORDINATES[key].lat, CITY_COORDINATES[key].lng);
    }
    setError(null);
  }

  const currentDistrictObj = districts.find((d) => d.name.toLowerCase() === city.trim().toLowerCase()) || districts[0];
  const availableAreas = currentDistrictObj ? currentDistrictObj.areas : ["Rushikonda", "Gajuwaka", "MVP Colony", "Madhurawada"];

  const mapPickerHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body, html, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #F1F5F9; }
        .pin-label {
          background: #E11D48;
          color: white;
          padding: 5px 10px;
          border-radius: 14px;
          font-family: sans-serif;
          font-size: 11px;
          font-weight: bold;
          border: 2px solid white;
          box-shadow: 0 3px 8px rgba(0,0,0,0.35);
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var initLat = ${parseFloat(customLatStr) || 17.7819};
        var initLng = ${parseFloat(customLngStr) || 83.3853};
        var map = L.map('map', { zoomControl: true }).setView([initLat, initLng], 13);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

        var pinIcon = L.divIcon({
          html: '<div class="pin-label">📍 Tap Map to Move</div>',
          iconSize: [110, 26],
          iconAnchor: [55, 13],
          className: ''
        });
        var currentMarker = L.marker([initLat, initLng], { icon: pinIcon, draggable: true }).addTo(map);

        function notifyPoint(lat, lng) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'PICK_LOCATION', lat: lat, lng: lng }));
        }

        map.on('click', function(e) {
          currentMarker.setLatLng(e.latlng);
          notifyPoint(e.latlng.lat, e.latlng.lng);
        });

        currentMarker.on('dragend', function(e) {
          var position = currentMarker.getLatLng();
          notifyPoint(position.lat, position.lng);
        });

        window.setPinLocation = function(lat, lng) {
          currentMarker.setLatLng([lat, lng]);
          map.panTo([lat, lng]);
        };
      </script>
    </body>
    </html>
  `;

  async function handleSubmit() {
    if (!token) return;
    const units = Number(unitsNeeded);
    if (!title.trim() || !description.trim()) return setError("Title and description are required");
    if (!bloodGroup) return setError("Select a blood group");
    if (!units || units <= 0) return setError("Enter how many units are needed");

    const parsedLat = parseFloat(customLatStr);
    const parsedLng = parseFloat(customLngStr);
    const defaultCoords = CITY_COORDINATES[city.trim().toLowerCase()] || { lat: 17.7819, lng: 83.3853 };

    const finalLat = !isNaN(parsedLat) ? parsedLat : defaultCoords.lat;
    const finalLng = !isNaN(parsedLng) ? parsedLng : defaultCoords.lng;

    setError(null);
    setIsSubmitting(true);
    try {
      const photoUrls = photos.length > 0 ? await uploadPhotos(token, photos, "need-photos") : undefined;
      await postBloodNeed(token, {
        title: title.trim(),
        description: description.trim(),
        bloodGroup,
        unitsNeeded: units,
        city: city.trim() || undefined,
        area: area.trim() || undefined,
        latitude: finalLat,
        longitude: finalLng,
        photos: photoUrls,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post this need");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <CreateNeedScaffold
      type="BLOOD"
      title="Request blood"
      subtitle="Eligible donors in your city are notified once this is verified."
      error={error}
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      submitLabel="Submit blood request"
    >
      <Input
        label="Title"
        placeholder="e.g. O+ blood needed at Rushikonda Hospital"
        icon="type"
        value={title}
        onChangeText={(txt) => {
          setTitle(txt);
          setError(null);
        }}
      />

      <Input
        label="Description"
        placeholder="Describe the situation and hospital room / contact details"
        multiline
        value={description}
        onChangeText={(txt) => {
          setDescription(txt);
          setError(null);
        }}
      />

      {/* District Dropdown Selector */}
      <Field label="District / City (Tap to Select)" helper="Select your district from the dropdown list">
        <TouchableOpacity
          style={styles.dropdownBtn}
          onPress={() => {
            setShowDistrictSelector(!showDistrictSelector);
            setShowAreaSelector(false);
          }}
          activeOpacity={0.7}
        >
          <View style={styles.dropdownLeft}>
            <Feather name="map-pin" size={16} color={theme.color.primary} />
            <Text style={styles.dropdownText}>{city || "Select District / City"}</Text>
          </View>
          <Feather name={showDistrictSelector ? "chevron-up" : "chevron-down"} size={20} color={theme.color.primary} />
        </TouchableOpacity>

        {showDistrictSelector && (
          <View style={styles.dropdownMenu}>
            <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled>
              {districts.map((d) => (
                <TouchableOpacity
                  key={d.id}
                  style={[styles.dropdownItem, city.toLowerCase() === d.name.toLowerCase() && styles.dropdownItemActive]}
                  onPress={() => handleSelectDistrict(d.name)}
                >
                  <Feather
                    name={city.toLowerCase() === d.name.toLowerCase() ? "check-circle" : "circle"}
                    size={15}
                    color={city.toLowerCase() === d.name.toLowerCase() ? theme.color.primary : "#94A3B8"}
                  />
                  <Text style={[styles.itemText, city.toLowerCase() === d.name.toLowerCase() && styles.itemTextActive]}>
                    {d.name} ({d.state})
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </Field>

      {/* Area Dropdown Selector */}
      <Field label="Area / Hospital Locality (Tap to Select)" helper="Select hospital area locality">
        <TouchableOpacity
          style={styles.dropdownBtn}
          onPress={() => {
            setShowAreaSelector(!showAreaSelector);
            setShowDistrictSelector(false);
          }}
          activeOpacity={0.7}
        >
          <View style={styles.dropdownLeft}>
            <Feather name="navigation" size={16} color={theme.color.primary} />
            <Text style={styles.dropdownText}>{area || "Select Area / Locality"}</Text>
          </View>
          <Feather name={showAreaSelector ? "chevron-up" : "chevron-down"} size={20} color={theme.color.primary} />
        </TouchableOpacity>

        {showAreaSelector && (
          <View style={styles.dropdownMenu}>
            <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
              {availableAreas.length > 0 ? (
                availableAreas.map((a) => (
                  <TouchableOpacity
                    key={a}
                    style={[styles.dropdownItem, area.toLowerCase() === a.toLowerCase() && styles.dropdownItemActive]}
                    onPress={() => handleSelectArea(a)}
                  >
                    <Feather
                      name={area.toLowerCase() === a.toLowerCase() ? "check-circle" : "circle"}
                      size={15}
                      color={area.toLowerCase() === a.toLowerCase() ? theme.color.primary : "#94A3B8"}
                    />
                    <Text style={[styles.itemText, area.toLowerCase() === a.toLowerCase() && styles.itemTextActive]}>
                      {a}
                    </Text>
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={{ padding: 12, color: theme.color.textSecondary, fontSize: 13 }}>
                  Type custom area below
                </Text>
              )}
            </ScrollView>
          </View>
        )}

        <Input
          label=""
          placeholder="Or type custom area if not listed"
          icon="navigation"
          value={area}
          onChangeText={(txt) => {
            setArea(txt);
            setError(null);
          }}
        />
      </Field>

      {/* Interactive Map Pinpoint Picker (Tap anywhere to move pin) */}
      <Field label="Pinpoint Map Location (Tap Map to Move Pin)" helper="Tap or drag pin to exact hospital building">
        <View style={styles.mapContainer}>
          <WebView
            ref={webViewRef}
            originWhitelist={["*"]}
            source={{ html: mapPickerHtml }}
            style={styles.miniMap}
            onMessage={(event: any) => {
              try {
                const data = JSON.parse(event.nativeEvent.data);
                if (data.type === "PICK_LOCATION") {
                  setCustomLatStr(data.lat.toFixed(6));
                  setCustomLngStr(data.lng.toFixed(6));
                }
              } catch (e) {}
            }}
          />
        </View>

        <View style={styles.coordRow}>
          <View style={{ flex: 1 }}>
            <Input
              label="Latitude"
              placeholder="17.7819"
              icon="crosshair"
              keyboardType="numeric"
              value={customLatStr}
              onChangeText={(txt) => {
                setCustomLatStr(txt);
                const num = parseFloat(txt);
                if (!isNaN(num)) updateCoordinates(num, parseFloat(customLngStr) || 83.3853);
              }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Input
              label="Longitude"
              placeholder="83.3853"
              icon="crosshair"
              keyboardType="numeric"
              value={customLngStr}
              onChangeText={(txt) => {
                setCustomLngStr(txt);
                const num = parseFloat(txt);
                if (!isNaN(num)) updateCoordinates(parseFloat(customLatStr) || 17.7819, num);
              }}
            />
          </View>
        </View>

        <Button
          label={isFetchingGps ? "Auto-detecting GPS…" : "📍 Auto-Detect My Current GPS Pinpoint"}
          variant="secondary"
          size="sm"
          onPress={handleFetchGps}
          disabled={isFetchingGps}
          style={{ marginTop: 8 }}
        />
      </Field>

      <Field label="Blood group needed" helper="Donors are matched on group, eligibility and city">
        <View style={styles.chipGrid}>
          {BLOOD_GROUPS.map((g) => (
            <Chip
              key={g}
              label={formatBloodGroup(g)}
              tone="blood"
              active={bloodGroup === g}
              onPress={() => {
                setBloodGroup(g);
                setError(null);
              }}
            />
          ))}
        </View>
      </Field>

      <Input
        label="Units needed"
        placeholder="2"
        icon="droplet"
        keyboardType="number-pad"
        value={unitsNeeded}
        onChangeText={(txt) => {
          setUnitsNeeded(txt);
          setError(null);
        }}
      />

      <PhotoPicker photos={photos} onChange={setPhotos} />
    </CreateNeedScaffold>
  );
}

const styles = StyleSheet.create({
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
  coordRow: { flexDirection: "row", gap: theme.spacing.md },
  dropdownBtn: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E11D48",
    borderRadius: theme.radii.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  dropdownLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  dropdownText: { fontSize: 15, color: theme.color.textPrimary, fontWeight: "700" },
  dropdownMenu: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radii.lg,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
    overflow: "hidden",
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  dropdownItemActive: { backgroundColor: "rgba(225, 29, 72, 0.08)" },
  itemText: { fontSize: 14, color: theme.color.textPrimary, fontWeight: "500" },
  itemTextActive: { fontWeight: "800", color: theme.color.primary },

  mapContainer: {
    height: 190,
    borderRadius: theme.radii.lg,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: theme.color.borderSubtle,
    marginBottom: 12,
  },
  miniMap: { width: "100%", height: "100%" },
});
