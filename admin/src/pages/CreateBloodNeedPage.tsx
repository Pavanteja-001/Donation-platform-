import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  fetchLocations,
  postBloodNeed,
  uploadPhotos,
  type AreaLocation,
  type BloodGroup,
  type DistrictItem,
} from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useCategoryParam } from "../lib/useCategoryParam";
import { PhotoPicker } from "../components/PhotoPicker";

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

const CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
  visakhapatnam: { lat: 17.7231, lng: 83.3012 },
  rushikonda: { lat: 17.7810, lng: 83.3770 },
  gajuwaka: { lat: 17.6930, lng: 83.2050 },
  mvpcolony: { lat: 17.7420, lng: 83.3250 },
  madhurawada: { lat: 17.8010, lng: 83.3410 },
  jagadamba: { lat: 17.7120, lng: 83.3010 },
  vizianagaram: { lat: 18.1066, lng: 83.3956 },
  vijayawada: { lat: 16.5062, lng: 80.648 },
  guntur: { lat: 16.3067, lng: 80.4365 },
  srikakulam: { lat: 18.2949, lng: 83.8938 },
  kakinada: { lat: 16.9891, lng: 82.2475 },
  tirupati: { lat: 13.6288, lng: 79.4192 },
};

function formatGroup(g: BloodGroup) {
  return g.replace("_POSITIVE", "+").replace("_NEGATIVE", "-");
}

