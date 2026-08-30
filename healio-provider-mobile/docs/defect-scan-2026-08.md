# Whole-app defect scan — August 2026

Automated scan of **all 328 `.js` files** under `src/` plus `App.js`, covering every
screen in every module: `doctor`, `independentDoctor`, `independentLab`,
`independentPharmacy`, `lab`, `pharmacy`, `patient`, `rmp`, the shared `screens/`
and `components/`.

Two AST-based passes (Babel, `babel-preset-expo`) plus pattern checks. Every finding
was verified by hand against the code before anything was changed — several turned
out to be scanner faults rather than code faults, and those are recorded below too.

---

## Result

| check | found | fixed | notes |
|---|---|---|---|
| Syntax / parse errors | **0** | — | all 328 files parse |
| `styles.X` used but never defined | **0** | — | |
| `t('key')` with no translation entry | **0** | — | 73 false positives, see below |
| Ionicons glyph that does not exist | **0** | — | |
| `navigate('X')` to an unregistered route | **0** | — | |
| Duplicate object keys | **1** | **1** | |
| `Math.max/min` spread with no fallback | **0** | — | |
| `JSON.parse` outside try/catch | **0** | — | |
| `useEffect` subscribing with no cleanup | **0** | — | |
| Double safe-area inset on a tab screen | **4** | **4** | 78 other sites reviewed, not defects |
| `behavior="padding"` on Android | **13** | **11** | 2 left in dead code |

---

## Fixed

### 1. Duplicate key silently overriding — `roles/patient/context/LanguageContext.js:50-51`

```js
medicine_desc: 'Order medicines & healthcare products',
medicine_desc: 'Order medicines & healthcare products',   // <- shadows the line above
```

Both values were identical and the key is referenced nowhere, so there was no visible
symptom — but the second declaration silently wins, and if the two had ever diverged
the first would have been dead. Removed the duplicate. The Bengali and Hindi blocks
each declare it once and were left alone.

### 2. Double bottom safe-area inset on four patient tab screens

`roles/patient/screens/` — `Appointments.js`, `OrderTracking.js`, `Profile.js`, `Services.js`

These render `<SafeAreaView style={...}>` with no `edges` prop, which applies **all four**
insets. But `PatientNavigator.js:153-154` already adds `insets.bottom` to the tab bar:

```js
height: 64 + insets.bottom,
paddingBottom: 6 + insets.bottom,
```

So the bottom inset was applied twice — a dead band above the tab bar on any device with
gesture navigation. Fixed by scoping each to `edges={['top']}`, the same resolution
applied to the provider modules in the previous rounds.

**Not** changed, despite matching the same pattern: `patient/screens/Prescriptions.js` and
`rmp/screens/Services.js`. The triage initially flagged both because it matched on
component *name*, and `Prescriptions` / `Services` are tab screens in *other* navigators.
Both are `Stack.Screen`s in their own module (`PatientNavigator.js:248`,
`RmpNavigator.js:90`), where all-edges is correct.

### 3. Keyboard avoidance stacking on Android — 11 files

`AndroidManifest.xml` sets `android:windowSoftInputMode="adjustResize"`, so Android
already shrinks the window when the keyboard opens. A `KeyboardAvoidingView` with
`behavior="padding"` compensates *again* on top of that, pushing content — typically the
submit button — off screen.

Changed to `behavior={Platform.OS === 'ios' ? 'padding' : undefined}` in:

```
components/OtpVerifyModal.js          roles/rmp/screens/LabBooking.js
roles/patient/screens/Chat.js         roles/rmp/screens/Login.js
roles/patient/screens/LabBooking.js   roles/rmp/screens/PharmacyOrder.js
roles/patient/screens/PayGateway.js   roles/rmp/screens/Signup.js
roles/patient/screens/PaymentAuthorize.js   screens/Signup.js
roles/patient/screens/PharmacyOrder.js
```

`Platform` was already imported in all 11 — verified before and after.

Two further sites were left: `roles/lab/screens/Login.js` and
`roles/pharmacy/screens/Login.js` are **dead code** (see below).

---

## Reviewed and deliberately not changed

### 78 remaining bare `<SafeAreaView>` sites

A missing `edges` prop is only a defect when something else already owns an inset.
Classified by what the screen actually is:

- **61 pushed stack screens** — no tab bar below them, so all-edges is correct.
- **10 screens that render a full-screen `Modal`** — all-edges is correct.
- **5 unregistered / helper components** — not reachable as screens.
- **2 in dead files.**

Changing these would introduce clipping, not remove it.

### 35 array-index React keys, 28 `TextInput` without a `KeyboardAvoidingView`, 21 hardcoded platform insets

Real code smells, but not defects as they stand: the index-keyed lists are static
(they don't reorder or delete), the flagged text inputs are search fields at the top of
their screen where the keyboard opens *below* them, and the hardcoded insets are
cosmetically slightly off rather than broken. Listed in the raw scan output for a future
pass; none were changed here because each needs per-site judgement and carries
regression risk in modules with no test coverage.

### Three dead files

Unreachable — registered in no navigator, and two `require()` an asset path that does
not exist (`src/roles/assets/logo.png`):

- `roles/lab/screens/Login.js`
- `roles/pharmacy/screens/Login.js`
- `roles/doctor/screens/DoctorQR.js`

They only bundle cleanly because nothing imports them. Recommend deletion; left in place
pending a decision.

---

## Scanner faults found during verification

Recorded because the raw output is misleading without them:

1. **73 phantom "missing translation key" errors**, all in the patient module. The patient
   module has its **own** string table at `roles/patient/context/LanguageContext.js`; the
   scanner was only reading `src/i18n/strings.js`. Corrected to read both.

2. **Two checks never ran.** The first version of the second pass declared
   `CallExpression` twice in the Babel visitor object, so the later declaration silently
   replaced the earlier one — the same duplicate-key bug the scanner exists to find.
   Merged into a single visitor; `Math.max` and `JSON.parse` checks then ran clean.

---

## Verification

- Full Android bundle succeeds: **1609 modules**, no errors.
- Both scanners re-run after the fixes: `dup-key` 1 → **0**, `kav-behavior` 13 → **2**
  (dead code only), `safearea-edges` 82 → **78** (all remaining reviewed above).
- Per-file line endings preserved — this repo is a CRLF/LF mix and several files flip
  when edited by shell tools. Verified against backups for every file touched.

## Not covered by this scan

Static analysis only. It cannot see runtime behaviour, so these remain open:

- Data-dependent crashes (an empty API response, a malformed date from the server).
- Anything requiring interaction: form submission paths, payment flows, camera permissions.
- Visual regressions at large system font scale.
- Screen-reader output — accessibility labels were added to the admin dashboard in a
  previous round but have never been heard back through TalkBack.
