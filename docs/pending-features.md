# Pending Features — Honest Stubs

These are screens/flows that are **intentionally incomplete** right now — either clearly
labeled as "Coming soon" in the UI, or simulated with no real backend. They were left out
of the latest bug-fix pass on purpose: the user has a separate plan for these and didn't
want them touched yet. This doc is the single place tracking what's stubbed, why, and what
real implementation would need.

---

## 1. Video Consultation (both apps)

- **Files**: `healio-provider-mobile/src/roles/patient/screens/VideoConsultation.js`, `healio-provider-mobile/src/screens/VideoConsultation.js`
- **Current state**: Both show an honest "Coming soon" placeholder. No calling backend at all.
- **What real implementation needs**:
  - A WebRTC provider (e.g. Twilio Video, Agora, Daily.co, or self-hosted WebRTC + signaling server) — this is a vendor/build decision, not just code.
  - A signaling mechanism (Supabase Realtime channel could carry call-setup signaling; media itself needs a TURN/SFU service).
  - Call state on the `appointments` row (e.g. `call_status`, `call_started_at`) so both sides see the same state.
  - Push/in-app notification when the other party joins.

## 2. Provider Chat

- **File**: `healio-provider-mobile/src/screens/Chat.js`
- **Current state**: Honest "Coming soon" placeholder. No messaging backend.
- **What real implementation needs**:
  - A `messages` table (conversation_id, sender_id, sender_role, body, created_at, read_at) + RLS scoped to the two participants.
  - Supabase Realtime subscription per conversation for live delivery.
  - Conversation list query (distinct patient threads per doctor/org).

## 3. Patient Chat — ⚠️ needs at least a disclaimer now

- **File**: `healio-provider-mobile/src/roles/patient/screens/Chat.js`
- **Current state**: **Not labeled as a stub.** Shows fully hardcoded fake conversations
  (`CONVERSATIONS`, `INITIAL_MESSAGES` consts) as if they're real, with no backend at all.
  Unlike the provider side, there's no "Coming soon" notice — a patient could believe
  they're actually messaging their doctor.
