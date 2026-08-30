import type {
  Organisation, Patient, Provider, SubAdmin,
  FeatureFlag, Appointment, Order, Transaction, AuditLog, LiveActivity,
} from '@/types';

// ── Organisations ─────────────────────────────────────────────────────────────
export const organisations: Organisation[] = [
  {
    id: 'org1', hospitalCode: 'HOSP-2451', name: 'Healio City Hospital',
    type: 'hospital', city: 'Pune', country: 'IN',
    address: '14 Baner Road, Baner, Pune 411045',
    phone: '+91 90000 00001', email: 'admin@healiocityhospital.in',
    beds: '180', departments: ['General Medicine', 'Cardiology', 'Orthopaedics', 'Dermatology', 'Gynaecology'],
    status: 'active', subscription: 'enterprise',
    providerCount: 32, patientCount: 9800, mrr: 75000, joinedAt: '2025-01-15', logoUrl: '',
  },
  {
    id: 'org2', hospitalCode: 'CLIN-1183', name: 'LifeCare Clinic',
    type: 'clinic', city: 'Mumbai', country: 'IN',
    address: '52 Linking Road, Bandra West, Mumbai 400050',
    phone: '+91 90000 00010', email: 'info@lifecareclinic.in',
    beds: '24', departments: ['General Medicine', 'Paediatrics', 'ENT'],
    status: 'active', subscription: 'growth',
    providerCount: 10, patientCount: 2800, mrr: 24000, joinedAt: '2025-03-10', logoUrl: '',
  },
  {
    id: 'org3', hospitalCode: 'DIAG-7302', name: 'Healio Diagnostics',
    type: 'diagnostic', city: 'Pune', country: 'IN',
    address: '8 Aundh Road, Aundh, Pune 411007',
    phone: '+91 90000 00003', email: 'lab@healiodiagnostics.in',
    beds: '0', departments: ['Pathology', 'Radiology', 'Microbiology'],
    status: 'active', subscription: 'growth',
    providerCount: 4, patientCount: 1400, mrr: 18000, joinedAt: '2025-02-20', logoUrl: '',
  },
  {
    id: 'org4', hospitalCode: 'PHRM-5520', name: 'Healio Pharmacy',
    type: 'clinic', city: 'Pune', country: 'IN',
    address: '14 Baner Road, Baner, Pune 411045',
    phone: '+91 90000 00004', email: 'pharmacy@healiocityhospital.in',
    beds: '0', departments: ['Pharmacy'],
    status: 'active', subscription: 'growth',
    providerCount: 2, patientCount: 1100, mrr: 12000, joinedAt: '2025-02-20', logoUrl: '',
  },
  {
    id: 'org5', hospitalCode: 'HOSP-8890', name: 'Sunrise Hospital',
    type: 'hospital', city: 'Kolkata', country: 'IN',
    address: '22 Park Street, Kolkata 700016',
    phone: '+91 90000 00020', email: 'contact@sunrisehospital.in',
    beds: '140', departments: ['Cardiology', 'Neurology', 'General Medicine', 'Emergency'],
    status: 'trial', subscription: 'starter',
    providerCount: 18, patientCount: 4200, mrr: 0, joinedAt: '2026-04-01', logoUrl: '',
  },
  {
    id: 'org6', hospitalCode: 'DIAG-4401', name: 'QuickScan Labs',
    type: 'diagnostic', city: 'Delhi', country: 'IN',
    address: '9 Connaught Place, New Delhi 110001',
    phone: '+91 90000 00030', email: 'team@quickscanlabs.in',
    beds: '0', departments: ['Pathology', 'Imaging'],
    status: 'pending', subscription: 'starter',
    providerCount: 3, patientCount: 0, mrr: 0, joinedAt: '2026-06-01', logoUrl: '',
  },
];

