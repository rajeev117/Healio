# Care Flow Architecture — Doctor → Lab/Pharmacy

This documents the **current, intentionally simplified** version of the doctor → lab/pharmacy
hand-off, and — just as importantly — what was deliberately left out so it isn't rediscovered
as a "bug" later.

## The flow, as built

1. Doctor consults the patient (`DoctorHome.js` → `PatientActions.js`).
2. Doctor uploads a prescription image/PDF (`uploadClinicalDocument`). **That's it — the
   doctor's job is done.** No flags, no typed lists, no routing buttons. The prescription
   upload is the only action the doctor takes.
3. Patient walks to the hospital's lab or pharmacy. Staff there tap **Scan** (QR button in
   `LabHome.js`/`PharmacyHome.js`'s header) and scan the patient's check-in QR.
4. `ScanPatient.js` resolves the QR (`resolveQrToken`), then — because the staff is a
   lab technician or pharmacy assistant — enters a **3-phase UI flow** instead of navigating
   away immediately:

   **Phase 1 — Date query**: Staff sees the patient's name (QR verified) and four date-range
   chips: *Today*, *Last 3 days*, *Last 7 days*, *Last 30 days*. They pick how far back to
   search and tap **Find Visits**.

   **Phase 2 — Visit list**: `fetchPatientVisitsForRange` (careFlow.js) returns all non-
   cancelled, non-suggested appointments for this patient at **this hospital** (`organisation_id`
   match — the "hospital ID will verify" check) within the chosen window. Staff taps the
   relevant visit row.

   **Phase 3 — Order creation**: Tapping a visit calls `createLabOrderFromVisit` /
   `createPharmacyOrderFromVisit`, which creates the real `lab_orders`/`pharmacy_orders` row
   **right now** and navigates straight to `LabOrderDetail`/`PharmacyOrderDetail`.

5. From here on, everything is unchanged — `reportLabResult`/`completePharmacyOrder`,
   the doctor/hospital/patient realtime notifications, follow-up suggestions, etc. all
   operate on this row exactly as they did before.

**The key property**: a lab/pharmacy's queue only ever contains patients who have actually
*arrived and been scanned* — never pre-set flags or guesses. Staff see work only when the
patient is physically in front of them.

## What was *not* built, on purpose

These were explicitly discussed and deferred — see the "new architecture" brainstorm in
session history if the reasoning needs revisiting.

### 1. Outside / independent pharmacy & lab walk-ins
A patient using a pharmacy or lab that is **not** affiliated with the hospital they saw the
doctor at gets **no automatic linking at all**. The scan-time lookup is hard-scoped to
`organisation_id = scanning staff's own org` — a flag from a different hospital is
invisible to an unrelated pharmacy, by design. An independent pharmacy/lab handles that
patient as a disconnected walk-in, in their own org's data, same as any pharmacy without a
connected hospital today.

Longer-term vision (not started): an open network where any hospital and any
pharmacy/lab can be connected, and a patient's flag is visible to whichever participating
pharmacy scans them, regardless of which hospital created it. That needs:
- The flag to be patient-owned rather than hospital-owned (it already mostly is — it lives
  on the appointment, not a hospital-scoped table — but the *lookup* is still org-scoped).
- A "claim" step so two different pharmacies can't both fulfill the same flag — first
  `UPDATE ... WHERE needs_pharmacy = true` wins, atomically (the current code already does
  this implicitly by clearing the flag right after creating the order, but it's not yet
  race-proof across two simultaneous scans at two different orgs — not a concern today
  since cross-org lookup doesn't exist yet, but worth revisiting if it's ever opened up).
- A decision on how much of the patient's record an unrelated pharmacy should be able to
  see (privacy scope), since today's RLS assumes staff only ever see patients tied to
  their own org's appointments.

### 2. Refill requests
Not built yet. Agreed approach when it is: the **patient** explicitly requests a refill of
an old prescription from inside the patient app (e.g. a "Request Refill" button on a past
prescription in `Prescriptions.js`) — this creates a fresh, trackable flag, the same way a
new prescription would, rather than pharmacy staff browsing a patient's history live during
a walk-in scan. Avoids dispensing something a doctor might want to review again before
it's repeated, and keeps an audit trail of who asked for what.

### 3. Multi-lab department routing
Some hospitals can register more than one named lab (e.g. "Pathology Lab", "Radiology Lab"
— see Operations.js's custom lab naming). When a scan resolves a `needs_lab` flag,
`resolveScannedPatientForLab` does **not** ask which department — it calls
`getHospitalLabs()` and auto-picks the first one returned. For a hospital with only one lab
this is invisible; for a hospital with several, every flagged patient lands on whichever
lab happens to be first, regardless of which one is actually appropriate.

If this turns out to matter in practice, the fix is a small picker (chips, not typed text)
on the scanning lab tech's side ("this patient needs X — is that your department?") shown
only when `getHospitalLabs()` returns more than one result — no architecture change needed.

## Files touched by this flow
- `healio-provider-mobile/src/lib/careFlow.js` — `fetchPatientVisitsForRange` (date-range
  query for a patient at the scanning org); `createLabOrderFromVisit` /
  `createPharmacyOrderFromVisit` (visit-tap → order creation + shaped return for direct
  navigation); `fetchLabOrderForDetail`/`fetchPharmacyOrderForDetail` (private helpers,
  shape the new order); `sendToLab`/`sendToPharmacy` (still used internally).
- `healio-provider-mobile/src/screens/PatientActions.js` — prescription upload only.
  The "Send Patient To" flag buttons have been removed.
- `healio-provider-mobile/src/screens/ScanPatient.js` — 3-phase UI: scan → date-range
  picker → visit list → create order → navigate to detail. Non-lab/pharmacy roles keep the
  original straight-to-dossier behaviour.
- `healio-provider-mobile/src/screens/LabHome.js` / `PharmacyHome.js` — Scan button in
  the header (entry point for lab/pharmacy staff to reach `ScanPatient`).
