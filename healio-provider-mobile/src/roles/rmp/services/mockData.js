export const RMP = {
  id: 'rmp_001',
  name: 'Test RMP',
  designation: 'Healthcare Consultant',
  phone: '+91 90000 00001',
  village: 'Test Village',
  memberSince: 'Jan 2026',
  kycStatus: 'Verified',
};

export const COMMISSION = {
  thisMonth: 1240,
  growthPct: 12,
  bookings: 18,
  perBooking: 60,
  withdrawable: 980,
};

export const STATS = {
  patients: 24,
  bookings: 18,
  pending: 2,
};

export const LINKED_PATIENTS = [
  { id: 'pat_001', name: 'Test Patient 1', phone: '+91 90•• ••11', fullPhone: '+91 90000 00011', age: 32, gender: 'Female', language: 'English', status: 'Active' },
  { id: 'pat_002', name: 'Test Patient 2', phone: '+91 90•• ••22', fullPhone: '+91 90000 00022', age: 45, gender: 'Male', language: 'हिन्दी', status: 'Expired' },
  { id: 'pat_003', name: 'Test Patient 3', phone: '+91 90•• ••33', fullPhone: '+91 90000 00033', age: 28, gender: 'Female', language: 'English', status: 'Active' },
];

export const SPECIALTIES = ['General', 'Cardiology', 'Derma'];

export const PROVIDERS = [
  { id: 'prov_001', name: 'Dr Test 1', specialty: 'General Physician', category: 'General', rating: 4.8, distanceKm: 1.2, serviceCharge: 49 },
  { id: 'prov_002', name: 'Dr Test 2', specialty: 'General Physician', category: 'General', rating: 4.6, distanceKm: 2.0, serviceCharge: 49 },
  { id: 'prov_003', name: 'Dr Test 3', specialty: 'General Physician', category: 'General', rating: 4.7, distanceKm: 3.1, serviceCharge: 49 },
  { id: 'prov_004', name: 'Dr Test 4', specialty: 'Cardiologist', category: 'Cardiology', rating: 4.9, distanceKm: 4.5, serviceCharge: 99 },
  { id: 'prov_005', name: 'Dr Test 5', specialty: 'Dermatologist', category: 'Derma', rating: 4.5, distanceKm: 2.8, serviceCharge: 79 },
];

export const SLOT_DATES = [
  { id: 'd1', day: 'Mon', date: 9 },
  { id: 'd2', day: 'Tue', date: 10 },
  { id: 'd3', day: 'Wed', date: 11 },
  { id: 'd4', day: 'Thu', date: 12 },
  { id: 'd5', day: 'Fri', date: 13 },
];

export const SLOT_MONTH = 'June 2026';

export const SLOT_TIMES = {
  Morning: ['09:00', '09:30', '10:00', '10:30'],
  Afternoon: ['11:00', '11:45', '12:30', '02:00'],
  Evening: ['04:30', '05:00', '05:45'],
};

export const TODAYS_BOOKINGS = [
  { id: 'bkg_001', patientName: 'Test Patient 1', providerName: 'Dr Test 1', time: '11:00 AM', date: 'Today', status: 'Confirmed', serviceCharge: 49, payment: 'Cash', commission: 60, stage: 'doctor', services: ['lab'] },
  { id: 'bkg_002', patientName: 'Test Patient 2', providerName: 'Dr Test 2', time: '12:30 PM', date: 'Today', status: 'Pending', serviceCharge: 49, payment: 'UPI', commission: 60, services: [] },
  { id: 'bkg_003', patientName: 'Test Patient 3', providerName: 'Dr Test 3', time: '04:30 PM', date: 'Today', status: 'Confirmed', serviceCharge: 49, payment: 'Cash', commission: 60, stage: 'hospital', services: ['pharmacy'] },
];

export const PAST_BOOKINGS = [
  { id: 'bkg_004', patientName: 'Test Patient 1', providerName: 'Dr Test 4', time: '10:00 AM', date: '08 Jun 2026', status: 'Completed', serviceCharge: 99, payment: 'UPI', commission: 90, services: ['lab', 'pharmacy'] },
  { id: 'bkg_005', patientName: 'Test Patient 3', providerName: 'Dr Test 1', time: '05:00 PM', date: '05 Jun 2026', status: 'Completed', serviceCharge: 49, payment: 'Cash', commission: 60, services: ['pharmacy'] },
  { id: 'bkg_006', patientName: 'Test Patient 2', providerName: 'Dr Test 5', time: '09:30 AM', date: '02 Jun 2026', status: 'Cancelled', serviceCharge: 79, payment: 'UPI', commission: 0, services: [] },
];

// Ordered stages of a patient's visit. lab/pharmacy only appear when the booking uses them.
const STAGE_ORDER = ['booking', 'hospital', 'doctor', 'lab', 'pharmacy', 'complete'];

const STAGE_META = {
  booking: { title: 'Booking Confirmed', place: 'Healio', icon: 'checkmark-circle-outline' },
  hospital: { title: 'Hospital Check-in', place: 'City Care Hospital', icon: 'business-outline' },
  doctor: { title: 'Doctor Consultation', place: '', icon: 'medkit-outline' },
  lab: { title: 'Lab Tests', place: 'Healio Diagnostics', icon: 'flask-outline' },
  pharmacy: { title: 'Pharmacy', place: 'Partner Pharmacy', icon: 'medical-outline' },
  complete: { title: 'Visit Complete', place: '', icon: 'flag-outline' },
};

/**
 * Builds the step-by-step journey for a booking with a status on each step:
 * 'done' | 'current' | 'pending' | 'cancelled'.
 */
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
  if (booking.status === 'Completed') currentIdx = steps.length;        // every step done
  else if (booking.status === 'Pending') currentIdx = 0;                // awaiting confirmation
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

export const EARNINGS_HISTORY = [
  { id: 'ern_001', label: 'Booking · Test Patient 1', date: '08 Jun 2026', amount: 90, type: 'credit' },
  { id: 'ern_002', label: 'Booking · Test Patient 3', date: '05 Jun 2026', amount: 60, type: 'credit' },
  { id: 'ern_003', label: 'Withdrawal to UPI', date: '03 Jun 2026', amount: 500, type: 'debit' },
  { id: 'ern_004', label: 'Booking · Test Patient 2', date: '01 Jun 2026', amount: 60, type: 'credit' },
  { id: 'ern_005', label: 'Booking · Test Patient 1', date: '29 May 2026', amount: 60, type: 'credit' },
];

export const SERVICE_CATEGORIES = [
  { id: 'cat_doctors', emoji: '🏥', name: 'Doctors', description: 'Consult specialists & GPs', rating: '4.9 ⭐' },
  { id: 'cat_labs', emoji: '🧪', name: 'Labs', description: 'Book tests & get reports' },
  { id: 'cat_pharmacy', emoji: '💊', name: 'Pharmacy', description: 'Order medicines online' },
  { id: 'cat_hospitals', emoji: '🏨', name: 'Hospitals', description: 'Find & book hospital services' },
];

export const SERVICE_FILTERS = ['All', 'Doctors', 'Labs', 'Pharmacy', 'Hospitals', 'Home Care'];

export const LANGUAGES = ['English', 'हिन्दी', 'বাংলা'];