// ── Patients ──────────────────────────────────────────────────────────────────
export const patients: Patient[] = [
  { id: 'patient-1', name: 'Rohan Mehta',   email: 'rohan@example.com',  phone: '+91 98765 43210', orgId: 'org1', orgName: 'Healio City Hospital', status: 'active',   walletBalance: 1500, appointmentCount: 10, joinedAt: '2025-02-10', lastActiveAt: '2026-06-24' },
  { id: 'patient-2', name: 'Sneha Patil',   email: 'sneha@example.com',  phone: '+91 87654 32109', orgId: 'org2', orgName: 'LifeCare Clinic',      status: 'active',   walletBalance: 400,  appointmentCount: 4,  joinedAt: '2025-04-15', lastActiveAt: '2026-06-22' },
  { id: 'patient-3', name: 'Amit Kumar',    email: 'amit@example.com',   phone: '+91 76543 21098', orgId: 'org1', orgName: 'Healio City Hospital', status: 'active',   walletBalance: 850,  appointmentCount: 14, joinedAt: '2025-01-20', lastActiveAt: '2026-06-23' },
  { id: 'patient-4', name: 'Priya Singh',   email: 'priya@example.com',  phone: '+91 65432 10987', orgId: 'org2', orgName: 'LifeCare Clinic',      status: 'banned',   walletBalance: 0,    appointmentCount: 1,  joinedAt: '2025-06-01', lastActiveAt: '2025-06-15' },
  { id: 'patient-5', name: 'Vikram Sharma', email: 'vikram@example.com', phone: '+91 91234 56789', orgId: 'org1', orgName: 'Healio City Hospital', status: 'active',   walletBalance: 2200, appointmentCount: 7,  joinedAt: '2025-03-10', lastActiveAt: '2026-06-24' },
  { id: 'patient-6', name: 'Kavya Reddy',   email: 'kavya@example.com',  phone: '+91 82345 67890', orgId: 'org3', orgName: 'Healio Diagnostics',  status: 'inactive', walletBalance: 50,   appointmentCount: 0,  joinedAt: '2026-05-10', lastActiveAt: '2026-05-10' },
];

// ── Providers (staff + RMPs) ──────────────────────────────────────────────────
export const providers: Provider[] = [
  { id: 'dr1', name: 'Dr. Ananya Joshi',  type: 'doctor',       specialty: 'General Physician',    orgId: 'org1', orgName: 'Healio City Hospital', status: 'active',               verifiedAt: '2025-01-16', rating: 4.9, joinedAt: '2025-01-16' },
  { id: 'dr2', name: 'Dr. Sameer Gupta',  type: 'doctor',       specialty: 'Cardiologist',          orgId: 'org1', orgName: 'Healio City Hospital', status: 'active',               verifiedAt: '2025-02-05', rating: 4.7, joinedAt: '2025-02-05' },
  { id: 'dr3', name: 'Dr. Pooja Nair',    type: 'doctor',       specialty: 'Dermatologist',         orgId: 'org2', orgName: 'LifeCare Clinic',      status: 'active',               verifiedAt: '2025-03-11', rating: 4.8, joinedAt: '2025-03-11' },
  { id: 'dr4', name: 'Dr. Rajesh Iyer',   type: 'doctor',       specialty: 'Orthopaedic Surgeon',   orgId: 'org1', orgName: 'Healio City Hospital', status: 'pending_verification', rating: 0,   joinedAt: '2026-06-10' },
  { id: 'lt1', name: 'Anand Verma',       type: 'lab',          specialty: 'Lab Technician',        orgId: 'org3', orgName: 'Healio Diagnostics',  status: 'active',               verifiedAt: '2025-02-21', rating: 4.6, joinedAt: '2025-02-21' },
  { id: 'ph1', name: 'Sunita Desai',      type: 'pharmacy',     specialty: 'Pharmacist',            orgId: 'org4', orgName: 'Healio Pharmacy',      status: 'active',               verifiedAt: '2025-02-21', rating: 4.5, joinedAt: '2025-02-21' },
  { id: 'rp1', name: 'Mahesh Yadav',      type: 'rmp' as any,   specialty: 'Healthcare Consultant',           orgId: '',     orgName: 'Independent (Wagholi)', status: 'active',              verifiedAt: '2025-04-01', rating: 4.3, joinedAt: '2025-04-01' },
  { id: 'rp2', name: 'Sunita Kale',       type: 'rmp' as any,   specialty: 'Healthcare Consultant',           orgId: '',     orgName: 'Independent (Kharadi)', status: 'active',              verifiedAt: '2025-05-12', rating: 4.1, joinedAt: '2025-05-12' },
];

// ── Sub-Admins ────────────────────────────────────────────────────────────────
export const subAdmins: SubAdmin[] = [
  { id: 'sa1', name: 'Tanvir Ahmed',      email: 'tanvir@healio.in',  role: 'support',  scope: 'platform', permissions: { users: { read: true, write: true, delete: false }, financial: { read: true, write: false, delete: false } }, status: 'active', createdAt: '2025-02-01', lastLoginAt: '2026-06-24' },
  { id: 'sa2', name: 'Riya Sen',          email: 'riya@healio.in',    role: 'finance',  scope: 'platform', permissions: { financial: { read: true, write: true, delete: false }, audit_logs: { read: true, write: false, delete: false } }, status: 'active', createdAt: '2025-04-10', lastLoginAt: '2026-06-23' },
  { id: 'sa3', name: 'Imran Chowdhury',   email: 'imran@healio.in',   role: 'regional', scope: 'org', orgIds: ['org1', 'org3', 'org4'], permissions: { users: { read: true, write: true, delete: false }, operations: { read: true, write: true, delete: false } }, status: 'active', createdAt: '2025-03-15', expiresAt: '2026-12-31', lastLoginAt: '2026-06-22' },
];

