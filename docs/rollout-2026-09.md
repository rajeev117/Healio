# Rollout checklist — September 2026 change set

Everything in this pass is code-complete, but four pieces need a human: SQL migrations,
a package install, an EAS project id, and a Google Maps key. Until those are done the
new features degrade quietly rather than breaking anything.

---

## 1. Run the migrations, in order

Supabase SQL Editor, one at a time. Each is idempotent (`IF NOT EXISTS` / `ON CONFLICT`).

| # | File | What it does |
|---|---|---|
| 059 | `supabase/migration-059-device-tokens.sql` | `device_tokens` table + `push_notifications.failed` / `.send_error`. Real device push has nowhere to go without it. |
| 060 | `supabase/migration-060-feature-audience.sql` | `features.audience` + `.sort_order`, master switches for independent labs / pharmacies / consultants, and a `push_notifications` feature. Drives the new Features screen. |
| 061 | `supabase/migration-061-provider-gating.sql` | `suspended_at` / `suspended_reason` on `organisations`, `staff`, `rmps`. Bookkeeping for the off switch. |
| 062 | `supabase/migration-062-onboarding-coordinates.sql` | `onboarding_queue.latitude` / `.longitude`, so a provider's map pin survives approval. |

**Nothing hard-fails if you skip one.** Every new code path catches the missing-column
error (Postgres `42703`) and falls back:

- No 059 → push sends record the broadcast and report 0 delivered.
- No 060 → every feature shows under "Platform-wide" rather than under a role.
- No 061 → suspend still writes `status`, just without the timestamp/reason.
- No 062 → signup submits without coordinates instead of failing.

---

## 2. Install the new mobile packages

```bash
cd healio-provider-mobile && npx expo install expo-notifications expo-device expo-constants
```

They are already in `package.json` pinned to SDK 56 (`~56.0.25`, `~56.0.4`, `~56.0.25`);
`npx expo install` is the right command because it reconciles them against the installed
Expo SDK rather than taking the range literally.

---

## 3. Link an EAS project (required for real push)

```bash
cd healio-provider-mobile && npx eas init
```

This writes `extra.eas.projectId` into `app.json`, which is what
`Notifications.getExpoPushTokenAsync()` needs. Until then `src/lib/push.js` skips
registration and says why — it never throws.

**Expo Go will not work for push on Android.** Remote notifications were removed from
Expo Go on Android in SDK 53, so tokens only register from a development or production
build:

```bash
npx eas build --profile development --platform android
```

iOS additionally needs an APNs key on the Expo account; Android needs the FCM server
credentials uploaded via `eas credentials`.

Once devices register, the admin panel's **Config → Push Notifications** screen shows a
live "will reach N devices" count per audience before you send.

---

## 4. Add a Google Maps key (optional)

Set `GOOGLE_MAPS_API_KEY` in **both**:

- `healio-provider-mobile/src/lib/env.js`
- `healio-provider-mobile/src/roles/patient/services/env.js`

Enable three APIs on the key: **Maps JavaScript API**, **Places API**, **Geocoding API**.

Leaving it empty is a supported state, not a broken one — the map picker falls back to
Leaflet + OpenStreetMap and addresses come from `expo-location`'s device geocoder, both
of which need no key and no billing. Setting it swaps in Google tiles, a Places search
box, and Google's geocoder.

The key ships inside the app bundle and is therefore public. Restrict it in Google Cloud
Console (application + API restrictions) before going live.

---

## 5. Wipe the data when you are ready

**Admin panel → Settings → Danger Zone → Wipe all data.**

Shows a row-by-row preview of what will be destroyed, requires typing
`WIPE ALL DATA`, and reports what it deleted.

- **Kept:** sub-admins and their logins, feature switches, platform settings, pricing
  rules, banners, lab test catalogue, SLA rules, audit logs.
- **Deleted:** every organisation, staff member, patient, healthcare consultant,
  appointment, order, prescription, clinical record, transaction, wallet, dispute and
  onboarding application — plus every Supabase Auth user that is not a sub-admin.

Irreversible. Take a Supabase backup first. This is separate from Dev Tools →
"Clean up test data", which only removes rows flagged `is_test = true`.

---

## Verification pass, once the above is done

1. **Suspension actually bites** — turn an individual doctor off in
   *Users → Individual Providers*, then try to log into the provider app as them.
   Expect "This account has been suspended by Healio." at the OTP step, and the account
   signed straight back out. They should also vanish from patient search.
2. **Documents render** — open a pending application in *Onboarding Queue*. Each uploaded
   file should be a clickable link (signed URL, one hour). Approve it, then open the org
   and check *Overview → Verification Documents* carries the same files across.
3. **Push lands on a device** — from a dev build, log in (this registers the token), then
   send from *Config → Push Notifications*. The compose panel should show a non-zero
   reach, and the history row should report delivered > 0.
4. **Features read as roles** — *Features* should render one table per role with master
   switches flagged at the top of their section.
