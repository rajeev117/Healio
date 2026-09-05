// Location service — real GPS + reverse geocoding.
//
// expo-location alone works in Expo Go with no key. When GOOGLE_MAPS_API_KEY is
// set we ask Google's Geocoding API first, because a hospital's registered
// address ends up on invoices and the device geocoder frequently returns only a
// city. Google failing for any reason falls straight back to expo-location.
import * as Location from 'expo-location';
import { GOOGLE_MAPS_API_KEY } from './env';
import { googleReverseGeocode } from './googleGeocode';

// Shared resolver: Google when configured and answering, device geocoder
// otherwise. Never throws — coordinates alone are always a usable result.
async function describe(latitude, longitude) {
  const g = await googleReverseGeocode(latitude, longitude, GOOGLE_MAPS_API_KEY);
  if (g && (g.city || g.address)) {
    return { city: g.city, address: g.address };
  }
  try {
    const places = await Location.reverseGeocodeAsync({ latitude, longitude });
    const pl = places?.[0];
    if (pl) {
      return {
        city: pl.city || pl.subregion || pl.region || '',
        address: [pl.name || pl.street, pl.district, pl.city].filter(Boolean).join(', '),
      };
    }
  } catch (e) { /* coords still usable */ }
  return { city: '', address: '' };
}

export async function detectCurrentLocation() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Location permission denied. Enable it in Settings to detect your location.');
  }
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  const { latitude, longitude } = pos.coords;
  const { city, address } = await describe(latitude, longitude);
  return { latitude, longitude, city, address };
}

// Reverse-geocode a spot picked on the map → city/address.
export async function reverseGeocode(latitude, longitude) {
  const { city, address } = await describe(latitude, longitude);
  return { latitude, longitude, city, address };
}
