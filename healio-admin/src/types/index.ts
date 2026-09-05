// ── Tenants ──────────────────────────────────────────────────────────────────
export interface Organisation {
  id: string;
  hospitalCode?: string;
  name: string;
  type: 'hospital' | 'clinic' | 'diagnostic' | 'pharmacy';
  city: string;
  country: string;
  address?: string;
  phone?: string;
  email?: string;
  status: 'active' | 'suspended' | 'trial' | 'pending';
  subscription: 'starter' | 'growth' | 'enterprise';
  providerCount: number;
  patientCount: number;
  mrr: number;
  joinedAt: string;
  beds?: string;
  departments?: string[];
  logoUrl?: string;
}

// ── Users ─────────────────────────────────────────────────────────────────────
export interface Patient {
  id: string;
  name: string;
  email: string;
  phone: string;
  orgId: string;
  orgName: string;
  status: 'active' | 'banned' | 'inactive';
  walletBalance: number;
  appointmentCount: number;
  joinedAt: string;
  lastActiveAt: string;
}

// A member of staff inside an organisation. Note this is NOT the same thing as
// an "independent provider" — those are organisations in their own right (org
// type clinic / diagnostic / pharmacy), listed on the Independent Providers
// page and detailed under /organisations.
export type StaffRole =
  | 'doctor' | 'opd_assistant' | 'pharmacy_assistant'
  | 'nurse' | 'receptionist' | 'lab_technician' | 'admin';

export interface Provider {
  id: string;
  name: string;
  /** Coarse bucket kept for existing callers. Prefer `role`. */
  type: 'doctor' | 'hospital' | 'lab' | 'pharmacy';
  /** The actual staff_role from the database. */
  role: StaffRole;
  staffId?: string;
  specialty?: string;
  phone?: string;
  email?: string;
  department?: string;
  shift?: string;
  photoUrl?: string;
  orgId: string;
  orgName: string;
  orgType?: string;
  orgStatus?: string;
  /** Has this person ever logged in (staff.user_id is set)? */
  linked: boolean;
  status: 'active' | 'suspended' | 'pending_verification';
  verifiedAt?: string;
  rating: number;
  joinedAt: string;
}

// RMP / village health worker (independent, no organisation). Stored in the
// `rmps` table; books appointments on behalf of patients and earns commission.
export interface Rmp {
  id: string;
  name: string;
  phone: string;
  village?: string;
  address?: string;
  email?: string;
  regNo?: string;
  status: 'active' | 'suspended';
  joinedAt: string;
  patientCount: number;
  bookingCount: number;
  commission: number;
}

export type SubAdminRole = 'support' | 'finance' | 'ops' | 'content' | 'regional' | 'custom';
export interface SubAdmin {
  id: string;
  name: string;
  email: string;
  role: SubAdminRole;
  scope: 'platform' | 'org';
  orgIds?: string[];
  permissions: Record<string, { read: boolean; write: boolean; delete: boolean }>;
  status: 'active' | 'inactive' | 'expired';
  createdAt: string;
  expiresAt?: string;
  lastLoginAt?: string;
}

// ── Feature Flags ─────────────────────────────────────────────────────────────
export type FlagApp = 'patient' | 'provider' | 'both';
export interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  app: FlagApp;
  category: string;
  enabled: boolean;
  rolloutPercent: number;
  orgOverrides: { orgId: string; orgName: string; enabled: boolean }[];
  userOverrides: { userId: string; userName: string; enabled: boolean }[];
  updatedAt: string;
  updatedBy: string;
}

// ── Operations ────────────────────────────────────────────────────────────────
export interface Appointment {
  id: string;
  patientName: string;
  providerName: string;
  orgName: string;
  type: 'clinic' | 'video' | 'homecare';
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  scheduledAt: string;
  fee: number;
}

export interface Order {
  id: string;
  orderId: string;
  patientName: string;
  orgName: string;
  type: 'pharmacy' | 'lab' | 'homecare';
  status: 'pending' | 'confirmed' | 'processing' | 'out_for_delivery' | 'completed' | 'cancelled';
  total: number;
  createdAt: string;
}

// ── Financial ─────────────────────────────────────────────────────────────────
export interface Transaction {
  id: string;
  type: 'topup' | 'payment' | 'refund' | 'subscription';
  userName: string;
  orgName: string;
  patientId?: string;
  amount: number;
  status: 'completed' | 'pending' | 'failed';
  method: 'wallet' | 'upi' | 'card' | 'netbanking';
  createdAt: string;
}

// ── Audit Log ─────────────────────────────────────────────────────────────────
export interface AuditLog {
  id: string;
  adminName: string;
  adminRole: string;
  action: string;
  module: string;
  target: string;
  orgName?: string;
  ip: string;
  createdAt: string;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export interface LiveActivity {
  id: string;
  type: 'appointment' | 'order' | 'wallet' | 'signup' | 'alert';
  message: string;
  orgName: string;
  timestamp: Date;
}
