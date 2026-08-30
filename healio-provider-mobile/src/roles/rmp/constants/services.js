// ─────────────────────────────────────────────────────────────────────────────
// The services an RMP books on a patient's behalf.
//
// Everything that varies between them — the tile copy and icon, which
// organisations.type to list, and where the flow goes after the patient
// consents — is declared once here and read by Services, LinkPatient,
// ConsentOTP, ManagePatient and FindFacility, so adding a service is one edit.
//
// Every service takes OTP consent from the patient, emergencies included; what
// differs is where consent leads — doctors go straight to the doctor picker,
// labs/pharmacies/hospitals pick a facility first, an emergency goes to the
// admission form.
// ─────────────────────────────────────────────────────────────────────────────

export const SERVICES = {
  doctor: {
    key: 'doctor',
    label: 'Doctors',
    icon: 'stethoscope',
    tint: '#E3F2FD',
    iconColor: '#1565c0',
    description: 'Consult specialists & GPs',
    action: 'Book Appointment',
    consentNote: 'booking a doctor consultation',
    // No facility step — consent leads straight to the doctor list.
    afterConsent: 'FindProvider',
  },
  lab: {
    key: 'lab',
    label: 'Labs',
    icon: 'test-tube',
    tint: '#F3E5F5',
    iconColor: '#7b2d8e',
    description: 'Book tests & get reports',
    action: 'Book Lab Tests',
    consentNote: 'booking lab tests',
    orgType: 'diagnostic',
    afterConsent: 'FindFacility',
    listTitle: 'Choose a Lab',
    searchPlaceholder: 'Search labs and hospitals',
    emptyText: 'No labs are listed yet.',
    bookingScreen: 'RmpLabBooking',
  },
  pharmacy: {
    key: 'pharmacy',
    label: 'Pharmacy',
    icon: 'pill',
    tint: '#E8F5E9',
    iconColor: '#1b7a3d',
    description: 'Order medicines on prescription',
    action: 'Order Medicines',
    consentNote: 'ordering medicines',
    orgType: 'pharmacy',
    afterConsent: 'FindFacility',
    listTitle: 'Choose a Pharmacy',
    searchPlaceholder: 'Search pharmacies and hospitals',
    emptyText: 'No pharmacies are listed yet.',
    bookingScreen: 'RmpPharmacyOrder',
  },
  hospital: {
    key: 'hospital',
    label: 'Hospitals',
    icon: 'hospital-building',
    tint: '#FFF3E0',
    iconColor: '#b45309',
    description: 'Book a visit at a hospital',
    action: 'Book Hospital Visit',
    consentNote: 'booking a hospital visit',
    orgType: 'hospital',
    afterConsent: 'FindFacility',
    listTitle: 'Choose a Hospital',
    searchPlaceholder: 'Search hospitals',
    emptyText: 'No hospitals are listed yet.',
    // A hospital visit is still a doctor appointment — the picker just opens
    // pre-filtered to that hospital's doctors.
    bookingScreen: 'FindProvider',
  },
  homecare: {
    key: 'homecare',
    label: 'Home Care',
    icon: 'home-heart',
    tint: '#E0F2F1',
    iconColor: '#0f766e',
    description: 'Nursing & attendant visits at home',
    action: 'Book Home Care',
    comingSoon: true,
  },
  emergency: {
    key: 'emergency',
    label: 'Emergency',
    icon: 'alarm-light',
    tint: '#FFEBEE',
    iconColor: '#dc2626',
    description: 'Alert a hospital — they respond in 5 minutes',
    action: 'Raise Emergency Admission',
    consentNote: 'raising an emergency admission',
    // Consent is taken here too — an admission is still done on the patient's
    // behalf, so it carries the same OTP proof as every other booking.
    afterConsent: 'EmergencyAdmission',
    urgent: true,
  },
};

export const SERVICE_LIST = [
  SERVICES.doctor,
  SERVICES.hospital,
  SERVICES.lab,
  SERVICES.pharmacy,
  SERVICES.homecare,
  SERVICES.emergency,
];

export const getService = (key) => SERVICES[key] || SERVICES.doctor;
