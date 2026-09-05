// ─────────────────────────────────────────────────────────────────────────────
// Supabase credentials for healio-provider-mobile
// Uses the publishable (anon) key — safe in mobile apps; RLS enforces access.
// ─────────────────────────────────────────────────────────────────────────────
export const SUPABASE_URL = 'https://tzbncemosvmocuwjzezy.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_6hLwT31SHjdtG1mXR6IxAQ_Um4XGs7b';

export const COUNTRY_CODE = '91';
export const DEV_PASSWORD = 'Healio-Dev-1234';

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

// ─────────────────────────────────────────────────────────────────────────────
// TEST_OTP — the code every login flow accepts, for any registered number.
//
// This is a STAND-IN, not verification. Supabase phone auth is the real thing
// (signInWithOtp / verifyOtp), but this project has the Phone provider turned
// off — a phone sign-in returns "Phone logins are disabled" — and enabling it
// requires a paid SMS provider (Twilio, MessageBird, Vonage, TextLocal).
// Until one is funded, the app cannot verify a number at all.
//
// Two consequences worth knowing rather than rediscovering:
//   • Anyone who knows a REGISTERED number can log in as them. The number must
//     already exist (lookupPhoneAccount gates it), but the code proves nothing.
//   • auth.users has no phone, so every account is keyed by an email derived
//     from the number (see phoneToEmail in ./supabase). Those synthetic
//     addresses are not decoration — Supabase requires an identifier, and with
//     phone disabled, email is the only one it will accept. They disappear on
//     their own the day real phone auth is switched on.
//
// One constant so switching later is one edit, not a hunt through three
// languages of translated copy. The UI reads it via the {code} placeholder.
// ─────────────────────────────────────────────────────────────────────────────
export const TEST_OTP = '1111';
