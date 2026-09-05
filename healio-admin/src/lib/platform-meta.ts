// ─────────────────────────────────────────────────────────────────────────────
// Shared, non-secret vocabulary for the admin panel.
//
// This lives outside actions.ts on purpose: that file is 'use server', so every
// export in it must be an async function. These are plain constants that both
// the server actions and the client components need, so they belong here.
// ─────────────────────────────────────────────────────────────────────────────

// ── Feature audiences ────────────────────────────────────────────────────────
// Who a feature switch actually affects. Before migration-060 the only axis was
// app = patient | provider | both, which lumped hospitals, solo doctors,
// standalone labs, standalone pharmacies and healthcare consultants into one
// meaningless bucket called "provider".
export const FEATURE_AUDIENCES = [
  'patient',
  'hospital',
  'individual_doctor',
  'independent_lab',
  'independent_pharmacy',
  'rmp',
  'platform',
] as const;

export type FeatureAudience = typeof FEATURE_AUDIENCES[number];

export const AUDIENCE_META: Record<FeatureAudience, {
  label: string;
  blurb: string;
  icon: string;          // lucide icon name, resolved in the UI
}> = {
  patient: {
    label: 'Patient App',
    blurb: 'What patients can see and book in the consumer app.',
    icon: 'Users',
  },
  hospital: {
    label: 'Hospitals & Clinics',
    blurb: 'Multi-staff organisations running OPD, labs and pharmacy in-house.',
    icon: 'Building2',
  },
  individual_doctor: {
    label: 'Independent Doctors',
    blurb: 'Solo practitioners with their own clinic, not attached to a hospital.',
    icon: 'Stethoscope',
  },
  independent_lab: {
    label: 'Independent Labs',
    blurb: 'Standalone diagnostic labs taking their own orders.',
    icon: 'FlaskConical',
  },
  independent_pharmacy: {
    label: 'Independent Pharmacies',
    blurb: 'Standalone pharmacies fulfilling their own prescriptions.',
    icon: 'Pill',
  },
  rmp: {
    label: 'Healthcare Consultants',
    blurb: 'Village-level consultants who refer and accompany patients.',
    icon: 'HeartHandshake',
  },
  platform: {
    label: 'Platform-wide',
    blurb: 'Rails every role sits on — payments, wallet, delivery.',
    icon: 'Layers',
  },
};

// The order the tables are rendered in: who the platform serves first, then
// the rails underneath everyone.
export const AUDIENCE_ORDER: FeatureAudience[] = [
  'patient',
  'hospital',
  'individual_doctor',
  'independent_lab',
  'independent_pharmacy',
  'rmp',
  'platform',
];

// ── Individual / standalone provider kinds ───────────────────────────────────
// A solo doctor, standalone lab and standalone pharmacy each become an
// `organisations` row on approval; the org type is what the mobile app's
// resolveRole() maps onto an independent_* role.
export const INDIVIDUAL_KINDS = {
  individual_doctor:    { orgType: 'clinic',     label: 'Independent Doctor',    plural: 'Independent Doctors' },
  independent_lab:      { orgType: 'diagnostic', label: 'Independent Lab',      plural: 'Independent Labs' },
  independent_pharmacy: { orgType: 'pharmacy',   label: 'Independent Pharmacy', plural: 'Independent Pharmacies' },
} as const;

export type IndividualKind = keyof typeof INDIVIDUAL_KINDS;

export const ORG_TYPE_TO_KIND: Record<string, IndividualKind> = {
  clinic:     'individual_doctor',
  diagnostic: 'independent_lab',
  pharmacy:   'independent_pharmacy',
};

// Master feature switch that turns a whole provider category off.
export const KIND_MASTER_FEATURE: Record<IndividualKind, string> = {
  individual_doctor:    'individual_doctors',
  independent_lab:      'independent_labs',
  independent_pharmacy: 'independent_pharmacies',
};

// ── Push audiences ───────────────────────────────────────────────────────────
// Maps an audience the admin picks onto the resolveRole() roles stored on each
// device_tokens row. `null` means every live token.
export const PUSH_AUDIENCES: Record<string, readonly string[] | null> = {
  'All Users': null,
  'Patients': ['patient'],
  'All Providers': [
    'hospital_admin', 'doctor', 'opd_assistant', 'pharmacy_assistant',
    'lab_technician', 'nurse', 'homecare_assistant',
    'independent_doctor', 'independent_lab', 'independent_pharmacy',
  ],
  'Hospitals': ['hospital_admin', 'doctor', 'opd_assistant', 'nurse'],
  'Individual Doctors': ['independent_doctor'],
  'Independent Labs': ['independent_lab', 'lab_technician'],
  'Independent Pharmacies': ['independent_pharmacy', 'pharmacy_assistant'],
  'Healthcare Consultants': ['rmp'],
};

export const PUSH_AUDIENCE_OPTIONS = Object.keys(PUSH_AUDIENCES);