// ── Feature Flags ─────────────────────────────────────────────────────────────
export const featureFlags: FeatureFlag[] = [
  { id: 'ff1',  name: 'Book Appointment',       description: 'Allow patients to book appointments via the app',   app: 'patient',   category: 'Booking',       enabled: true,  rolloutPercent: 100, orgOverrides: [], userOverrides: [], updatedAt: '2026-04-01', updatedBy: 'Super Admin' },
  { id: 'ff2',  name: 'Video Consultation',     description: 'In-app video calls between patients and doctors',   app: 'both',      category: 'Booking',       enabled: false, rolloutPercent: 0,   orgOverrides: [{ orgId: 'org1', orgName: 'Healio City Hospital', enabled: true }], userOverrides: [], updatedAt: '2026-05-20', updatedBy: 'Tanvir Ahmed' },
  { id: 'ff3',  name: 'Wallet Top-up',          description: 'Allow patients to add money to their Healio wallet', app: 'patient',  category: 'Payments',      enabled: true,  rolloutPercent: 100, orgOverrides: [], userOverrides: [], updatedAt: '2026-04-15', updatedBy: 'Super Admin' },
  { id: 'ff4',  name: 'Card Payments',          description: 'Credit/Debit card payment method at checkout',      app: 'both',      category: 'Payments',      enabled: false, rolloutPercent: 0,   orgOverrides: [], userOverrides: [], updatedAt: '2026-05-10', updatedBy: 'Riya Sen' },
  { id: 'ff5',  name: 'Home Care Orders',       description: 'Book home visit nursing / doctor services',         app: 'patient',   category: 'Services',      enabled: true,  rolloutPercent: 70,  orgOverrides: [{ orgId: 'org5', orgName: 'Sunrise Hospital', enabled: false }], userOverrides: [], updatedAt: '2026-05-15', updatedBy: 'Super Admin' },
  { id: 'ff6',  name: 'Lab Orders',             description: 'Order diagnostic lab tests from the app',           app: 'patient',   category: 'Services',      enabled: true,  rolloutPercent: 100, orgOverrides: [], userOverrides: [], updatedAt: '2026-04-01', updatedBy: 'Super Admin' },
  { id: 'ff7',  name: 'Pharmacy Orders',        description: 'Order medicines from partner pharmacies',           app: 'patient',   category: 'Services',      enabled: true,  rolloutPercent: 100, orgOverrides: [], userOverrides: [], updatedAt: '2026-04-01', updatedBy: 'Super Admin' },
  { id: 'ff8',  name: 'Prescriptions',          description: 'Provider prescription creation and sharing',        app: 'provider',  category: 'Clinical',      enabled: true,  rolloutPercent: 100, orgOverrides: [], userOverrides: [], updatedAt: '2026-05-01', updatedBy: 'Super Admin' },
  { id: 'ff9',  name: 'Staff Management',       description: 'Hospital staff onboarding and role management',    app: 'provider',  category: 'Management',    enabled: true,  rolloutPercent: 100, orgOverrides: [{ orgId: 'org2', orgName: 'LifeCare Clinic', enabled: false }], userOverrides: [], updatedAt: '2026-05-18', updatedBy: 'Imran Chowdhury' },
  { id: 'ff10', name: 'Healio Plus',            description: 'Premium subscription paywall for patients',         app: 'patient',   category: 'Payments',      enabled: true,  rolloutPercent: 100, orgOverrides: [], userOverrides: [], updatedAt: '2026-04-20', updatedBy: 'Super Admin' },
  { id: 'ff11', name: 'Chat with Doctor',       description: 'In-app messaging between patient and provider',    app: 'both',      category: 'Communication', enabled: true,  rolloutPercent: 80,  orgOverrides: [], userOverrides: [], updatedAt: '2026-05-22', updatedBy: 'Super Admin' },
  { id: 'ff12', name: 'Healthcare Consultant Module', description: 'Enable healthcare consultant booking portal and partner incentive system',  app: 'provider',  category: 'Management',    enabled: true,  rolloutPercent: 100, orgOverrides: [], userOverrides: [], updatedAt: '2026-06-01', updatedBy: 'Super Admin' },
];