- **Recommendation**: at minimum, add the same honest "Coming soon" treatment the provider
  side uses until real messaging (see #2) is built, so patients aren't misled.
- **What real implementation needs**: same `messages` table/Realtime design as #2, shared
  between both apps.

## 4. Payments — no real gateway anywhere

- **Files**:
  - `healio-provider-mobile/src/roles/patient/screens/PaymentCheckout.js` (appointment fee checkout)
  - `healio-provider-mobile/src/roles/patient/screens/HealioPlusPayment.js` (wallet top-up)
- **Current state**: Both simulate success via `setTimeout(...)` — UPI/Card/NetBanking are
  selectable options in the UI but none are wired to a real gateway. Wallet-balance payment
  is "real" only in the sense that it deducts from the app's own `wallet`/`transactions`
  tables (`WalletContext`) — no actual money moves for any method.
- **What real implementation needs**:
  - A payment gateway integration (Razorpay, Cashfree, Stripe, etc. — needs a merchant
    account and is a product/business decision, not just code).
  - Server-side order creation + webhook verification (cannot trust client-reported
    "payment successful" — needs a signed webhook or server-side verification call).
  - Reconciliation: `transactions` table already exists and is real (patient app); it just
    needs entries to be created from verified gateway events instead of optimistic
    client-side success.

## 5. ServiceDetail booking (Ambulance / Insurance)

- **File**: `healio-provider-mobile/src/roles/patient/screens/ServiceDetail.js`
- **Current state**: now an **honest stub** — "Not bookable in the app yet".
- **Why it changed**: `Services.js` routes Doctors / Hospitals / Labs / Medicine /
  Home Care to their own screens, so everything reaching `ServiceDetail` (Ambulance,
  Insurance, …) has no doctor behind it. The old handler still called
  `addAppointment` with `item.id` as the doctor — not a `staff` row, so the insert
  could only ever fail the `appointments.doctor_staff_id` foreign key. The UI
  announced "Booking Confirmed" regardless.
- **What real implementation needs**: these services need their own booking model
  (an ambulance dispatch has a pickup location and no slot; insurance is a lead,
  not a visit). They should not be squeezed into `appointments`.

## 6. Phone OTP is not verification — ⚠️ security, not just a stub

- **Files**: `healio-provider-mobile/src/screens/Login.js`, `src/roles/rmp/screens/Login.js`,
  `src/roles/patient/screens/OTPVerify.js`, `src/components/OtpVerifyModal.js`,
  `src/lib/supabase.js` (`signInWithPhone`), `src/roles/patient/services/supabase.js`
  (`devSignIn` / `signUpOrIn`), `src/lib/env.js` + `src/roles/patient/services/env.js`
  (`DEV_PASSWORD`).
- **Current state**: every login screen compares the typed code against the literal
  `'1111'` client-side, then signs in with `DEV_PASSWORD` (`Healio-Dev-1234`) against an
  email derived from the phone number (`91<digits>@healio.app`). Both values are committed
  to this repo.
- **Why this is different from the other entries here**: the others are missing features.
  This one is an open door. Anyone who knows a registered phone number can log in as that
  person — into their prescriptions, clinical records and wallet — and the shared password
  means the OTP screen can be bypassed entirely by calling `signInWithPassword` directly.
  Acceptable while the platform holds only test data; not acceptable once it holds a real
  patient's records.
- **What real implementation needs**:
  - Supabase phone auth: `supabase.auth.signInWithOtp({ phone })` +
    `verifyOtp({ phone, token, type: 'sms' })`. The code is then generated and checked by
    Supabase, never by the app, and `DEV_PASSWORD` disappears entirely.
  - An SMS provider configured in **Dashboard → Authentication → Sign In / Providers →
    Phone**. This is a dashboard setting, not app code — Supabase supports Twilio, Twilio
    Verify, MessageBird, Vonage and TextLocal, and a "Send SMS" auth hook for anything else
    (e.g. MSG91).
  - **India**: A2P SMS to Indian numbers requires DLT registration (sender ID + template
    registered with an operator). Twilio international traffic into India without DLT is
    unreliable. TextLocal is the India-native option Supabase supports directly.
  - A migration for `claim_account()` (migration-008): it matches on
    `auth.jwt() ->> 'email'`, which is **null** under phone auth, so staff and hospital
    admins would never link to their pre-created rows. It needs to match on phone too.
  - `ensureAuthUser()` in `healio-admin/src/lib/actions.ts` (Dev Tools seeding) creates
    email+password users; it would need to create phone-verified ones.
- **Blocked on a paid SMS provider (verified 2026-09-05)**: a phone sign-in against
  this project returns `Phone logins are disabled (422)`, so the Phone provider is off
  in the Supabase dashboard. Turning it on requires an SMS provider, and every option
  Supabase supports natively (Twilio, MessageBird, Vonage, TextLocal) is paid. Twilio's
  trial gives free credit and can only send to numbers verified in its console, which is
  enough for a small test circle, but needs a card. Fixed "test phone numbers" are
  documented for SELF-HOSTED Supabase only — check the hosted dashboard before relying
  on them.
- **Consequence — the synthetic emails are not a style choice**: with phone auth
  unavailable, Supabase needs *some* identifier, and email is the only one it will
  accept. That is why every account is keyed `91<digits>@healio.app`. Deleting
  `phoneToEmail` before phone auth is enabled breaks every login in both apps. Those
  addresses disappear on their own the day the Phone provider is switched on.
- **The stand-in code now lives in one place**: `TEST_OTP` in
  `healio-provider-mobile/src/lib/env.js`. All four login flows and every translated
  string read it (via the `{code}` placeholder), so changing or removing it is one edit
  rather than a hunt through three languages.
- **Testing without an SMS bill**: GoTrue supports `SMS_TEST_OTP`, mapping specific numbers
  to fixed codes with no delivery. Confirmed for self-hosted; check whether the hosted
  dashboard exposes the same setting before relying on it. A Twilio trial account also
  works, since it can only send to numbers you have verified in its console.

---

---

## Why these were left alone

The user has a separate plan for some/all of these and asked to document rather than
implement them in this pass. Treat this file as the backlog — update it as each item moves
from stub to real.
