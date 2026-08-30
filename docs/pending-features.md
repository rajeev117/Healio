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

---

## Why these were left alone

The user has a separate plan for some/all of these and asked to document rather than
implement them in this pass. Treat this file as the backlog — update it as each item moves
from stub to real.
