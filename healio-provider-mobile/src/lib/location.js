// Location service — real GPS + reverse geocoding via expo-location.
// Works in Expo Go (no API key needed).
import * as Location from 'expo-location';

export async function detectCurrentLocation() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Location permission denied. Enable it in Settings to detect your location.');
  }
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  const { latitude, longitude } = pos.coords;

  let city = '';
  let address = '';
  try {
    const places = await Location.reverseGeocodeAsync({ latitude, longitude });
    const p = places?.[0];
    if (p) {
      city = p.city || p.subregion || p.region || '';
      address = [p.name || p.street, p.district, p.city].filter(Boolean).join(', ');
    }
  } catch (e) { /* coords still usable */ }

  return { latitude, longitude, city, address };
}

// Reverse-geocode a spot picked on the map → city/address.
export async function reverseGeocode(latitude, longitude) {
  let city = '';
  let address = '';
  try {
    const places = await Location.reverseGeocodeAsync({ latitude, longitude });
    const p = places?.[0];
    if (p) {
      city = p.city || p.subregion || p.region || '';
      address = [p.name || p.street, p.district, p.city].filter(Boolean).join(', ');
    }
  } catch (e) { /* coords still usable */ }
  return { latitude, longitude, city, address };
}
