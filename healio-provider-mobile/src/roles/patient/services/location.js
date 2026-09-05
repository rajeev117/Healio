// ─────────────────────────────────────────────────────────────────────────────
// Location service — real GPS + reverse geocoding.
//
// expo-location alone works in Expo Go with no key and no billing. When
// GOOGLE_MAPS_API_KEY is set we ask Google's Geocoding API first: the device
// geocoder routinely returns just a city (or nothing) outside metros, and the
// patient's area is what drives "nearest provider" copy. Google failing for any
// reason — no key, offline, quota — falls straight back to expo-location.
// ─────────────────────────────────────────────────────────────────────────────
import * as Location from 'expo-location';
import { GOOGLE_MAPS_API_KEY } from './env';
import { googleReverseGeocode } from '../../../lib/googleGeocode';

// Shared resolver. Never throws — coordinates alone are always usable.
async function describe(latitude, longitude) {
  const g = await googleReverseGeocode(latitude, longitude, GOOGLE_MAPS_API_KEY);
  if (g && (g.city || g.area)) return { city: g.city, area: g.area };
  try {
    const places = await Location.reverseGeocodeAsync({ latitude, longitude });
    const p = places?.[0];
    if (p) {
      return {
        city: p.city || p.subregion || p.region || '',
        area: p.district || p.name || p.street || '',
      };
    }
  } catch (e) { /* coords still usable without a name */ }
  return { city: '', area: '' };
}

// Returns { latitude, longitude, city, area, name } or throws a friendly error.
export async function detectCurrentLocation() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Location permission denied. Enable it in Settings to auto-detect your city.');
  }

  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  const { latitude, longitude } = pos.coords;
  const { city, area } = await describe(latitude, longitude);

  const name = [area, city].filter(Boolean).join(', ') || 'Current location';
  return { latitude, longitude, city, area, name };
}

// Reverse-geocode arbitrary coordinates (e.g. a spot picked on the map).
export async function reverseGeocode(latitude, longitude) {
  const { city, area } = await describe(latitude, longitude);
  const name = [area, city].filter(Boolean).join(', ') || 'Selected location';
  return { latitude, longitude, city, area, name };
}
