// ─────────────────────────────────────────────────────────────────────────────
// Location service — real GPS + reverse geocoding via expo-location.
// Works in Expo Go (expo-location is bundled in the client; no API key needed).
// ─────────────────────────────────────────────────────────────────────────────
import * as Location from 'expo-location';

// Returns { latitude, longitude, city, area, name } or throws a friendly error.
export async function detectCurrentLocation() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Location permission denied. Enable it in Settings to auto-detect your city.');
  }

  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  const { latitude, longitude } = pos.coords;

  let city = '';
  let area = '';
  try {
    const places = await Location.reverseGeocodeAsync({ latitude, longitude });
    const p = places?.[0];
    if (p) {
      city = p.city || p.subregion || p.region || '';
      area = p.district || p.name || p.street || '';
    }
  } catch (e) { /* coords still usable without a name */ }

  const name = [area, city].filter(Boolean).join(', ') || 'Current location';
  return { latitude, longitude, city, area, name };
}

// Reverse-geocode arbitrary coordinates (e.g. a spot picked on the map).
export async function reverseGeocode(latitude, longitude) {
  let city = '';
  let area = '';
  try {
    const places = await Location.reverseGeocodeAsync({ latitude, longitude });
    const p = places?.[0];
    if (p) {
      city = p.city || p.subregion || p.region || '';
      area = p.district || p.name || p.street || '';
    }
  } catch (e) { /* coords still usable */ }
  const name = [area, city].filter(Boolean).join(', ') || 'Selected location';
  return { latitude, longitude, city, area, name };
}