// ── Appointments ──────────────────────────────────────────────────────────────
export const appointments: Appointment[] = [
  { id: 'a1', patientName: 'Rohan Mehta',   providerName: 'Dr. Ananya Joshi', orgName: 'Healio City Hospital', type: 'clinic',   status: 'in_progress', scheduledAt: '2026-06-24T10:30:00', fee: 500 },
  { id: 'a2', patientName: 'Sneha Patil',   providerName: 'Dr. Pooja Nair',   orgName: 'LifeCare Clinic',      type: 'video',    status: 'scheduled',   scheduledAt: '2026-06-24T11:00:00', fee: 400 },
  { id: 'a3', patientName: 'Amit Kumar',    providerName: 'Dr. Sameer Gupta', orgName: 'Healio City Hospital', type: 'clinic',   status: 'scheduled',   scheduledAt: '2026-06-24T11:30:00', fee: 700 },
  { id: 'a4', patientName: 'Vikram Sharma', providerName: 'Dr. Ananya Joshi', orgName: 'Healio City Hospital', type: 'homecare', status: 'completed',   scheduledAt: '2026-06-24T09:00:00', fee: 800 },
  { id: 'a5', patientName: 'Kavya Reddy',   providerName: 'Dr. Rajesh Iyer',  orgName: 'Healio City Hospital', type: 'clinic',   status: 'cancelled',   scheduledAt: '2026-06-24T08:30:00', fee: 600 },
  { id: 'a6', patientName: 'Rohan Mehta',   providerName: 'Dr. Ananya Joshi', orgName: 'Healio City Hospital', type: 'clinic',   status: 'scheduled',   scheduledAt: '2026-06-24T14:00:00', fee: 500, rmpName: 'Mahesh Yadav' } as any,
];

// ── Orders ────────────────────────────────────────────────────────────────────
export const orders: Order[] = [
  { id: 'o1', orderId: '#PH-20482', patientName: 'Rohan Mehta',   orgName: 'Healio Pharmacy',     type: 'pharmacy', status: 'out_for_delivery', total: 185,  createdAt: '2026-06-24T09:15:00' },
  { id: 'o2', orderId: '#LB-10234', patientName: 'Sneha Patil',   orgName: 'Healio Diagnostics',  type: 'lab',      status: 'processing',       total: 980,  createdAt: '2026-06-24T08:00:00' },
  { id: 'o3', orderId: '#HC-50123', patientName: 'Amit Kumar',    orgName: 'Healio City Hospital', type: 'homecare', status: 'confirmed',        total: 750,  createdAt: '2026-06-24T07:30:00' },
  { id: 'o4', orderId: '#PH-20483', patientName: 'Vikram Sharma', orgName: 'Healio Pharmacy',     type: 'pharmacy', status: 'pending',          total: 320,  createdAt: '2026-06-24T10:45:00' },
  { id: 'o5', orderId: '#LB-10235', patientName: 'Priya Singh',   orgName: 'Healio Diagnostics',  type: 'lab',      status: 'completed',        total: 560,  createdAt: '2026-06-23T14:00:00' },
];

// ── Transactions ──────────────────────────────────────────────────────────────
export const transactions: Transaction[] = [
  { id: 't1', type: 'topup',        userName: 'Rohan Mehta',   patientId: 'patient-1', orgName: 'Healio City Hospital', amount: 2000, status: 'completed', method: 'upi',    createdAt: '2026-06-24T10:00:00' },
  { id: 't2', type: 'payment',      userName: 'Sneha Patil',   patientId: 'patient-2', orgName: 'LifeCare Clinic',      amount: 400,  status: 'completed', method: 'wallet', createdAt: '2026-06-24T09:45:00' },
  { id: 't3', type: 'refund',       userName: 'Priya Singh',   patientId: 'patient-4', orgName: 'LifeCare Clinic',      amount: 500,  status: 'pending',   method: 'wallet', createdAt: '2026-06-24T08:30:00' },
  { id: 't4', type: 'subscription', userName: 'Amit Kumar',    patientId: 'patient-3', orgName: 'Healio City Hospital', amount: 499,  status: 'completed', method: 'card',   createdAt: '2026-06-23T18:00:00' },
  { id: 't5', type: 'topup',        userName: 'Vikram Sharma', patientId: 'patient-5', orgName: 'Healio City Hospital', amount: 1000, status: 'failed',    method: 'card',   createdAt: '2026-06-23T17:30:00' },
  { id: 't6', type: 'payment',      userName: 'Mahesh Yadav',  patientId: '',          orgName: 'Partner Incentive', amount: 60,   status: 'completed', method: 'wallet', createdAt: '2026-06-24T11:00:00' },
];

