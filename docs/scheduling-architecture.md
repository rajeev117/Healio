# Scheduling Architecture — doctor availability & slot locking

How a doctor's consulting hours are defined, how those hours become bookable slots,
and why a slot that is taken cannot be taken again. Also — deliberately — what this
does *not* try to solve.

## The problem it replaced

`doctor_schedules` existed since migration 013 but was **write-only**:

- `DoctorSchedule.js` loaded it with `.limit(1).maybeSingle()`, so a doctor could
  only ever have one continuous block — no morning + evening OPD, no lunch break.
- **Nothing on the booking side read it.** `BookAppointment.js` rendered a
  hardcoded `ALL_TIME_SLOTS` array; `DoctorDetail`, `HospitalDetail`,
  `ServiceDetail`, the reschedule modal, the RMP module and the hospital's
  suggest-time and walk-in modals each had their own different fixed list. A
  doctor's availability changed nothing about what a patient could book.
- The hospital-affiliated doctor's own `Schedule.js` was a hardcoded template
  with a comment claiming the backend had no availability table.
- Booking was a client-side count-then-insert with no lock, no unique
  constraint and no transaction — **two patients could hold the same slot** —
  and six other paths (RMP, walk-in, `hospital_assign_doctor`, follow-up,
  reschedule, suggest-time) skipped even that check.

## The shape now

```
doctor_schedules            doctor_schedule_exceptions
(named weekly sessions)     (leave days + blocked windows)
        │                            │
        └──────────┬─────────────────┘
                   ▼
        doctor_availability()          ← the ONE source of bookable slots
                   │
     ┌─────────────┼──────────────┬─────────────┬──────────────┐
     ▼             ▼              ▼             ▼              ▼
  patient      doctor's        hospital       RMP        follow-up /
  booking      Schedule        walk-in +    booking      suggest-time
  screens        tab           suggest
```

Everything above reads `src/lib/schedule.js`, which wraps the RPCs. No screen
generates its own times any more.

### 1. Sessions — `doctor_schedules`

One row per **named session**: `name`, `days TEXT[]`, `start_time`, `end_time`,
`slot_mins`, `capacity`, `is_active`. A doctor running 09:00–13:00 at 15 min and
17:00–20:00 at 20 min is two rows. `capacity` defaults to 1 (one patient per
slot); a token-based OPD raises it.

`updated_by` records who last changed it, because for a hospital-affiliated
doctor **both the doctor and the hospital may edit** — see RLS below.

### 2. Exceptions — `doctor_schedule_exceptions`

Overrides the weekly pattern for one date:

| row | meaning |
|---|---|
| `start_time`/`end_time` NULL | whole day off (leave) |
| `start_time`/`end_time` set | that window only is blocked |

Two partial unique indexes, because a plain `UNIQUE` treats NULLs as distinct
and "day off" could otherwise be inserted twice.

### 3. `doctor_availability(doctor, from, days)`

`SECURITY DEFINER`. Generates the grid from sessions, subtracts exceptions,
joins the live appointment count, and labels each slot:

`free` · `full` · `blocked` · `leave` · `past`

It is `SECURITY DEFINER` so a patient gets slot *states* without read access to
`doctor_schedule_exceptions.reason` — "mother's surgery" is not the patient's
business. That is also why migration 013's `"sched: public read"` policy was
dropped.

Each row carries `slot_at`, the resolved `TIMESTAMPTZ`. **Clients book with that
value, never with a locally re-parsed date+time string** — that is what removes
the timezone drift the old code had.

### 4. The double-booking guarantee — a trigger, not a convention

`trg_appointments_slot_guard` runs `BEFORE INSERT OR UPDATE` on `appointments`:

```
pg_advisory_xact_lock( hash(doctor, instant) )
  → count active appointments at that instant
  → compare against doctor_slot_capacity(doctor, instant)
  → RAISE 'SLOT_FULL'
```

**The check lives in the database, not in the RPC**, precisely because guarding
the RPC would leave the other six write paths open. It holds for a direct
insert, a walk-in, an RMP booking, a reschedule, admin service-role seeding —
anything. The advisory lock serialises concurrent transactions on the same
`(doctor, instant)` key, closing the count-then-insert race.

Occupying statuses are `scheduled`, `in_progress` and **`suggested`** — a time
the doctor has offered to one patient must not be sellable to another before
they answer. `completed` and `cancelled` release the slot.

### 5. The RPCs

| function | used for |
|---|---|
| `book_appointment_slot` | new bookings (patient, RMP, follow-up) |
| `move_appointment_slot` | reschedule, suggest-a-new-time |
| `hospital_assign_doctor` | walk-ins — no OPD-hours check, but still capacity-locked |
| `doctor_schedule_conflicts` | appointments stranded by a schedule change |

