// ─────────────────────────────────────────────────────────────────────────────
// Reverse geocoding through the Google Geocoding API.
//
// expo-location's own reverseGeocodeAsync is free and keyless, but on Android
// it returns whatever the device's geocoder feels like — often just a city, or
// nothing at all outside metros. Google's returns a real street address, which
// matters when the result is a hospital's registered address on an invoice.
//
// This module is the OPTIONAL upgrade: callers use it only when a key is set,
// and fall straight back to expo-location whenever it is missing, rate-limited
// or offline. It must therefore never throw.
// ─────────────────────────────────────────────────────────────────────────────

const ENDPOINT = 'https://maps.googleapis.com/maps/api/geocode/json';

const componentOf = (result, type) =>
  (result?.address_components || []).find((c) => (c.types || []).includes(type))?.long_name || '';

/**
 * @returns {Promise<{city:string, area:string, address:string}|null>}
 *          null whenever Google can't answer — the caller then falls back.
 */
export async function googleReverseGeocode(latitude, longitude, apiKey) {
  if (!apiKey) return null;
  try {
    const url =
      `${ENDPOINT}?latlng=${latitude},${longitude}&key=${encodeURIComponent(apiKey)}`;
    // Google can hang; a stuck "detecting location…" spinner is worse than a
    // coarser address from the device geocoder.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    const json = await res.json();
    if (json.status !== 'OK' || !json.results?.length) return null;

    const best = json.results[0];
    const city =
      componentOf(best, 'locality') ||
      componentOf(best, 'administrative_area_level_3') ||
      componentOf(best, 'administrative_area_level_2') ||
      '';
    const area =
      componentOf(best, 'sublocality_level_1') ||
      componentOf(best, 'sublocality') ||
      componentOf(best, 'neighborhood') ||
      componentOf(best, 'route') ||
      '';
    return { city, area, address: best.formatted_address || '' };
  } catch (_) {
    return null;
  }
}
