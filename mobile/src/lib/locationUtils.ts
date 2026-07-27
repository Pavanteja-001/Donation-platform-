import * as Location from "expo-location";

export interface GpsLocationResult {
  latitude: number;
  longitude: number;
  city?: string;
  area?: string;
}

/**
 * Calculates distance between two coordinates in kilometers using the Haversine formula.
 */
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Requests location permissions and fetches current GPS position + reverse geocoded city/area.
 */
export async function getCurrentGpsLocation(): Promise<GpsLocationResult | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return null;

    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    const lat = loc.coords.latitude;
    const lng = loc.coords.longitude;

    let city: string | undefined;
    let area: string | undefined;

    try {
      const addresses = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (addresses && addresses.length > 0) {
        const addr = addresses[0];
        city = addr.city ?? addr.subregion ?? addr.region ?? undefined;
        area = addr.district ?? addr.street ?? addr.name ?? undefined;
      }
    } catch (err) {
      // Reverse geocoding optional fallback
    }

    return {
      latitude: lat,
      longitude: lng,
      city,
      area,
    };
  } catch (err) {
    return null;
  }
}