// ── Audit Logs ────────────────────────────────────────────────────────────────
export const auditLogs: AuditLog[] = [
  { id: 'al1', adminName: 'Super Admin',    adminRole: 'super_admin', action: 'Enabled Healthcare Consultant Module flag',  module: 'Feature Flags',  target: 'Healthcare Consultant Module',          ip: '192.168.1.1',  createdAt: '2026-06-24T09:00:00' },
  { id: 'al2', adminName: 'Tanvir Ahmed',   adminRole: 'support',     action: 'Banned user',                      module: 'Users',          target: 'Priya Singh (patient-4)',      orgName: 'LifeCare Clinic',      ip: '192.168.1.45', createdAt: '2026-06-23T15:30:00' },
  { id: 'al3', adminName: 'Riya Sen',       adminRole: 'finance',     action: 'Approved refund',                  module: 'Financial',      target: 'TXN #t3 — ₹500',              orgName: 'LifeCare Clinic',      ip: '192.168.1.22', createdAt: '2026-06-23T14:00:00' },
  { id: 'al4', adminName: 'Imran Chowdhury',adminRole: 'regional',    action: 'Updated org config',               module: 'Organisations',  target: 'Healio City Hospital',         orgName: 'Healio City Hospital', ip: '192.168.1.88', createdAt: '2026-06-22T11:00:00' },
  { id: 'al5', adminName: 'Super Admin',    adminRole: 'super_admin', action: 'Approved onboarding application',  module: 'Onboarding',     target: 'Sunrise Hospital (org5)',       ip: '192.168.1.1',  createdAt: '2026-06-21T09:00:00' },
  { id: 'al6', adminName: 'Super Admin',    adminRole: 'super_admin', action: 'Created sub-admin',                module: 'Sub-Admins',     target: 'Imran Chowdhury',             ip: '192.168.1.1',  createdAt: '2026-05-15T09:00:00' },
];

// ── Live Activity ─────────────────────────────────────────────────────────────
export const liveActivities: LiveActivity[] = [
  { id: 'la1', type: 'appointment', message: 'Appointment booked — Rohan M. → Dr. Ananya (via Consultant Mahesh)',   orgName: 'Healio City Hospital', timestamp: new Date(Date.now() - 12000) },
  { id: 'la2', type: 'wallet',      message: 'Wallet top-up ₹2,000 via UPI — Rohan Mehta',                   orgName: 'Healio City Hospital', timestamp: new Date(Date.now() - 34000) },
  { id: 'la3', type: 'order',       message: 'Lab order #LB-10234 placed — Sneha Patil',                      orgName: 'Healio Diagnostics',   timestamp: new Date(Date.now() - 58000) },
  { id: 'la4', type: 'signup',      message: 'New healthcare consultant registered — Mahesh Yadav (Wagholi)', orgName: 'Consultant Network',   timestamp: new Date(Date.now() - 90000) },
  { id: 'la5', type: 'alert',       message: 'SLA breach — homecare order #HC-50123 overdue',                 orgName: 'Healio City Hospital', timestamp: new Date(Date.now() - 120000) },
  { id: 'la6', type: 'appointment', message: 'Video consult started — Sneha P. → Dr. Pooja Nair',            orgName: 'LifeCare Clinic',      timestamp: new Date(Date.now() - 180000) },
  { id: 'la7', type: 'wallet',      message: 'Partner incentive ₹60 credited — Mahesh Yadav', orgName: 'Consultant Network',   timestamp: new Date(Date.now() - 240000) },
];

// ── Dashboard stats ───────────────────────────────────────────────────────────
export const revenueData = [
  { date: 'Jun 18', revenue: 52400,  appointments: 158, orders: 94  },
  { date: 'Jun 19', revenue: 58100,  appointments: 171, orders: 108 },
  { date: 'Jun 20', revenue: 61800,  appointments: 185, orders: 119 },
  { date: 'Jun 21', revenue: 74200,  appointments: 218, orders: 134 },
  { date: 'Jun 22', revenue: 68900,  appointments: 202, orders: 121 },
  { date: 'Jun 23', revenue: 82500,  appointments: 241, orders: 152 },
  { date: 'Jun 24', revenue: 97600,  appointments: 284, orders: 178 },
];
