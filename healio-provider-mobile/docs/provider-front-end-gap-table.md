# Healio Provider Front-End Gap Table

## Current Screens

| Screen | Status | What it still lacks | Supabase data likely needed |
| --- | --- | --- | --- |
| Welcome | Built | No login state, no subscription awareness, no partner onboarding state | Auth/session, hospital profile summary |
| Login | Built | Fake OTP, no resend, no error states, no recovery | Auth, OTP/session |
| Signup | Built | Simulated upload/payment, no post-signup status page | Hospital profile, document storage, activation plan |
| Home | Built | Dashboard numbers are seeded, no drill-down pages by metric | Live summary metrics, appointments, revenue, alerts |
| Doctors | Built | No doctor detail route, schedule page, leave, or performance view | Doctor profiles, schedules, availability |
| Patients | Built | Dossier is read-only, no action workflow, no visit detail page | Patient records, history, visits, notes |
| Operations | Built | Status cycling is local-only, no order detail pages | Pharmacy, lab, home care orders |
| Profile | Built | Settings are simulated, no separate settings/support/subscription pages | Settings, preferences, support tickets |
| Earnings | Built | Local-only provider earnings actions, no ledger history route | Ledger, earnings, holds, transactions |

## Missing Frontend Routes Added

| Route | Purpose | Data source for now |
| --- | --- | --- |
| Appointments | Queue and consult management | Mock appointments |
| AppointmentDetail | Single appointment view | Mock appointments |
| DoctorDetail | Doctor profile summary | Zustand doctors list |
| DoctorSchedule | Weekly availability | Zustand schedules |
| PatientActions | Quick actions for visit workflow | Zustand patients list |
| PatientVisitDetail | Visit timeline and actions | Zustand patients list |
| Billing | Invoice and billing surface | Local mock invoices |
| Reports | Analytics dashboard | Local mock metrics |
| Notifications | Operational inbox | Local mock notifications |
| Support | Help desk and FAQ | Local mock FAQ |
| Settings | Hospital preferences | Local toggle placeholders |
| Ledger | Ledger/history view | Transaction list (earnings, commissions, payouts) |
| Subscription | Plan state and hold amount | Subscription / hold state |
| PharmacyOrderDetail | Pharmacy order workflow | Mock pharmacy orders |
| LabOrderDetail | Lab order workflow | Mock lab orders |
| HomeCareOrderDetail | Home care package workflow | Mock home care orders |

## Priority Order For Remaining Work

1. Connect Home, Doctors, Patients, and Operations buttons to these new routes.
2. Replace local Zustand placeholders with Supabase tables and Storage.
3. Add detail-specific actions for appointments, patients, and operations.
4. Add search/filter states across billing, reports, and ledger history.
