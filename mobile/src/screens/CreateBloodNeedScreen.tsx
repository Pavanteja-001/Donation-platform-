import { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { WebView } from "react-native-webview";
import { Feather } from "@expo/vector-icons";
import { fetchLocations, postBloodNeed, uploadPhotos, type BloodGroup, type DistrictLocation, type AreaLocation } from "../lib/api";
import type { NeedCategory } from "../lib/needCategory";
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
  { id: "d1", name: "Visakhapatnam", state: "Andhra Pradesh", latitude: 17.6868, longitude: 83.2185, areas: [
    { id: "a1", name: "Rushikonda", latitude: 17.7810, longitude: 83.3770 },
    { id: "a2", name: "Gajuwaka", latitude: 17.6903, longitude: 83.2089 },
    { id: "a3", name: "MVP Colony", latitude: 17.7402, longitude: 83.3323 },
    { id: "a4", name: "Madhurawada", latitude: 17.8178, longitude: 83.3508 },
    { id: "a5", name: "Anandapuram", latitude: 17.8967, longitude: 83.3256 },
    { id: "a6", name: "Jagadamba", latitude: 17.7121, longitude: 83.3031 },
  ] },
  { id: "d2", name: "Vizianagaram", state: "Andhra Pradesh", latitude: 18.1124, longitude: 83.3976, areas: [
    { id: "a7", name: "Cantonment", latitude: 18.1189, longitude: 83.3951 },
    { id: "a8", name: "Phool Bagh", latitude: 18.1098, longitude: 83.4021 },
    { id: "a9", name: "Ring Road", latitude: 18.1250, longitude: 83.4100 },
    { id: "a10", name: "Balaji Nagar", latitude: 18.1020, longitude: 83.3880 },
  ] },
  { id: "d3", name: "NTR (Vijayawada)", state: "Andhra Pradesh", latitude: 16.5062, longitude: 80.6480, areas: [
    { id: "a11", name: "Governorpet", latitude: 16.5120, longitude: 80.6280 },
    { id: "a12", name: "Benz Circle", latitude: 16.5003, longitude: 80.6547 },
    { id: "a13", name: "MG Road", latitude: 16.5060, longitude: 80.6450 },
    { id: "a14", name: "Eluru Road", latitude: 16.5180, longitude: 80.6320 },
  ] },
  { id: "d4", name: "Guntur", state: "Andhra Pradesh", latitude: 16.3067, longitude: 80.4365, areas: [
    { id: "a15", name: "Brodipet", latitude: 16.3100, longitude: 80.4350 },
    { id: "a16", name: "Arundelpet", latitude: 16.3050, longitude: 80.4400 },
    { id: "a17", name: "Pattabhipuram", latitude: 16.3150, longitude: 80.4250 },
    { id: "a18", name: "Vidya Nagar", latitude: 16.2950, longitude: 80.4450 },
  ] },
  { id: "d5", name: "Srikakulam", state: "Andhra Pradesh", latitude: 18.2949, longitude: 83.8938, areas: [
    { id: "a19", name: "PN Colony", latitude: 18.3000, longitude: 83.8900 },
    { id: "a20", name: "Day & Night Junction", latitude: 18.2950, longitude: 83.8980 },
    { id: "a21", name: "Seven Road Junction", latitude: 18.2900, longitude: 83.8920 },
  ] },
  { id: "d6", name: "Kakinada", state: "Andhra Pradesh", latitude: 16.9891, longitude: 82.2475, areas: [
    { id: "a22", name: "Bhanugudi", latitude: 16.9850, longitude: 82.2400 },
    { id: "a23", name: "Main Road", latitude: 16.9920, longitude: 82.2450 },
    { id: "a24", name: "Suryaraopeta", latitude: 16.9800, longitude: 82.2520 },
  ] },
  { id: "d7", name: "Tirupati", state: "Andhra Pradesh", latitude: 13.6288, longitude: 79.4192, areas: [
    { id: "a25", name: "Alipiri", latitude: 13.6500, longitude: 79.4000 },
    { id: "a26", name: "KT Road", latitude: 13.6320, longitude: 79.4180 },
    { id: "a27", name: "Bairagipatteda", latitude: 13.6200, longitude: 79.4250 },
  ] },
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

export function CreateBloodNeedScreen({ onDone, category }: { onDone: () => void; category?: NeedCategory }) {
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

  // Once the poster has placed a pin themselves (map tap/drag, typed coordinates, GPS), an
  // area/district centre must never overwrite it — the pin is the exact location and is the
  // whole point of the picker.
  const hasExactPin = useRef(false);

  useEffect(() => {
    fetchLocations()
      .then(({ districts: fetched }) => {
        if (!fetched || fetched.length === 0) return;
        setDistricts(fetched);
        // The screen opens pre-filled with the poster's registered city/area, so centre the
        // pin on *that* locality rather than on the hardcoded Rushikonda default the state
        // was seeded with.
        if (hasExactPin.current) return;
        const district = fetched.find((d) => d.name.trim().toLowerCase() === city.trim().toLowerCase());
        const matchedArea = district?.areas.find((a) => a.name.trim().toLowerCase() === area.trim().toLowerCase());
        const centre =
          matchedArea?.latitude != null && matchedArea.longitude != null
            ? { lat: matchedArea.latitude, lng: matchedArea.longitude }
            : district?.latitude != null && district.longitude != null
              ? { lat: district.latitude, lng: district.longitude }
              : null;
        if (centre) updateCoordinates(centre.lat, centre.lng, { exact: false });
      })
      .catch(() => {});
    // Runs once on mount: this only seeds the initial pin, and re-running it on every city/area
    // keystroke would fight the poster for control of the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  function updateCoordinates(lat: number, lng: number, opts: { exact?: boolean } = {}) {
    // A district/area pick passes `exact: false` — it re-centres the map on the new locality
    // (the previous pin belongs to the place they just changed away from) and marks the pin as
    // approximate again until they drop one.
    hasExactPin.current = opts.exact !== false;
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

  function handleSelectDistrict(district: DistrictLocation) {
    setCity(district.name);
    setArea("");
    setShowDistrictSelector(false);
    // Prefer the district centre the server sent (admin-managed, always in sync with the
    // dropdown). CITY_COORDINATES is only the offline fallback for when /api/locations
    // didn't load — and it no longer falls back to Visakhapatnam for an unknown name, which
    // is what used to drop a Vijayawada request onto the Vizag coast.
    if (district.latitude != null && district.longitude != null) {
      updateCoordinates(district.latitude, district.longitude, { exact: false });
    } else {
      const coords = CITY_COORDINATES[district.name.trim().toLowerCase()];
      if (coords) updateCoordinates(coords.lat, coords.lng, { exact: false });
    }
    setError(null);
  }

  function handleSelectArea(areaItem: string | AreaLocation) {
    const areaName = typeof areaItem === "string" ? areaItem : areaItem.name;
    setArea(areaName);
    setShowAreaSelector(false);
    if (typeof areaItem !== "string" && areaItem.latitude != null && areaItem.longitude != null) {
      updateCoordinates(areaItem.latitude, areaItem.longitude, { exact: false });
    } else {
      const key = areaName.toLowerCase().replace(/\s+/g, "");
      if (CITY_COORDINATES[key]) {
        updateCoordinates(CITY_COORDINATES[key].lat, CITY_COORDINATES[key].lng, { exact: false });
      }
    }
    setError(null);
  }

  const currentDistrictObj = districts.find((d) => d.name.toLowerCase() === city.trim().toLowerCase()) || districts[0];
  const availableAreas: AreaLocation[] = currentDistrictObj ? currentDistrictObj.areas : [];

  // Built once, from the coordinate this screen opened with. It must NOT be rebuilt as the pin
  // moves: `source` changing reloads the WebView, which threw away the map's zoom/pan (and the
  // pin) on every tap and every keystroke in the lat/lng boxes. All later movement goes through
  // `window.setPinLocation` via injectJavaScript instead.
  const mapPickerHtml = useMemo(
    () => `
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
  `,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  async function handleSubmit() {
    if (!token) return;
    const units = Number(unitsNeeded);
    if (!title.trim() || !description.trim()) return setError("Title and description are required");
    if (!bloodGroup) return setError("Select a blood group");
    if (!units || units <= 0) return setError("Enter how many units are needed");

    // The pinned coordinate is the exact hospital/pickup point and is what the needs map
    // plots. If the boxes hold something unparseable, send nothing at all rather than a
    // stand-in near Rushikonda — the server then fills in the selected area's centre, which
    // is at least genuinely in the right locality.
    const parsedLat = parseFloat(customLatStr);
    const parsedLng = parseFloat(customLngStr);
    const hasPin =
      !isNaN(parsedLat) && !isNaN(parsedLng) && Math.abs(parsedLat) <= 90 && Math.abs(parsedLng) <= 180;

    setError(null);
    setIsSubmitting(true);
    try {
      const photoUrls = photos.length > 0 ? await uploadPhotos(token, photos, "need-photos") : undefined;
      await postBloodNeed(token, {
        category,
        title: title.trim(),
        description: description.trim(),
        bloodGroup,
        unitsNeeded: units,
        city: city.trim() || undefined,
        area: area.trim() || undefined,
        latitude: hasPin ? parsedLat : undefined,
        longitude: hasPin ? parsedLng : undefined,
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
                  onPress={() => handleSelectDistrict(d)}
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
                availableAreas.map((a) => {
                  const areaName = typeof a === "string" ? a : a.name;
                  const isSelected = area.toLowerCase() === areaName.toLowerCase();
                  return (
                    <TouchableOpacity
                      key={areaName}
                      style={[styles.dropdownItem, isSelected && styles.dropdownItemActive]}
                      onPress={() => handleSelectArea(a)}
                    >
                      <Feather
                        name={isSelected ? "check-circle" : "circle"}
                        size={15}
                        color={isSelected ? theme.color.primary : "#94A3B8"}
                      />
                      <Text style={[styles.itemText, isSelected && styles.itemTextActive]}>
                        {areaName}
                      </Text>
                    </TouchableOpacity>
                  );
                })
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
            // The HTML is frozen at its mount-time coordinate, so anything that moved the pin
            // before Leaflet finished loading (the locations fetch, a fast district pick) has to
            // be replayed here — otherwise the marker sits at the stale default.
            onLoadEnd={() => {
              const lat = parseFloat(customLatStr);
              const lng = parseFloat(customLngStr);
              if (!isNaN(lat) && !isNaN(lng)) {
                webViewRef.current?.injectJavaScript(`window.setPinLocation(${lat}, ${lng}); true;`);
              }
            }}
            onMessage={(event: any) => {
              try {
                const data = JSON.parse(event.nativeEvent.data);
                if (data.type === "PICK_LOCATION") {
                  // A tap/drag on the map is the poster stating the exact spot.
                  hasExactPin.current = true;
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