export function CreateBloodNeedPage({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const { token } = useAuth();
  const category = useCategoryParam();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState("Visakhapatnam");
  const [area, setArea] = useState("Rushikonda");
  const [latitude, setLatitude] = useState("17.7810");
  const [longitude, setLongitude] = useState("83.3770");
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | null>(null);
  const [unitsNeeded, setUnitsNeeded] = useState("1");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [districts, setDistricts] = useState<DistrictItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const mapFrameRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    fetchLocations()
      .then(({ districts }) => setDistricts(districts))
      .catch(() => {});
  }, []);

  // Listen to messages from interactive Leaflet iframe map picker
  useEffect(() => {
    function handleIframeMessage(e: MessageEvent) {
      if (e.data && e.data.type === "PICK_ADMIN_COORDS") {
        setLatitude(Number(e.data.lat).toFixed(6));
        setLongitude(Number(e.data.lng).toFixed(6));
      }
    }
    window.addEventListener("message", handleIframeMessage);
    return () => window.removeEventListener("message", handleIframeMessage);
  }, []);

  const selectedDistrictObj = districts.find((d) => d.name.toLowerCase() === city.trim().toLowerCase());
  const availableAreas: AreaLocation[] = selectedDistrictObj ? selectedDistrictObj.areas : [];

  // Moves the pin without touching `srcDoc` — see the note on `mapPickerIframeHtml`.
  function moveMapPin(lat: number, lng: number) {
    setLatitude(lat.toString());
    setLongitude(lng.toString());
    mapFrameRef.current?.contentWindow?.postMessage({ type: "SET_ADMIN_PIN", lat, lng }, "*");
  }

  function handleDistrictChange(newCity: string) {
    setCity(newCity);
    setArea("");
    // Server-managed district centre first; CITY_COORDINATES is the offline fallback only, and
    // no longer silently resolves an unknown district to Visakhapatnam.
    const district = districts.find((d) => d.name.toLowerCase() === newCity.trim().toLowerCase());
    if (district?.latitude != null && district.longitude != null) {
      moveMapPin(district.latitude, district.longitude);
      return;
    }
    const coords = CITY_COORDINATES[newCity.trim().toLowerCase()];
    if (coords) moveMapPin(coords.lat, coords.lng);
  }

  function handleAreaChange(newArea: string) {
    setArea(newArea);
    const match = availableAreas.find((a) => a.name.toLowerCase() === newArea.trim().toLowerCase());
    if (match?.latitude != null && match.longitude != null) {
      moveMapPin(match.latitude, match.longitude);
      return;
    }
    const key = newArea.toLowerCase().replace(/\s+/g, "");
    if (CITY_COORDINATES[key]) {
      moveMapPin(CITY_COORDINATES[key].lat, CITY_COORDINATES[key].lng);
    }
  }

  // Frozen at mount: `srcDoc` changing is a full document reload, so rebuilding it from the
  // coordinate state tore the map down on every click of the picker. Pin moves go by postMessage.
  const mapPickerIframeHtml = useMemo(
    () => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body, html, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #F1F5F9; }
        .pin-label {
          background: #E11D48;
          color: white;
          padding: 4px 8px;
          border-radius: 12px;
          font-family: sans-serif;
          font-size: 11px;
          font-weight: bold;
          border: 2px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var lat = ${parseFloat(latitude) || 17.7810};
        var lng = ${parseFloat(longitude) || 83.3770};
        var map = L.map('map', { zoomControl: true }).setView([lat, lng], 13);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

        var pinIcon = L.divIcon({
          html: '<div class="pin-label">📍 Click Map to Move</div>',
          iconSize: [120, 24],
          iconAnchor: [60, 12],
          className: ''
        });
        var marker = L.marker([lat, lng], { icon: pinIcon, draggable: true }).addTo(map);

        function sendCoords(l1, l2) {
          window.parent.postMessage({ type: 'PICK_ADMIN_COORDS', lat: l1, lng: l2 }, '*');
        }

        map.on('click', function(e) {
          marker.setLatLng(e.latlng);
          sendCoords(e.latlng.lat, e.latlng.lng);
        });

        marker.on('dragend', function(e) {
          var pos = marker.getLatLng();
          sendCoords(pos.lat, pos.lng);
        });

        // District/area selections arrive as messages instead of a document reload.
        window.addEventListener('message', function(e) {
          if (!e.data || e.data.type !== 'SET_ADMIN_PIN') return;
          marker.setLatLng([e.data.lat, e.data.lng]);
          map.panTo([e.data.lat, e.data.lng]);
        });
      </script>
    </body>
    </html>
  `,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    const units = Number(unitsNeeded);
    if (!bloodGroup) return setError("Select a blood group");
    if (!units || units <= 0) return setError("Enter how many units are needed");

    // `Number("")` is 0 — the old `latitude ? Number(latitude) : undefined` sent a plausible
    // 0,0 (Gulf of Guinea) whenever a box was cleared. Send nothing and let the server resolve
    // the area/district centre instead.
    const parsedLat = Number(latitude);
    const parsedLng = Number(longitude);
    const hasPin =
      latitude.trim() !== "" &&
      longitude.trim() !== "" &&
      !Number.isNaN(parsedLat) &&
      !Number.isNaN(parsedLng) &&
      Math.abs(parsedLat) <= 90 &&
      Math.abs(parsedLng) <= 180;

    setError(null);
    setIsSubmitting(true);
    try {
      const photos = photoFiles.length > 0 ? await uploadPhotos(token, photoFiles, "need-photos") : undefined;
      await postBloodNeed(token, { category,
        title,
        description,
        city: city.trim() || undefined,
        area: area.trim() || undefined,
        latitude: hasPin ? parsedLat : undefined,
        longitude: hasPin ? parsedLng : undefined,
        bloodGroup,
        unitsNeeded: units,
        photos,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post this need");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <button type="button" className="link" onClick={onBack}>
        ‹ Back
      </button>
      <h2>Post a blood request</h2>
      <p className="hint">
        Posts and submits for verification immediately — verify it from the Needs tab afterward,
        same as anyone else's submission.
      </p>
      <form onSubmit={handleSubmit}>
        <label>
          Title
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        <label>
          Description
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} required />
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <label>
            District / City (Select from list)
            <select value={city} onChange={(e) => handleDistrictChange(e.target.value)}>
              {districts.map((d) => (
                <option key={d.id} value={d.name}>
                  {d.name} ({d.state})
                </option>
              ))}
            </select>
          </label>

          <label>
            Area / Hospital Locality
            {availableAreas.length > 0 ? (
              <select value={area} onChange={(e) => handleAreaChange(e.target.value)}>
                <option value="">-- Select Area --</option>
                {availableAreas.map((a) => (
                  <option key={a.id} value={a.name}>
                    {a.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={area}
                onChange={(e) => handleAreaChange(e.target.value)}
                placeholder="e.g. Rushikonda, Gajuwaka"
              />
            )}
          </label>
        </div>

        {/* Interactive Web Map Location Pinpoint Picker */}
        <div style={{ marginTop: "16px", marginBottom: "16px" }}>
          <label style={{ fontWeight: "600", display: "block", marginBottom: "6px" }}>
            📍 Pinpoint Location on Map (Click map to position pin)
          </label>
          <iframe
            ref={mapFrameRef}
            title="Map Pinpoint Picker"
            srcDoc={mapPickerIframeHtml}
            style={{
              width: "100%",
              height: "220px",
              border: "1px solid #CBD5E1",
              borderRadius: "8px",
            }}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <label>
            Map Latitude
            <input type="number" step="any" value={latitude} onChange={(e) => setLatitude(e.target.value)} placeholder="17.7810" />
          </label>
          <label>
            Map Longitude
            <input type="number" step="any" value={longitude} onChange={(e) => setLongitude(e.target.value)} placeholder="83.3770" />
          </label>
        </div>

        <p className="photo-picker-label">Blood group needed</p>
        <div className="mode-row" style={{ flexWrap: "wrap" }}>
          {BLOOD_GROUPS.map((g) => (
            <button
              key={g}
              type="button"
              className={bloodGroup === g ? "mode-option active" : "mode-option"}
              style={{ flex: "0 1 22%", minWidth: 70 }}
              onClick={() => setBloodGroup(g)}
            >
              {formatGroup(g)}
            </button>
          ))}
        </div>

        <label>
          Units needed
          <input type="number" min={1} value={unitsNeeded} onChange={(e) => setUnitsNeeded(e.target.value)} required />
        </label>

        <PhotoPicker files={photoFiles} onChange={setPhotoFiles} />

        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Submitting…" : "Submit for verification"}
        </button>
      </form>
    </div>
  );
}
