// ─────────────────────────────────────────────────────────────────────────────
// Supabase credentials for helio-patient-mobile
// Uses the publishable (anon) key — safe in mobile apps; RLS enforces access.
// ─────────────────────────────────────────────────────────────────────────────
export const SUPABASE_URL = 'https://tzbncemosvmocuwjzezy.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_6hLwT31SHjdtG1mXR6IxAQ_Um4XGs7b';

// Dev login: test accounts are created with this password + an email derived
// from their phone. The OTP screen accepts ANY code and signs in with this.
export const DEV_PASSWORD = 'Healio-Dev-1234';
export const COUNTRY_CODE = '91';

// ─────────────────────────────────────────────────────────────────────────────
// Google Maps Platform key.
//
// Leave EMPTY to keep the zero-config behaviour: the map picker falls back to
// Leaflet + OpenStreetMap tiles and addresses come from expo-location's
// built-in geocoder. Both work in Expo Go with no key and no billing.
//
// Set it to switch the picker to Google Maps with Places autocomplete, and
// reverse-geocoding to Google's geocoder (noticeably better street-level
// addresses in India). Enable these three APIs on the key:
//   • Maps JavaScript API   — the map inside the picker's WebView
//   • Places API            — the "search a place" box
//   • Geocoding API         — coordinates → address
//
// The key ships inside the app bundle, so it is public by definition:
// restrict it in Google Cloud Console (HTTP referrer + API restrictions),
// never leave it unrestricted.
// ─────────────────────────────────────────────────────────────────────────────
export const GOOGLE_MAPS_API_KEY = '';

// The one test-OTP constant, defined in the app shell's env so both modules
// agree. See src/lib/env.js for why a stand-in code exists at all.
export { TEST_OTP } from '../../../lib/env';
