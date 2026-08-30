// ── Live journey (real data from rmp_patient_journey RPC) ────────────────────
// The RMP follows the patient's presence: Booked → Arrived (scanned the
// hospital QR) → With the Doctor (checked in) → Visit Complete. Post-visit
// lab/pharmacy output is surfaced as documents, not timeline stages.
// Returns i18n keys (titleKey/placeKey); the screen resolves them via t() so
// the timeline localizes. Icons/status/time are plain data.
export function buildLiveJourney(data = {}) {
  const { status, arrivedAt, checkedInAt } = data;

  if (status === 'cancelled') {
    return [
      { key: 'booking',   titleKey: 'journey_booking_title',   placeKey: 'journey_booking_place',   icon: 'checkmark-circle-outline', status: 'done',      time: null },
      { key: 'cancelled', titleKey: 'journey_cancelled_title', placeKey: 'journey_cancelled_place', icon: 'close-circle-outline',     status: 'cancelled', time: null },
    ];
  }

  const completed = status === 'completed';
  const arrived   = !!arrivedAt;
  const checkedIn = !!checkedInAt || status === 'in_progress' || completed;

  const stages = [
    { key: 'booking',  titleKey: 'journey_booking_title',  placeKey: 'journey_booking_place',  icon: 'checkmark-circle-outline', done: true,      time: null },
    { key: 'arrived',  titleKey: 'journey_arrived_title',  placeKey: 'journey_arrived_place',  icon: 'business-outline',         done: arrived,   time: arrivedAt || null },
    { key: 'doctor',   titleKey: 'journey_doctor_title',   placeKey: 'journey_doctor_place',   icon: 'medkit-outline',           done: checkedIn, time: checkedInAt || null },
    { key: 'complete', titleKey: 'journey_complete_title', placeKey: 'journey_complete_place', icon: 'flag-outline',             done: completed, time: null },
  ];

  const currentIdx = stages.findIndex(s => !s.done);   // first not-yet-done stage
  return stages.map((s, i) => ({
    key: s.key,
    titleKey: s.titleKey,
    placeKey: s.placeKey,
    icon: s.icon,
    time: s.time,
    status: s.done ? 'done' : (i === currentIdx ? 'current' : 'pending'),
  }));
}

// Presentation for each document kind returned by the RPC. labelKey → t().
export const DOC_META = {
  prescription:  { labelKey: 'doc_prescription',  icon: 'document-text-outline' },
  lab_result:    { labelKey: 'doc_lab_report',    icon: 'flask-outline' },
  lab_bill:      { labelKey: 'doc_lab_bill',      icon: 'receipt-outline' },
  pharmacy_bill: { labelKey: 'doc_pharmacy_bill', icon: 'medical-outline' },
  scan:          { labelKey: 'doc_scan',          icon: 'image-outline' },
  discharge:     { labelKey: 'doc_discharge',     icon: 'clipboard-outline' },
};

export function docMeta(kind) {
  return DOC_META[kind] || { labelKey: 'doc_default', icon: 'document-outline' };
}

const STAGE_ORDER = ['booking', 'hospital', 'doctor', 'lab', 'pharmacy', 'complete'];

const STAGE_META = {
  booking:  { title: 'Booking Confirmed',     place: 'Healio',               icon: 'checkmark-circle-outline' },
  hospital: { title: 'Hospital Check-in',     place: 'City Care Hospital',   icon: 'business-outline' },
  doctor:   { title: 'Doctor Consultation',   place: '',                     icon: 'medkit-outline' },
  lab:      { title: 'Lab Tests',             place: 'Healio Diagnostics',   icon: 'flask-outline' },
  pharmacy: { title: 'Pharmacy',              place: 'Partner Pharmacy',     icon: 'medical-outline' },
  complete: { title: 'Visit Complete',        place: '',                     icon: 'flag-outline' },
};

export function getJourney(booking) {
  const services = booking.services || [];
  const steps = STAGE_ORDER.filter(k => {
    if (k === 'lab') return services.includes('lab');
    if (k === 'pharmacy') return services.includes('pharmacy');
    return true;
  });

  const buildStep = (key, status) => {
    const meta = STAGE_META[key];
    return {
      key,
      title: meta.title,
      place: key === 'doctor' ? (booking.providerName || 'Consulting room') : meta.place,
      icon: meta.icon,
      status,
    };
  };

  if (booking.status === 'Cancelled') {
    return [
      buildStep('booking', 'done'),
      { key: 'cancelled', title: 'Booking Cancelled', place: 'This booking was cancelled', icon: 'close-circle-outline', status: 'cancelled' },
    ];
  }

  let currentIdx;
  if (booking.status === 'Completed') currentIdx = steps.length;
  else if (booking.status === 'Pending') currentIdx = 0;
  else currentIdx = Math.max(steps.indexOf(booking.stage || 'doctor'), 1);

  const journey = steps.map((key, i) => {
    let status;
    if (i < currentIdx) status = 'done';
    else if (i === currentIdx) status = booking.status === 'Completed' ? 'done' : 'current';
    else status = 'pending';
    return buildStep(key, status);
  });

  if (booking.status === 'Pending') {
    journey[0] = { ...journey[0], title: 'Awaiting Confirmation', place: 'Pending provider confirmation' };
  }
  return journey;
}