They exist for the *reason*, not the guarantee: they validate the schedule
window and raise named errors — `SLOT_FULL`, `OUTSIDE_SCHEDULE`, `SLOT_BLOCKED`,
`ON_LEAVE`, `SLOT_PAST`, `NOT_AUTHORISED`, `DOCTOR_NOT_FOUND` — which
`scheduleError()` in `lib/schedule.js` turns back into `e.code` for the UI.

### 6. Who may edit — `can_manage_doctor_schedule()`

True for (a) the doctor themselves, (b) the organisation's admin, (c) org staff
with role `admin` / `receptionist` / `opd_assistant`.

Migration 013 let **any** staff row in the org write any doctor's schedule — a
lab technician could rewrite a surgeon's hours. That is now closed.

An independent doctor is their own `clinic` org, so (a) and (b) are the same
person and the "managed by you and {hospital}" banner is suppressed.

### 7. Timezone

Slots are wall-clock (`'09:15'`); `appointments.scheduled_at` is an instant.
Resolving one against the other needs an agreed zone and the schema had none.
`platform_settings.timezone` (default `Asia/Kolkata`) is it, read through
`healio_tz()`. **One row, one place to change.**

## Conflicts — a schedule change never destroys a booking

If a doctor shrinks their hours or marks leave over an existing appointment, the
appointment is **kept and flagged**, never auto-cancelled. `doctor_schedule_conflicts()`
returns them; the editor warns at save time and both Schedule screens show an
amber "Outside schedule" badge. Rescheduling is a human decision.

## Colour semantics

Consistent across every surface, provider and patient:

| state | treatment |
|---|---|
| free | surface + border |
| **booked / full** | **red (`COLORS.error`)**, struck-through on the patient side, patient's name on the provider side |
| blocked | dashed border, muted |
| past | dimmed |
| conflict | amber badge |

Booked slots were previously brand-maroon on the provider side and a faded grey
on the patient side — the latter read as "the button is broken", not "someone
else has this time".

## Deliberately not built

### Recurring / seasonal schedules
One weekly pattern plus dated exceptions. No "every second Tuesday", no
term-time vs holiday patterns. If it is ever needed, the exceptions table is
the place to grow, not the sessions table.

### Per-slot overbooking rules
`capacity` is per session and uniform across it. A real OPD sometimes wants
"6 tokens for the first hour, 3 after" — that would need capacity per slot
range, which is a session split today.

### Room / equipment scheduling
Only the doctor's time is modelled. Two doctors can be booked into the same
notional room because rooms do not exist in the schema.

### Cross-organisation doctors
`staff.organisation_id` is a single FK — a doctor who consults at two hospitals
needs two staff rows today, and therefore two independent schedules that know
nothing about each other. They can be double-booked across the two. Fixing this
means a doctor identity above `staff`, which is a much larger change.

### Waitlists
A full slot is simply refused. No queue, no "notify me if it frees up".

### Lab / home-care / pharmacy slots
`LabBooking`, `HomeCareBooking` and the pharmacy flow keep their own fixed time
lists. They write `lab_orders.scheduled_time` / `homecare_orders.scheduled_time`
(free TEXT), not `appointments`, and have no per-provider availability model.
Out of scope here; they are unaffected by any of the above.

## Files

- `supabase/migration-058-doctor-schedule-v2.sql` — everything server-side.
- `healio-provider-mobile/src/lib/schedule.js` — the only client-side slot code:
  `fetchAvailability` / `bookSlot` / `moveSlot`, session + exception CRUD,
  `buildSlots` / `fmt12` / `getNextNDays`, and `scheduleError`.
- `src/screens/DoctorSchedule.js` — the editor (dual-mode: own schedule, or the
  hospital editing a doctor's). Root-stack registered, so every role reaches it.
- `src/components/TimeSelectModal.js` — replaces the free-text time inputs.
- `src/components/CalendarPicker.js` — moved up from `roles/patient/components/`
  so the editor can pick leave dates; the old path re-exports it.
- `src/roles/doctor/screens/Schedule.js`, `src/roles/independentDoctor/screens/Schedule.js`
  — the two doctor-facing views.
- Booking surfaces rewired: `roles/patient/{BookAppointment,DoctorDetail,HospitalDetail,Appointments}`,
  `roles/patient/services/ApiService.js`, `roles/rmp/{services/api,screens/SlotSelection,screens/ServiceCharge}`,
  `screens/Appointments.js`, `screens/PatientActions.js`, `lib/store.js`, `lib/careFlow.js`.
