'use server';
// ─────────────────────────────────────────────────────────────────────────────
// Server actions — the real data layer for the admin portal.
// Runs ONLY on the server (uses the service-role client, bypasses RLS).
// Each function transforms DB snake_case rows → the app's camelCase types so the
// existing UI components keep working unchanged.
// ─────────────────────────────────────────────────────────────────────────────
import { supabaseAdmin } from './supabase-admin';
import { rolePermissions } from './roles';
// 'use server' means every export in THIS file must be an async function, so
// the shared constants live in a plain module both sides can import.
import {
  FEATURE_AUDIENCES, INDIVIDUAL_KINDS, ORG_TYPE_TO_KIND, PUSH_AUDIENCES,
} from './platform-meta';
import type { FeatureAudience, IndividualKind } from './platform-meta';
import type {
  Organisation, Patient, Provider, Rmp, SubAdmin, Appointment, Order, Transaction, AuditLog,
  StaffRole,
} from '@/types';

// ── Transforms ────────────────────────────────────────────────────────────────

function toOrg(r: any): Organisation {
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    city: r.city,
    country: r.country,
    address: r.address ?? undefined,
    phone: r.admin_phone ?? undefined,
    email: r.admin_email ?? undefined,
    status: r.status,
    subscription: r.subscription,
    providerCount: r.provider_count ?? 0,
    patientCount: r.patient_count ?? 0,
    mrr: Number(r.mrr ?? 0),
    joinedAt: r.joined_at ?? r.created_at,
    beds: r.beds != null ? String(r.beds) : undefined,
    departments: r.departments ?? undefined,
    logoUrl: r.logo_url ?? undefined,
  };
}

function toPatient(r: any): Patient {
  // wallets may come back as object or array depending on relationship
  const wallet = Array.isArray(r.wallets) ? r.wallets[0] : r.wallets;
  const apptCount = Array.isArray(r.appointments) ? (r.appointments[0]?.count ?? 0) : 0;
  return {
    id: r.id,
    name: r.name ?? 'Unnamed',
    email: r.email ?? '',
    phone: r.phone ?? '',
    orgId: r.organisation_id ?? '',
    orgName: r.organisations?.name ?? '—',
    status: r.status,
    walletBalance: Number(wallet?.balance ?? 0),
    appointmentCount: apptCount,
    joinedAt: r.created_at,
    lastActiveAt: r.updated_at ?? r.created_at,
  };
}

function toProvider(r: any): Provider {
  // staff.status: active | on_leave | inactive  +  verified_at
  let status: Provider['status'] = 'active';
  if (!r.verified_at) status = 'pending_verification';
  else if (r.status === 'inactive') status = 'suspended';

  const roleToType: Record<string, Provider['type']> = {
    doctor: 'doctor', lab_technician: 'lab', pharmacy_assistant: 'pharmacy',
  };
  return {
    id: r.id,
    name: r.name,
    type: roleToType[r.role] ?? 'doctor',
    // The real staff_role, so the UI can show and filter on what someone
    // actually is rather than squeezing seven roles into four buckets.
    role: r.role,
    staffId: r.staff_id ?? undefined,
    specialty: r.specialty ?? undefined,
    phone: r.phone ?? undefined,
    email: r.email ?? undefined,
    department: r.department ?? undefined,
    shift: r.shift ?? undefined,
    photoUrl: r.photo_url ?? undefined,
    orgId: r.organisation_id ?? '',
    orgName: r.organisations?.name ?? '—',
    orgType: r.organisations?.type ?? undefined,
    orgStatus: r.organisations?.status ?? undefined,
    // Whether this person has ever logged in — a staff row is created by the
    // hospital admin and only linked to an auth user on first login.
    linked: !!r.user_id,
    status,
    verifiedAt: r.verified_at ?? undefined,
    rating: Number(r.rating ?? 0),
    joinedAt: r.join_date ?? r.created_at,
  };
}

function toSubAdmin(r: any): SubAdmin {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    role: r.role,
    scope: r.scope,
    orgIds: r.org_ids ?? undefined,
    permissions: r.permissions ?? {},
    status: r.status,
    createdAt: r.created_at,
    expiresAt: r.expires_at ?? undefined,
    lastLoginAt: r.last_login_at ?? undefined,
  };
}

function toAppointment(r: any): Appointment {
  return {
    id: r.id,
    patientName: r.profiles?.name ?? '—',
    providerName: r.staff?.name ?? '—',
    orgName: r.organisations?.name ?? '—',
    type: r.type,
    status: r.status,
    scheduledAt: r.scheduled_at,
    fee: Number(r.fee ?? 0),
  };
}

function toTransaction(r: any): Transaction {
  return {
    id: r.id,
    type: r.type,
    userName: r.profiles?.name ?? '—',
    orgName: r.organisations?.name ?? '—',
    amount: Number(r.amount ?? 0),
    status: r.status,
    method: r.method,
    createdAt: r.created_at,
  };
}

function toAuditLog(r: any): AuditLog {
  return {
    id: r.id,
    adminName: r.admin_name,
    adminRole: r.admin_role,
    action: r.action,
    module: r.module,
    target: r.target,
    orgName: r.org_name ?? undefined,
    ip: r.ip_address ?? '—',
    createdAt: r.created_at,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ORGANISATIONS
// ═══════════════════════════════════════════════════════════════════════════

export async function listOrgs(): Promise<Organisation[]> {
  const { data, error } = await supabaseAdmin
    .from('organisations').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toOrg);
}

export async function createOrg(input: {
  name: string; type: string; city: string; country: string; subscription: string; phone?: string;
}): Promise<Organisation> {
  const { phone, ...rest } = input;
  // Active, not pending. 'pending' means "an application nobody has reviewed
  // yet", and it belongs to the onboarding queue. An admin creating an
  // organisation by hand IS the review — leaving it pending meant the org
  // silently could not log in (resolveRole blocks pending orgs, migration-061)
  // with nothing in the UI explaining why.
  const { data, error } = await supabaseAdmin
    .from('organisations')
    .insert({ ...rest, admin_phone: phone || null, status: 'active' })
    .select().single();
  if (error) throw new Error(error.message);
  return toOrg(data);
}

// Suspending an organisation has to take its staff down with it, or a
// suspended hospital's doctors keep working through their own logins.
//
// Reactivating must NOT simply set every staff row back to 'active': that would
// silently resurrect people an admin had deactivated individually. staff
// .suspended_at (migration-061) marks the ones this cascade switched off, so
// only those come back.
async function cascadeStaffStatus(orgId: string, suspend: boolean): Promise<void> {
  try {
    if (suspend) {
      const { error } = await supabaseAdmin.from('staff')
        .update({ status: 'inactive', suspended_at: new Date().toISOString() })
        .eq('organisation_id', orgId)
        .eq('status', 'active');
      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin.from('staff')
        .update({ status: 'active', suspended_at: null, suspended_reason: null })
        .eq('organisation_id', orgId)
        .not('suspended_at', 'is', null);
      if (error) throw error;
    }
  } catch (_) {
    // migration-061 not applied. Fall back to the blunt version for a suspend
    // (locking people out is the safe direction) and do nothing on reactivate,
    // rather than guessing which staff should come back.
    if (suspend) {
      await supabaseAdmin.from('staff')
        .update({ status: 'inactive' })
        .eq('organisation_id', orgId)
        .eq('status', 'active');
    }
  }
}

export async function setOrgStatus(
  id: string,
  status: 'active' | 'suspended',
  reason?: string,
): Promise<void> {
  // Stamp when and why, so the org detail page can explain a suspension
  // instead of just showing a red badge. Falls back to the bare status write
  // if migration-061 hasn't been applied.
  const patch: Record<string, unknown> = {
    status,
    suspended_at: status === 'suspended' ? new Date().toISOString() : null,
    suspended_reason: status === 'suspended' ? (reason || null) : null,
  };
  let { error } = await supabaseAdmin.from('organisations').update(patch).eq('id', id);
  if (error && (error.code === '42703' || /suspended_at|suspended_reason/i.test(error.message || ''))) {
    ({ error } = await supabaseAdmin.from('organisations').update({ status }).eq('id', id));
  }
  if (error) throw new Error(error.message);

  await cascadeStaffStatus(id, status === 'suspended');
}

export async function deleteOrg(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from('organisations').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// Everything the organisation detail page needs, scoped to ONE organisation.
//
// That page used to call listOrgs + listProviders + listPatients +
// listAppointments + listOrders + listTransactions and filter the results in
// the browser — six full table reads to render a single record, and three of
// them matched on organisation NAME rather than id, so two orgs sharing a name
// would have shown each other's data. Cost grew with the size of the platform
// rather than the size of the org.
//
// One call, six scoped queries, filtered by organisation_id in Postgres.
export async function getOrgDetail(orgId: string): Promise<{
  org: Organisation | null;
  providers: Provider[];
  patients: Patient[];
  appointments: Appointment[];
  orders: Order[];
  transactions: Transaction[];
}> {
  const { data: orgRow, error: orgErr } = await supabaseAdmin
    .from('organisations').select('*').eq('id', orgId).maybeSingle();
  if (orgErr) throw new Error(orgErr.message);
  if (!orgRow) {
    return { org: null, providers: [], patients: [], appointments: [], orders: [], transactions: [] };
  }

  const [staffRes, patientsRes, apptRes, txnRes, phRes, labRes, hcRes] = await Promise.all([
    supabaseAdmin.from('staff')
      .select('*, organisations(name)')
      .eq('organisation_id', orgId)
      .in('role', ['doctor', 'lab_technician', 'pharmacy_assistant'])
      .order('created_at', { ascending: false }),
    supabaseAdmin.from('profiles')
      .select('*, organisations(name), wallets(balance), appointments(count)')
      .eq('organisation_id', orgId)
      .order('created_at', { ascending: false }),
    supabaseAdmin.from('appointments')
      .select('*, profiles!patient_id(name), staff!doctor_staff_id(name), organisations!organisation_id(name)')
      .eq('organisation_id', orgId)
      .order('scheduled_at', { ascending: false }),
    supabaseAdmin.from('transactions')
      .select('*, profiles(name), organisations(name)')
      .eq('organisation_id', orgId)
      .order('created_at', { ascending: false }),
    supabaseAdmin.from('pharmacy_orders').select('*, profiles(name), organisations(name)').eq('organisation_id', orgId),
    supabaseAdmin.from('lab_orders').select('*, profiles(name), organisations(name)').eq('organisation_id', orgId),
    supabaseAdmin.from('homecare_orders').select('*, profiles(name), organisations(name)').eq('organisation_id', orgId),
  ]);

  const mapOrders = (rows: any[] | null, type: Order['type']): Order[] =>
    (rows ?? []).map((r) => ({
      id: r.id,
      orderId: r.order_id,
      patientName: r.profiles?.name ?? '—',
      orgName: r.organisations?.name ?? '—',
      type,
      status: r.status,
      total: Number(r.total ?? 0),
      createdAt: r.created_at,
    }));

  return {
    org: toOrg(orgRow),
    providers: (staffRes.data ?? []).map(toProvider),
    patients: (patientsRes.data ?? []).map(toPatient),
    appointments: (apptRes.data ?? []).map(toAppointment),
    orders: [
      ...mapOrders(phRes.data, 'pharmacy'),
      ...mapOrders(labRes.data, 'lab'),
      ...mapOrders(hcRes.data, 'homecare'),
    ].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    transactions: (txnRes.data ?? []).map(toTransaction),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ORG STAFF MANAGEMENT  (create / list / activate / deactivate per org)
// ═══════════════════════════════════════════════════════════════════════════

export type OrgStaffMember = {
  id: string; name: string; role: string; phone: string;
  specialty: string; department: string; status: string;
  verifiedAt: string | null; joinedAt: string; loginPhone?: string;
};

export async function listOrgStaff(orgId: string): Promise<OrgStaffMember[]> {
  const { data, error } = await supabaseAdmin
    .from('staff').select('*').eq('organisation_id', orgId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any): OrgStaffMember => ({
    id: r.id, name: r.name, role: r.role,
    phone: r.phone ?? '', specialty: r.specialty ?? '', department: r.department ?? '',
    status: r.status ?? 'active', verifiedAt: r.verified_at ?? null,
    joinedAt: r.join_date ?? r.created_at,
  }));
}

export async function createOrgStaff(input: {
  orgId: string; name: string; role: string; phone: string;
  specialty?: string; department?: string;
}): Promise<OrgStaffMember & { loginPhone: string }> {
  const p10 = input.phone.replace(/\D/g, '').slice(-10);
  if (p10.length !== 10) throw new Error('Phone must be exactly 10 digits');
  const email = `91${p10}@healio.app`;
  const password = 'Healio-Dev-1234';

  // Create or reuse auth user (phone-to-email pattern, same as mobile apps)
  let userId: string;
  const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
    email, password, email_confirm: true,
    phone: `+91${p10}`, phone_confirm: true,
    user_metadata: { name: input.name, role: input.role },
  });
  if (!authErr) {
    userId = authData.user.id;
  } else {
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const found = list.users.find((u: any) => u.email === email);
    if (!found) throw new Error(`Could not create auth user: ${authErr.message}`);
    userId = found.id;
  }

  const staffId = `ST-${Date.now().toString().slice(-6)}`;
  const { data, error } = await supabaseAdmin.from('staff').insert({
    staff_id: staffId, user_id: userId, organisation_id: input.orgId,
    name: input.name, role: input.role,
    phone: `+91${p10}`, email,
    specialty: input.specialty?.trim() || null,
    department: input.department?.trim() || null,
    status: 'active', verified_at: new Date().toISOString(),
  }).select('id, name, role, phone, specialty, department, verified_at, created_at').single();
  if (error) throw new Error(error.message);
  return {
    id: data.id, name: data.name, role: data.role,
    phone: data.phone ?? '', specialty: data.specialty ?? '', department: data.department ?? '',
    status: 'active', verifiedAt: data.verified_at,
    joinedAt: data.created_at, loginPhone: p10,
  };
}

export async function setStaffStatus(id: string, status: 'active' | 'inactive'): Promise<void> {
  const { error } = await supabaseAdmin.from('staff').update({ status }).eq('id', id);
  if (error) throw new Error(error.message);
}

// ═══════════════════════════════════════════════════════════════════════════
// ONBOARDING QUEUE
// ═══════════════════════════════════════════════════════════════════════════

// A KYC document as the admin panel can actually use it.
//   label  human name for the slot ('Registration Certificate')
//   path   object path inside the private verification-docs bucket
//   url    short-lived signed URL, or null when the file is missing
export type VerificationDoc = {
  label: string;
  path: string | null;
  url: string | null;
};

// The signup wizard stores `documents` as raw slot keys ('registration',
// 'license', 'id') and the matching storage paths in `document_urls`.
const DOC_LABELS: Record<string, string> = {
  registration: 'Registration Certificate',
  license: 'Trade / Drug License',
  id: 'Owner ID Proof',
};
const docLabel = (key: string) =>
  DOC_LABELS[key] ??
  key.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

// verification-docs is a PRIVATE bucket (migration-019): only the service role
// can read it, so the browser cannot load these paths directly. Signed URLs are
// how the admin panel shows them — one hour is long enough to review an
// application and short enough that a leaked link expires.
const SIGNED_URL_TTL = 60 * 60;

async function signDocs(paths: string[], labels: string[]): Promise<VerificationDoc[]> {
  const out: VerificationDoc[] = labels.map((label, i) => ({
    label,
    path: paths[i] ?? null,
    url: null,
  }));

  const withPaths = out.filter((d) => d.path);
  if (withPaths.length === 0) return out;

  try {
    const { data, error } = await supabaseAdmin.storage
      .from('verification-docs')
      .createSignedUrls(withPaths.map((d) => d.path as string), SIGNED_URL_TTL);
    if (error) throw error;
    (data ?? []).forEach((row: any, i: number) => {
      if (row?.signedUrl) withPaths[i].url = row.signedUrl;
    });
  } catch (_) {
    // Bucket missing or storage unreachable — the caller still gets the slot
    // list, and the UI says "file unavailable" rather than lying with a tick.
  }
  return out;
}

export async function listOnboarding() {
  const { data, error } = await supabaseAdmin
    .from('onboarding_queue').select('*').order('applied_at', { ascending: false });
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  // Sign up front so opening the drawer is instant rather than firing a storage
  // round trip per click — but only for applications still awaiting review,
  // since those are the only ones the queue lets you open. Signing the whole
  // history would cost one storage call per row for nothing.
  const docs = await Promise.all(
    rows.map((r: any) => {
      if (r.status !== 'pending') return Promise.resolve([] as VerificationDoc[]);
      const keys: string[] = r.documents ?? [];
      const paths: string[] = r.document_urls ?? [];
      return signDocs(paths, keys.map(docLabel));
    }),
  );

  return rows.map((r: any, i: number) => ({
    id: r.id, name: r.name, type: r.type, city: r.city, country: r.country,
    appliedAt: r.applied_at, contactName: r.contact_name, contactEmail: r.admin_email,
    contactPhone: r.admin_phone, documents: r.documents ?? [], notes: r.notes ?? '',
    status: r.status,
    address: r.address ?? null,
    latitude: r.latitude ?? null,
    longitude: r.longitude ?? null,
    docs: docs[i],
  }));
}

// Verification documents for an already-approved organisation.
// approveOnboarding() copies the applicant's paths onto the org, so this works
// for anything onboarded after that change; older orgs fall back to their
// original application row.
export async function getOrgDocuments(orgId: string): Promise<VerificationDoc[]> {
  const { data: org } = await supabaseAdmin
    .from('organisations')
    .select('verification_doc_urls')
    .eq('id', orgId)
    .maybeSingle();

  let paths: string[] = org?.verification_doc_urls ?? [];
  let keys: string[] = [];

  const { data: apps } = await supabaseAdmin
    .from('onboarding_queue')
    .select('documents, document_urls')
    .eq('organisation_id', orgId)
    .order('applied_at', { ascending: false })
    .limit(1);
  const app = apps?.[0];

  if (app) {
    keys = app.documents ?? [];
    // Orgs approved before the copy-on-approve change have an empty
    // verification_doc_urls; their files are still on the application row.
    if (paths.length === 0) paths = app.document_urls ?? [];
  }

  if (paths.length === 0 && keys.length === 0) return [];
  // Label by slot key when we have them, else number the files.
  const labels = keys.length
    ? keys.map(docLabel)
    : paths.map((_, i) => `Document ${i + 1}`);
  return signDocs(paths, labels);
}

export async function approveOnboarding(id: string): Promise<void> {
  // Look up the application
  const { data: app, error: e1 } = await supabaseAdmin
    .from('onboarding_queue').select('*').eq('id', id).single();
  if (e1) throw new Error(e1.message);

  // Create the organisation (active).
  // verification_doc_urls and the coordinates are carried over from the
  // application: without the copy the KYC files stayed orphaned on the queue
  // row and the org detail page had nothing to show, and without the
  // coordinates an approved provider never appears in "nearest" results.
  const insert: Record<string, unknown> = {
    name: app.name, type: app.type, city: app.city, country: app.country,
    address: app.address, admin_phone: app.admin_phone, admin_email: app.admin_email,
    beds: app.beds, departments: app.departments, status: 'active',
    verification_doc_urls: app.document_urls ?? [],
  };
  if (app.latitude != null)  insert.latitude  = app.latitude;
  if (app.longitude != null) insert.longitude = app.longitude;

  let { data: org, error: e2 } = await supabaseAdmin
    .from('organisations').insert(insert).select().single();

  // migration-019 / 014 not applied on this project yet: approving the
  // application still matters more than carrying the extra columns.
  if (e2 && (e2.code === '42703' || /verification_doc_urls|latitude|longitude/i.test(e2.message || ''))) {
    const { verification_doc_urls, latitude, longitude, ...core } = insert as any;
    ({ data: org, error: e2 } = await supabaseAdmin
      .from('organisations').insert(core).select().single());
  }
  if (e2) throw new Error(e2.message);

  // Mark application approved + link org
  await supabaseAdmin.from('onboarding_queue')
    .update({ status: 'approved', organisation_id: org.id, reviewed_at: new Date().toISOString() })
    .eq('id', id);
}

export async function rejectOnboarding(id: string, reason: string): Promise<void> {
  const { error } = await supabaseAdmin.from('onboarding_queue')
    .update({ status: 'rejected', rejection_reason: reason, reviewed_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

// ═══════════════════════════════════════════════════════════════════════════
// PATIENTS
// ═══════════════════════════════════════════════════════════════════════════

export async function listPatients(): Promise<Patient[]> {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('*, organisations(name), wallets(balance), appointments(count)')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toPatient);
}

export async function setPatientStatus(id: string, status: 'active' | 'banned'): Promise<void> {
  const { error } = await supabaseAdmin.from('profiles').update({ status }).eq('id', id);
  if (error) throw new Error(error.message);
}

// Fully delete a patient: their appointments/records (via FK cascade), profile,
// and the auth account — so the same phone number can be re-registered for testing.
export async function deletePatient(id: string): Promise<void> {
  // 1. Delete the profile row (cascades appointments, wallets, records, etc.)
  await supabaseAdmin.from('profiles').delete().eq('id', id);
  // 2. Delete the auth user so the phone/email is free to sign up again
  try {
    await supabaseAdmin.auth.admin.deleteUser(id);
  } catch (e) {
    // Auth user may already be gone — ignore
  }
}

export async function adjustPatientWallet(
  id: string, amount: number, type: 'credit' | 'debit', note: string,
): Promise<void> {
  // Log the adjustment
  await supabaseAdmin.from('wallet_adjustments')
    .insert({ patient_id: id, amount, type, note });
  // Apply to wallet balance
  const { data: w } = await supabaseAdmin
    .from('wallets').select('balance').eq('patient_id', id).single();
  const current = Number(w?.balance ?? 0);
  const next = type === 'credit' ? current + amount : Math.max(0, current - amount);
  await supabaseAdmin.from('wallets').update({ balance: next }).eq('patient_id', id);
}

// ═══════════════════════════════════════════════════════════════════════════
// PROVIDERS  (= staff with medical roles)
// ═══════════════════════════════════════════════════════════════════════════

// Every staff member, not just the clinical three.
//
// This used to filter to doctor / lab_technician / pharmacy_assistant, so a
// hospital's OPD assistants, nurses, receptionists and org admins existed in
// the database but appeared NOWHERE in the admin panel outside a single org's
// Staff tab. The page called itself "Providers" and quietly showed a subset.
// The role filter now belongs to the UI, where it is visible and adjustable.
export async function listProviders(): Promise<Provider[]> {
  const { data, error } = await supabaseAdmin
    .from('staff')
    .select('*, organisations(name, type, status)')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toProvider);
}

// Staff, one page at a time, filtered in Postgres.
//
// listProviders() returns every staff row on the platform. That is fine for a
// handful of hospitals and hopeless at a thousand: the browser would download
// every doctor, nurse and receptionist in the country to render twenty rows,
// and the search box only ever filtered what had already been shipped.
//
// Filtering, searching, counting and paging all happen server-side here.
export type StaffQuery = {
  page?: number;
  pageSize?: number;
  role?: StaffRole | 'all';
  status?: 'all' | 'active' | 'pending_verification' | 'suspended';
  orgId?: string;
  search?: string;
};

export type StaffPage = {
  rows: Provider[];
  total: number;
  page: number;
  pageSize: number;
  countsByRole: Record<string, number>;
};

// `Provider.status` is derived, not a column: unverified beats everything, then
// staff.status. Translating it back into query terms keeps the filter honest.
function applyStatus(q: any, status: StaffQuery['status']) {
  if (status === 'pending_verification') return q.is('verified_at', null);
  if (status === 'suspended') return q.not('verified_at', 'is', null).eq('status', 'inactive');
  if (status === 'active') return q.not('verified_at', 'is', null).neq('status', 'inactive');
  return q;
}

// Escape the PostgREST `or=` separators so a comma or paren in a search box
// can't rewrite the filter expression.
const safeSearch = (v: string) => v.replace(/[,()\\]/g, ' ').trim();

export async function listStaffPage(params: StaffQuery = {}): Promise<StaffPage> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, params.pageSize ?? 25));
  const from = (page - 1) * pageSize;
  const search = safeSearch(params.search ?? '');

  const base = () => {
    let q: any = supabaseAdmin.from('staff');
    return q;
  };

  const withFilters = (q: any) => {
    if (params.role && params.role !== 'all') q = q.eq('role', params.role);
    if (params.orgId) q = q.eq('organisation_id', params.orgId);
    if (search) {
      q = q.or(
        `name.ilike.%${search}%,phone.ilike.%${search}%,` +
        `staff_id.ilike.%${search}%,specialty.ilike.%${search}%`,
      );
    }
    return applyStatus(q, params.status ?? 'all');
  };

  const rowsQuery = withFilters(
    base().select('*, organisations(name, type, status)', { count: 'exact' }),
  ).order('created_at', { ascending: false }).range(from, from + pageSize - 1);

  // Tab counts ignore the role filter (a tab must show its own size even while
  // another tab is selected) but honour every other filter.
  const roles: StaffRole[] = [
    'doctor', 'lab_technician', 'pharmacy_assistant',
    'nurse', 'opd_assistant', 'receptionist', 'admin',
  ];
  const countFor = (role: StaffRole | null) => {
    let q: any = supabaseAdmin.from('staff').select('id', { count: 'exact', head: true });
    if (role) q = q.eq('role', role);
    if (params.orgId) q = q.eq('organisation_id', params.orgId);
    if (search) {
      q = q.or(
        `name.ilike.%${search}%,phone.ilike.%${search}%,` +
        `staff_id.ilike.%${search}%,specialty.ilike.%${search}%`,
      );
    }
    return applyStatus(q, params.status ?? 'all');
  };

  const [res, allCount, ...roleCounts] = await Promise.all([
    rowsQuery,
    countFor(null),
    ...roles.map((r) => countFor(r)),
  ]);

  if (res.error) throw new Error(res.error.message);

  const countsByRole: Record<string, number> = { all: allCount.count ?? 0 };
  roles.forEach((r, i) => { countsByRole[r] = roleCounts[i].count ?? 0; });

  return {
    rows: (res.data ?? []).map(toProvider),
    total: res.count ?? 0,
    page,
    pageSize,
    countsByRole,
  };
}

// Organisations for the staff page's filter, searched server-side.
// listOrgNames() caps at 50 active orgs, which is a filter that silently omits
// most of the platform once there are more than that.
export async function searchOrgNames(
  query = '',
  limit = 30,
): Promise<{ id: string; name: string; type: string; staffCount: number }[]> {
  let q: any = supabaseAdmin
    .from('organisations')
    .select('id, name, type')
    .order('name')
    .limit(Math.min(100, limit));
  const search = safeSearch(query);
  if (search) q = q.ilike('name', `%${search}%`);

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const orgs = data ?? [];
  if (orgs.length === 0) return [];

  // One grouped count rather than a query per organisation.
  const ids = orgs.map((o: any) => o.id);
  const { data: staff } = await supabaseAdmin
    .from('staff').select('organisation_id').in('organisation_id', ids);
  const counts: Record<string, number> = {};
  (staff ?? []).forEach((r: any) => {
    counts[r.organisation_id] = (counts[r.organisation_id] ?? 0) + 1;
  });

  return orgs.map((o: any) => ({
    id: o.id, name: o.name, type: o.type, staffCount: counts[o.id] ?? 0,
  }));
}

export async function verifyProvider(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from('staff')
    .update({ status: 'active', verified_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function suspendProvider(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from('staff')
    .update({ status: 'inactive' }).eq('id', id);
  if (error) throw new Error(error.message);
}

// ═══════════════════════════════════════════════════════════════════════════
// INDIVIDUAL / STANDALONE PROVIDERS
//
// A solo doctor, standalone lab and standalone pharmacy each sign up through
// the same wizard a hospital uses, so on approval they are an `organisations`
// row — type 'clinic', 'diagnostic' and 'pharmacy' respectively. resolveRole()
// in the mobile app maps those three org types onto the independent_* roles.
//
// They were therefore already IN the admin panel, buried among hospitals in
// the Organisations grid with no way to tell one apart. This gives them their
// own registry, and an off switch that the app now actually honours: until
// migration-061 the panel wrote organisations.status = 'suspended' and
// resolveRole() never read it back, so "suspend" changed nothing.
// ═══════════════════════════════════════════════════════════════════════════

export type IndividualProvider = {
  id: string;
  kind: IndividualKind;
  kindLabel: string;
  name: string;
  city: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  status: 'active' | 'suspended' | 'trial' | 'pending';
  linked: boolean;          // has an auth account claimed this org yet
  staffCount: number;
  suspendedAt: string | null;
  suspendedReason: string | null;
  joinedAt: string;
};

export async function listIndividualProviders(): Promise<IndividualProvider[]> {
  const { data, error } = await supabaseAdmin
    .from('organisations')
    .select('*')
    .in('type', Object.keys(ORG_TYPE_TO_KIND))
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  if (rows.length === 0) return [];

  // One query for every org's staff instead of N — an individual doctor is a
  // one-person org, but a standalone lab can employ technicians.
  const ids = rows.map((r: any) => r.id);
  const { data: staff } = await supabaseAdmin
    .from('staff').select('organisation_id').in('organisation_id', ids);
  const staffCounts: Record<string, number> = {};
  (staff ?? []).forEach((r: any) => {
    staffCounts[r.organisation_id] = (staffCounts[r.organisation_id] ?? 0) + 1;
  });

  return rows.map((r: any) => ({
    id: r.id,
    kind: ORG_TYPE_TO_KIND[r.type],
    kindLabel: INDIVIDUAL_KINDS[ORG_TYPE_TO_KIND[r.type]].label,
    name: r.name,
    city: r.city ?? '',
    address: r.address ?? null,
    phone: r.admin_phone ?? null,
    email: r.admin_email ?? null,
    status: r.status,
    linked: !!r.admin_user_id,
    staffCount: staffCounts[r.id] ?? 0,
    suspendedAt: r.suspended_at ?? null,
    suspendedReason: r.suspended_reason ?? null,
    joinedAt: r.joined_at ?? r.created_at,
  }));
}

// Everything known about one independent provider, for the detail panel.
//
// The list view can only afford summary columns; this fills in the rest —
// address and coordinates, verification documents, the staff they employ, and
// how much work has actually come through them.
export type IndividualProviderDetail = {
  provider: IndividualProvider | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  subscription: string | null;
  docs: VerificationDoc[];
  staff: { id: string; name: string; role: string; phone: string; status: string }[];
  counts: { appointments: number; orders: number; patients: number };
};

export async function getIndividualProviderDetail(
  orgId: string,
): Promise<IndividualProviderDetail> {
  const { data: org } = await supabaseAdmin
    .from('organisations').select('*').eq('id', orgId).maybeSingle();

  if (!org) {
    return {
      provider: null, address: null, latitude: null, longitude: null,
      subscription: null, docs: [], staff: [],
      counts: { appointments: 0, orders: 0, patients: 0 },
    };
  }

  const kind = ORG_TYPE_TO_KIND[org.type] ?? 'individual_doctor';

  const [docs, staffRes, apptRes, phRes, labRes, patRes] = await Promise.all([
    getOrgDocuments(orgId),
    supabaseAdmin.from('staff')
      .select('id, name, role, phone, status')
      .eq('organisation_id', orgId)
      .order('created_at', { ascending: false }),
    supabaseAdmin.from('appointments')
      .select('id', { count: 'exact', head: true }).eq('organisation_id', orgId),
    supabaseAdmin.from('pharmacy_orders')
      .select('id', { count: 'exact', head: true }).eq('organisation_id', orgId),
    supabaseAdmin.from('lab_orders')
      .select('id', { count: 'exact', head: true }).eq('organisation_id', orgId),
    supabaseAdmin.from('profiles')
      .select('id', { count: 'exact', head: true }).eq('organisation_id', orgId),
  ]);

  return {
    provider: {
      id: org.id,
      kind,
      kindLabel: INDIVIDUAL_KINDS[kind].label,
      name: org.name,
      city: org.city ?? '',
      address: org.address ?? null,
      phone: org.admin_phone ?? null,
      email: org.admin_email ?? null,
      status: org.status,
      linked: !!org.admin_user_id,
      staffCount: (staffRes.data ?? []).length,
      suspendedAt: org.suspended_at ?? null,
      suspendedReason: org.suspended_reason ?? null,
      joinedAt: org.joined_at ?? org.created_at,
    },
    address: org.address ?? null,
    latitude: org.latitude ?? null,
    longitude: org.longitude ?? null,
    subscription: org.subscription ?? null,
    docs,
    staff: (staffRes.data ?? []).map((r: any) => ({
      id: r.id, name: r.name, role: r.role, phone: r.phone ?? '', status: r.status,
    })),
    counts: {
      appointments: apptRes.count ?? 0,
      orders: (phRes.count ?? 0) + (labRes.count ?? 0),
      patients: patRes.count ?? 0,
    },
  };
}

// The off switch. Writing status is what the mobile app's login gate reads;
// the timestamp and reason are for the audit trail and the admin UI.
export async function setIndividualProviderStatus(
  id: string,
  enabled: boolean,
  reason?: string,
): Promise<void> {
  const patch: Record<string, unknown> = {
    status: enabled ? 'active' : 'suspended',
    suspended_at: enabled ? null : new Date().toISOString(),
    suspended_reason: enabled ? null : (reason || null),
  };

  let { data, error } = await supabaseAdmin
    .from('organisations').update(patch).eq('id', id).select('name, type').single();

  // migration-061 not applied — the status write is the part that matters.
  if (error && (error.code === '42703' || /suspended_at|suspended_reason/i.test(error.message || ''))) {
    ({ data, error } = await supabaseAdmin
      .from('organisations')
      .update({ status: patch.status })
      .eq('id', id).select('name, type').single());
  }
  if (error) throw new Error(error.message);

  // Cascade to the provider's own staff so a suspended lab's technicians
  // can't keep logging in through their individual staff accounts.
  await cascadeStaffStatus(id, !enabled);

  const kind = ORG_TYPE_TO_KIND[(data as any)?.type] ?? 'individual_doctor';
  await writeAuditLog(
    `${enabled ? 'Enabled' : 'Disabled'} ${INDIVIDUAL_KINDS[kind].label.toLowerCase()}`,
    'Individual Providers',
    `${(data as any)?.name ?? id}${reason ? ` — ${reason}` : ''}`,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// RMPs (village health workers — independent, in the `rmps` table)
// ═══════════════════════════════════════════════════════════════════════════
export async function listRmps(): Promise<Rmp[]> {
  // The `rmps` table doesn't always have email/address (migration-037), so
  // select('*') keeps this resilient if that migration hasn't been applied.
  const { data: rmps, error } = await supabaseAdmin
    .from('rmps')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  const rows = rmps ?? [];
  if (rows.length === 0) return [];

  // Derive per-RMP counts. Scope appointments to RMP bookings only (rmp_id set)
  // so we don't scan the whole appointments table.
  const [{ data: links }, { data: appts }, { data: comms }] = await Promise.all([
    supabaseAdmin.from('rmp_patients').select('rmp_id'),
    supabaseAdmin.from('appointments').select('rmp_id').not('rmp_id', 'is', null),
    supabaseAdmin.from('rmp_commissions').select('rmp_id, amount, type'),
  ]);

  const countBy = (arr: any[] | null, key = 'rmp_id') => {
    const m: Record<string, number> = {};
    (arr ?? []).forEach((r) => { if (r[key]) m[r[key]] = (m[r[key]] ?? 0) + 1; });
    return m;
  };
  const patientCounts = countBy(links);
  const bookingCounts = countBy(appts);
  const commissionByRmp: Record<string, number> = {};
  (comms ?? []).forEach((c: any) => {
    const sign = c.type === 'debit' ? -1 : 1;
    commissionByRmp[c.rmp_id] = (commissionByRmp[c.rmp_id] ?? 0) + sign * Number(c.amount ?? 0);
  });

  return rows.map((r: any) => toRmp(r, {
    patientCount: patientCounts[r.id] ?? 0,
    bookingCount: bookingCounts[r.id] ?? 0,
    commission: Math.max(0, commissionByRmp[r.id] ?? 0),
  }));
}

export async function verifyRmp(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from('rmps').update({ status: 'active' }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function suspendRmp(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from('rmps').update({ status: 'suspended' }).eq('id', id);
  if (error) throw new Error(error.message);
}

function toRmp(r: any, counts: { patientCount: number; bookingCount: number; commission: number }): Rmp {
  return {
    id: r.id,
    name: r.name ?? 'Healthcare Consultant',
    phone: r.phone ?? '',
    village: r.village ?? undefined,
    address: r.address ?? undefined,
    email: r.email ?? undefined,
    regNo: r.reg_no ?? undefined,
    status: r.status === 'suspended' ? 'suspended' : 'active',
    joinedAt: r.created_at,
    ...counts,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SUB-ADMINS
// ═══════════════════════════════════════════════════════════════════════════

export async function listSubAdmins(): Promise<SubAdmin[]> {
  const { data, error } = await supabaseAdmin
    .from('sub_admins').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toSubAdmin);
}

// Readable temp password, e.g. "Healio-7fk2-481"
function genSubAdminPassword(): string {
  return `Healio-${Math.random().toString(36).slice(2, 6)}-${Math.floor(100 + Math.random() * 900)}`;
}

async function findAuthUserByEmail(email: string): Promise<string | null> {
  const { data } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  return data.users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase())?.id ?? null;
}

export async function createSubAdmin(input: {
  name: string; email: string; role: string; scope: string; expiresAt?: string;
  permissions?: Record<string, { read?: boolean; write?: boolean; delete?: boolean }>;
}): Promise<SubAdmin & { tempPassword: string }> {
  const password = genSubAdminPassword();

  // 1. Create the login account (email + generated password).
  let userId: string | null = null;
  const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
    email: input.email, password, email_confirm: true,
    user_metadata: { kind: 'sub_admin', sub_admin_role: input.role, name: input.name },
  });
  if (authErr) {
    // Already registered → reuse the existing user and set the new password.
    userId = await findAuthUserByEmail(input.email);
    if (userId) await supabaseAdmin.auth.admin.updateUserById(userId, { password });
  } else {
    userId = authData.user.id;
  }

  // 2. Insert the sub-admin row with role-based permissions.
  const { data, error } = await supabaseAdmin.from('sub_admins')
    .insert({
      user_id: userId,
      name: input.name, email: input.email, role: input.role, scope: input.scope,
      // Use the admin's custom permission matrix if provided, else the role template.
      permissions: input.permissions ?? rolePermissions(input.role),
      status: 'active', expires_at: input.expiresAt || null,
    })
    .select().single();
  if (error) throw new Error(error.message);
  return { ...toSubAdmin(data), tempPassword: password };
}

// Update a sub-admin's role label + custom permission matrix.
export async function updateSubAdmin(id: string, input: {
  role?: string;
  permissions?: Record<string, { read?: boolean; write?: boolean; delete?: boolean }>;
}): Promise<SubAdmin> {
  const patch: Record<string, unknown> = {};
  if (input.role !== undefined) patch.role = input.role;
  if (input.permissions !== undefined) patch.permissions = input.permissions;
  const { data, error } = await supabaseAdmin.from('sub_admins')
    .update(patch).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  return toSubAdmin(data);
}

export async function revokeSubAdmin(id: string): Promise<void> {
  // Mark inactive AND disable the login (ban the auth user).
  const { data: row } = await supabaseAdmin.from('sub_admins').select('user_id').eq('id', id).maybeSingle();
  if (row?.user_id) {
    try { await supabaseAdmin.auth.admin.updateUserById(row.user_id, { ban_duration: '876000h' }); } catch { /* ignore */ }
  }
  const { error } = await supabaseAdmin.from('sub_admins')
    .update({ status: 'inactive' }).eq('id', id);
  if (error) throw new Error(error.message);
}

// Generate a new password for a sub-admin (changeable). Returns it once.
export async function resetSubAdminPassword(id: string): Promise<{ password: string }> {
  const { data: row, error: rowErr } = await supabaseAdmin
    .from('sub_admins').select('user_id, email').eq('id', id).single();
  if (rowErr) throw new Error(rowErr.message);

  const password = genSubAdminPassword();
  let userId = row.user_id as string | null;

  if (!userId) {
    // No login yet → create one now.
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: row.email, password, email_confirm: true, user_metadata: { kind: 'sub_admin' },
    });
    userId = authErr ? await findAuthUserByEmail(row.email) : authData.user.id;
    if (authErr && userId) await supabaseAdmin.auth.admin.updateUserById(userId, { password });
    if (userId) await supabaseAdmin.from('sub_admins').update({ user_id: userId }).eq('id', id);
  } else {
    // Existing login → set new password and lift any ban (re-activate).
    await supabaseAdmin.auth.admin.updateUserById(userId, { password, ban_duration: 'none' });
  }
  return { password };
}

// ═══════════════════════════════════════════════════════════════════════════
// APPOINTMENTS
// ═══════════════════════════════════════════════════════════════════════════

export async function listAppointments(): Promise<Appointment[]> {
  const { data, error } = await supabaseAdmin
    .from('appointments')
    .select('*, profiles!patient_id(name), staff!doctor_staff_id(name), organisations!organisation_id(name)')
    .order('scheduled_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toAppointment);
}

export async function setAppointmentStatus(
  id: string, status: 'in_progress' | 'completed' | 'cancelled',
): Promise<void> {
  const { error } = await supabaseAdmin.from('appointments').update({ status }).eq('id', id);
  if (error) throw new Error(error.message);
}

// ═══════════════════════════════════════════════════════════════════════════
// ORDERS  (unified pharmacy + lab + homecare)
// ═══════════════════════════════════════════════════════════════════════════

export async function listOrders(): Promise<Order[]> {
  const [ph, lab, hc] = await Promise.all([
    supabaseAdmin.from('pharmacy_orders').select('*, profiles(name), organisations(name)'),
    supabaseAdmin.from('lab_orders').select('*, profiles(name), organisations(name)'),
    supabaseAdmin.from('homecare_orders').select('*, profiles(name), organisations(name)'),
  ]);
  const map = (rows: any[] | null, type: Order['type']): Order[] =>
    (rows ?? []).map((r) => ({
      id: r.id,
      orderId: r.order_id,
      patientName: r.profiles?.name ?? '—',
      orgName: r.organisations?.name ?? '—',
      type,
      status: r.status,
      total: Number(r.total ?? 0),
      createdAt: r.created_at,
    }));
  return [
    ...map(ph.data, 'pharmacy'),
    ...map(lab.data, 'lab'),
    ...map(hc.data, 'homecare'),
  ].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

// ═══════════════════════════════════════════════════════════════════════════
// TRANSACTIONS
// ═══════════════════════════════════════════════════════════════════════════

export async function listTransactions(): Promise<Transaction[]> {
  const { data, error } = await supabaseAdmin
    .from('transactions')
    .select('*, profiles(name), organisations(name)')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toTransaction);
}

// ═══════════════════════════════════════════════════════════════════════════
// REFUNDS
// ═══════════════════════════════════════════════════════════════════════════

export async function listRefunds() {
  const { data, error } = await supabaseAdmin
    .from('refunds').select('*, profiles(name), organisations(name)')
    .order('requested_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({
    id: r.id, userName: r.profiles?.name ?? '—', orgName: r.organisations?.name ?? '—',
    amount: Number(r.amount ?? 0), reason: r.reason, status: r.status, method: r.method,
    requestedAt: r.requested_at,
  }));
}

export async function setRefundStatus(
  id: string, status: 'approved' | 'rejected', reason?: string,
): Promise<void> {
  const { error } = await supabaseAdmin.from('refunds')
    .update({ status, rejection_reason: reason ?? null, resolved_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

// ═══════════════════════════════════════════════════════════════════════════
// DISPUTES
// ═══════════════════════════════════════════════════════════════════════════

export async function listDisputes() {
  const { data, error } = await supabaseAdmin
    .from('disputes').select('*, profiles(name), organisations(name)')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({
    id: r.id, patientName: r.profiles?.name ?? '—', orgName: r.organisations?.name ?? '—',
    subject: r.subject, category: r.category, priority: r.priority, status: r.status,
    createdAt: r.created_at, assignedTo: r.assigned_to ?? null, messages: 0,
  }));
}

export async function respondDispute(id: string, message: string): Promise<void> {
  const { error } = await supabaseAdmin.from('dispute_messages')
    .insert({ dispute_id: id, message, sent_by: 'admin' });
  if (error) throw new Error(error.message);
}

export async function resolveDispute(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from('disputes')
    .update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}

// ═══════════════════════════════════════════════════════════════════════════
// SLA
// ═══════════════════════════════════════════════════════════════════════════

export async function escalateSla(target: string, note: string): Promise<void> {
  const { error } = await supabaseAdmin.from('sla_escalations')
    .insert({ breach_target: target, note });
  if (error) throw new Error(error.message);
}

// ═══════════════════════════════════════════════════════════════════════════
// AUDIT LOGS
// ═══════════════════════════════════════════════════════════════════════════

export async function listAuditLogs(): Promise<AuditLog[]> {
  const { data, error } = await supabaseAdmin
    .from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []).map(toAuditLog);
}

export async function writeAuditLog(action: string, module: string, target: string): Promise<void> {
  await supabaseAdmin.from('audit_logs').insert({
    admin_name: 'Super Admin', admin_role: 'super_admin',
    action, module, target, ip_address: '—',
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SERVICE CATEGORIES
// ═══════════════════════════════════════════════════════════════════════════

export async function listServiceCategories() {
  const { data, error } = await supabaseAdmin
    .from('service_categories').select('*').order('display_order');
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({
    id: r.id, name: r.name, icon: r.icon, description: r.description,
    enabled: r.enabled, order: r.display_order, app: r.app,
  }));
}

export async function createServiceCategory(input: {
  name: string; description: string; icon: string; order: number;
}) {
  const { data, error } = await supabaseAdmin.from('service_categories')
    .insert({ name: input.name, description: input.description, icon: input.icon, display_order: input.order, enabled: true })
    .select().single();
  if (error) throw new Error(error.message);
  return { id: data.id, name: data.name, icon: data.icon, description: data.description, enabled: data.enabled, order: data.display_order, app: data.app };
}

export async function updateServiceCategory(id: string, patch: Record<string, unknown>): Promise<void> {
  const dbPatch: Record<string, unknown> = { ...patch };
  if ('order' in dbPatch) { dbPatch.display_order = dbPatch.order; delete dbPatch.order; }
  const { error } = await supabaseAdmin.from('service_categories').update(dbPatch).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteServiceCategory(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from('service_categories').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ═══════════════════════════════════════════════════════════════════════════
// PRICING RULES
// ═══════════════════════════════════════════════════════════════════════════

export async function listPricingRules() {
  const { data, error } = await supabaseAdmin
    .from('pricing_rules').select('*').order('created_at');
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({
    id: r.id, service: r.service, type: r.type,
    basePrice: Number(r.base_price), platformFee: Number(r.platform_fee), orgOverrides: [],
  }));
}

export async function createPricingRule(input: {
  service: string; type: string; basePrice: number; platformFee: number;
}) {
  const { data, error } = await supabaseAdmin.from('pricing_rules')
    .insert({ service: input.service, type: input.type, base_price: input.basePrice, platform_fee: input.platformFee })
    .select().single();
  if (error) throw new Error(error.message);
  return { id: data.id, service: data.service, type: data.type, basePrice: Number(data.base_price), platformFee: Number(data.platform_fee), orgOverrides: [] };
}

export async function updatePricingRule(id: string, patch: { basePrice?: number; platformFee?: number }): Promise<void> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.basePrice !== undefined) dbPatch.base_price = patch.basePrice;
  if (patch.platformFee !== undefined) dbPatch.platform_fee = patch.platformFee;
  const { error } = await supabaseAdmin.from('pricing_rules').update(dbPatch).eq('id', id);
  if (error) throw new Error(error.message);
}

// ═══════════════════════════════════════════════════════════════════════════
// BANNERS
// ═══════════════════════════════════════════════════════════════════════════

export async function listBanners() {
  const { data, error } = await supabaseAdmin
    .from('banners').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({
    id: r.id, title: r.title, subtitle: r.subtitle, app: r.app, position: r.position,
    enabled: r.enabled, startDate: r.start_date, endDate: r.end_date, bgColor: r.bg_color,
    clicks: r.clicks ?? 0,
  }));
}

export async function updateBanner(id: string, patch: Record<string, unknown>): Promise<void> {
  const dbPatch: Record<string, unknown> = {};
  if ('title' in patch)     dbPatch.title = patch.title;
  if ('subtitle' in patch)  dbPatch.subtitle = patch.subtitle;
  if ('enabled' in patch)   dbPatch.enabled = patch.enabled;
  if ('startDate' in patch) dbPatch.start_date = patch.startDate;
  if ('endDate' in patch)   dbPatch.end_date = patch.endDate;
  if ('bgColor' in patch)   dbPatch.bg_color = patch.bgColor;
  const { error } = await supabaseAdmin.from('banners').update(dbPatch).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteBanner(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from('banners').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ═══════════════════════════════════════════════════════════════════════════
// FEATURE FLAGS  &  KILL SWITCHES
// ═══════════════════════════════════════════════════════════════════════════

export async function listFeatureFlags() {
  const { data, error } = await supabaseAdmin
    .from('feature_flags').select('*').order('category');
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({
    id: r.id, name: r.name, description: r.description, app: r.app, category: r.category,
    enabled: r.enabled, rolloutPercent: r.rollout_percent, orgOverrides: [], userOverrides: [],
    updatedAt: r.updated_at, updatedBy: r.updated_by,
  }));
}

export async function setFeatureFlag(id: string, enabled: boolean, rolloutPercent?: number): Promise<void> {
  const patch: Record<string, unknown> = { enabled, updated_at: new Date().toISOString() };
  if (rolloutPercent !== undefined) patch.rollout_percent = rolloutPercent;
  const { error } = await supabaseAdmin.from('feature_flags').update(patch).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function listKillSwitches() {
  const { data, error } = await supabaseAdmin
    .from('kill_switches').select('*').order('category');
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({
    id: r.id, name: r.name, description: r.description, category: r.category,
    enabled: r.enabled, lastToggled: r.last_toggled, toggledBy: r.toggled_by,
  }));
}

export async function setKillSwitch(id: string, enabled: boolean): Promise<void> {
  const { error } = await supabaseAdmin.from('kill_switches')
    .update({ enabled, last_toggled: new Date().toISOString(), toggled_by: 'Super Admin' })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

// ═══════════════════════════════════════════════════════════════════════════
// PUSH NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════

export async function listPushNotifications() {
  const { data, error } = await supabaseAdmin
    .from('push_notifications').select('*').order('sent_at', { ascending: false }).limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({
    id: r.id, title: r.title, body: r.body, audience: r.audience,
    sentAt: r.sent_at, delivered: r.delivered ?? 0, opened: r.opened ?? 0,
    failed: r.failed ?? 0, sendError: r.send_error ?? null,
  }));
}

// Expo's push service. Batches of at most 100 messages per request.
const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';
const EXPO_BATCH_SIZE = 100;

// An unrecognised audience resolves to NO recipients, never to "everyone".
// Getting this wrong sends a targeted message to the whole user base.
function rolesForAudience(audience: string): string[] | null {
  if (!(audience in PUSH_AUDIENCES)) return [];
  const roles = PUSH_AUDIENCES[audience];
  return roles === null ? null : [...roles];
}

type ExpoTicket = { status: string; message?: string; details?: { error?: string } };

// Push the message to Expo and report what actually happened. Never throws:
// the broadcast row is already saved, and a delivery failure must not lose it.
async function deliverViaExpo(
  tokens: { token: string }[],
  message: { title: string; body: string; data?: Record<string, unknown> },
): Promise<{ delivered: number; failed: number; dead: string[]; error: string | null }> {
  let delivered = 0;
  let failed = 0;
  const dead: string[] = [];

  for (let i = 0; i < tokens.length; i += EXPO_BATCH_SIZE) {
    const batch = tokens.slice(i, i + EXPO_BATCH_SIZE);
    try {
      const res = await fetch(EXPO_PUSH_ENDPOINT, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'accept-encoding': 'gzip, deflate',
          'content-type': 'application/json',
        },
        body: JSON.stringify(batch.map((t) => ({
          to: t.token,
          title: message.title,
          body: message.body,
          sound: 'default',
          data: message.data ?? {},
        }))),
      });
      const json = await res.json();
      const tickets: ExpoTicket[] = json?.data ?? [];
      tickets.forEach((ticket, idx) => {
        if (ticket?.status === 'ok') { delivered += 1; return; }
        failed += 1;
        // The app was uninstalled or the token rotated. Expo asks that we stop
        // sending to it, so retire the row rather than failing forever.
        if (ticket?.details?.error === 'DeviceNotRegistered') {
          dead.push(batch[idx].token);
        }
      });
      // A malformed request returns `errors` and no per-message tickets.
      if (!json?.data && json?.errors) {
        failed += batch.length;
        return { delivered, failed, dead, error: JSON.stringify(json.errors).slice(0, 500) };
      }
    } catch (e: any) {
      failed += batch.length;
      return { delivered, failed, dead, error: e?.message ?? 'Expo push request failed' };
    }
  }
  return { delivered, failed, dead, error: null };
}

export async function sendPushNotification(input: {
  title: string; body: string; audience: string;
}) {
  // Record the broadcast first — the in-app Notifications screens read this
  // table, so the message lands even for users with push turned off.
  const { data, error } = await supabaseAdmin.from('push_notifications')
    .insert({ title: input.title, body: input.body, audience: input.audience, delivered: 0, opened: 0 })
    .select().single();
  if (error) throw new Error(error.message);

  // Then fan out to real devices.
  let delivered = 0;
  let failed = 0;
  let sendError: string | null = null;
  try {
    const roles = rolesForAudience(input.audience);
    let q = supabaseAdmin.from('device_tokens').select('token').eq('enabled', true);
    if (roles) q = q.in('role', roles);
    const { data: tokens, error: tokErr } = await q;
    if (tokErr) throw tokErr;

    if ((tokens ?? []).length) {
      const result = await deliverViaExpo(tokens as { token: string }[], {
        title: input.title,
        body: input.body,
        data: { notificationId: data.id, screen: 'Notifications' },
      });
      delivered = result.delivered;
      failed = result.failed;
      sendError = result.error;
      if (result.dead.length) {
        await supabaseAdmin.from('device_tokens')
          .update({ enabled: false }).in('token', result.dead);
      }
    }
  } catch (e: any) {
    // migration-059 missing, or Expo unreachable. The broadcast row stands.
    sendError = e?.message ?? 'Push delivery unavailable';
  }

  try {
    await supabaseAdmin.from('push_notifications')
      .update({ delivered, failed, send_error: sendError })
      .eq('id', data.id);
  } catch (_) { /* `failed` / `send_error` need migration-059 */ }

  await writeAuditLog(
    'Sent push notification',
    'Notifications',
    `${input.audience}: ${input.title} (${delivered} delivered, ${failed} failed)`,
  );

  return {
    id: data.id, title: data.title, body: data.body, audience: data.audience,
    sentAt: data.sent_at, delivered, opened: 0, failed, sendError,
  };
}

// How many devices a given audience would actually reach right now, so the
// compose screen can say "will reach 412 devices" before anything is sent.
export async function countPushAudience(audience: string): Promise<number> {
  try {
    const roles = rolesForAudience(audience);
    let q = supabaseAdmin
      .from('device_tokens').select('id', { count: 'exact', head: true }).eq('enabled', true);
    if (roles) q = q.in('role', roles);
    const { count } = await q;
    return count ?? 0;
  } catch (_) {
    return 0;   // migration-059 not applied yet
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DEV TOOLS — seed & clean up test data (everything flagged is_test = true)
// ═══════════════════════════════════════════════════════════════════════════

const FIRST_NAMES = ['Arif', 'Sara', 'Raj', 'Nadia', 'Farhan', 'Priya', 'Imran', 'Ayesha', 'Karim', 'Mira'];
const LAST_NAMES = ['Hussain', 'Mehra', 'Patel', 'Kaur', 'Ali', 'Das', 'Chowdhury', 'Khan', 'Roy', 'Sen'];
const CITIES = ['Dhaka', 'Chittagong', 'Sylhet', 'Khulna', 'Rajshahi'];
const SPECIALTIES = ['General Physician', 'Cardiologist', 'Dermatologist', 'Orthopaedic', 'Paediatrician'];

// Test accounts log in with this password + an email derived from their phone.
// Must match the mobile apps' env.js (DEV_PASSWORD) and emailFromPhone().
const DEV_PASSWORD = 'Healio-Dev-1234';

const rand = (n: number) => Math.floor(Math.random() * n);
const pick = <T,>(arr: T[]): T => arr[rand(arr.length)];
// 10-digit phone starting with 9 (so the app's "91"+phone email matches)
const gen10 = () => '9' + String(100000000 + rand(899999999));
const emailFromPhone = (p10: string) => `91${p10}@healio.app`;
const fullName = () => `[TEST] ${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
const loginHint = (p10: string) => `Login: ${p10} · any OTP`;

// SeedRecord carries the login phone so Dev Tools can display it.
type SeedRecord = { type: string; label: string; detail: string; login?: string };

// Create (or reuse) an auth user for a 10-digit phone, with email+password so
// the mobile app can sign in. Returns the auth user id.
async function ensureAuthUser(p10: string): Promise<string> {
  const email = emailFromPhone(p10);
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email, password: DEV_PASSWORD, email_confirm: true,
    phone: `+91${p10}`, phone_confirm: true, user_metadata: { is_test: true },
  });
  if (!error) return data.user.id;
  // Already exists → look it up
  const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const found = list.users.find((u: any) => u.email === email);
  if (found) return found.id;
  throw new Error(error.message);
}

// Ensure at least one test org exists; return its id
async function ensureTestOrg(): Promise<string> {
  const { data: existing } = await supabaseAdmin
    .from('organisations').select('id').eq('is_test', true).limit(1).maybeSingle();
  if (existing?.id) return existing.id;
  const created = await seedTestOrgRow();
  return created.id;
}

// Creates a test hospital + a loginable hospital-admin account for it.
async function seedTestOrgRow() {
  const p10 = gen10();
  const adminId = await ensureAuthUser(p10);
  const city = pick(CITIES);
  const { data, error } = await supabaseAdmin.from('organisations').insert({
    name: `[TEST] ${city} Hospital`,
    type: 'hospital', city, country: 'IN',
    address: `${10 + rand(89)} Main Road, ${city}`,
    status: 'active', subscription: pick(['starter', 'growth', 'enterprise']),
    admin_user_id: adminId, admin_phone: `+91${p10}`, admin_email: emailFromPhone(p10),
    beds: 50 + rand(200), departments: ['General', 'Cardiology', 'Orthopaedics'],
    mrr: 10000 + rand(50000), is_test: true,
  }).select('id, name').single();
  if (error) throw new Error(error.message);
  return { ...data, phone: p10 };
}

const BLOOD = ['A+', 'B+', 'O+', 'AB+', 'A-', 'O-'];
const CONDITIONS = [[], ['Hypertension'], ['Diabetes Type 2'], ['Asthma'], ['Hypertension', 'Diabetes Type 2']];

async function seedTestPatientRow(orgId: string) {
  const p10 = gen10();
  const id = await ensureAuthUser(p10);
  const name = fullName();
  const year = 1965 + rand(40);
  const dob = `${year}-0${1 + rand(8)}-1${rand(8)}`;
  const { error: pe } = await supabaseAdmin.from('profiles').insert({
    id, name, phone: `+91${p10}`, email: emailFromPhone(p10),
    organisation_id: orgId, status: 'active', is_test: true,
    date_of_birth: dob, gender: pick(['Male', 'Female']),
    blood_group: pick(BLOOD), conditions: pick(CONDITIONS), healio_plus: true,
  });
  if (pe) throw new Error(pe.message);
  await supabaseAdmin.from('wallets').update({ balance: 500 + rand(2000) }).eq('patient_id', id);
  await supabaseAdmin.from('saved_addresses').insert({
    patient_id: id, label: 'Home', address: `${10 + rand(89)} ${pick(CITIES)} Road`, city: pick(CITIES), is_default: true,
  });
  return { id, name, phone: p10 };
}

async function seedTestProviderRow(orgId: string) {
  const p10 = gen10();
  const userId = await ensureAuthUser(p10);
  const name = `[TEST] Dr. ${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
  const { data, error } = await supabaseAdmin.from('staff').insert({
    staff_id: `DR-${Date.now().toString().slice(-5)}${rand(9)}`,
    user_id: userId, organisation_id: orgId, name, role: 'doctor', specialty: pick(SPECIALTIES),
    department: 'General', shift: 'Morning', phone: `+91${p10}`,
    email: emailFromPhone(p10), status: 'active',
    rating: 4 + Math.random(), verified_at: new Date().toISOString(), is_test: true,
  }).select('id, name').single();
  if (error) throw new Error(error.message);
  return { ...data, phone: p10 };
}

// Lightweight org list for the dev-tools custom account picker
export async function listOrgNames(): Promise<{ id: string; name: string }[]> {
  const { data } = await supabaseAdmin
    .from('organisations')
    .select('id, name')
    .eq('status', 'active')
    .order('name')
    .limit(50);
  return (data || []).map(o => ({ id: o.id, name: o.name }));
}

// Build a custom organisation with caller-supplied identity instead of the
// fully-randomized seedTestOrgRow() — for testing a specific kind of
// hospital/clinic/diagnostic-center setup (name, city, beds, departments,
// default consultation fee) rather than a random one.
export async function seedCustomOrg(opts: {
  name: string;
  city?: string;
  type?: 'hospital' | 'clinic' | 'diagnostic' | 'pharmacy';
  beds?: number;
  departments?: string[];
  consultationFee?: number;
}): Promise<SeedRecord> {
  const p10 = gen10();
  const adminId = await ensureAuthUser(p10);
  const city = opts.city?.trim() || pick(CITIES);
  const insertRow: Record<string, unknown> = {
    name: `[TEST] ${opts.name.trim()}`,
    type: opts.type || 'hospital', city, country: 'IN',
    address: `${10 + rand(89)} Main Road, ${city}`,
    status: 'active', subscription: pick(['starter', 'growth', 'enterprise']),
    admin_user_id: adminId, admin_phone: `+91${p10}`, admin_email: emailFromPhone(p10),
    beds: opts.beds ?? (50 + rand(200)),
    departments: opts.departments?.length ? opts.departments : ['General'],
    mrr: 10000 + rand(50000), is_test: true,
  };
  if (opts.consultationFee) insertRow.consultation_fee = opts.consultationFee;

  let { data, error } = await supabaseAdmin.from('organisations').insert(insertRow).select('id, name').single();
  if (error && /consultation_fee/i.test(error.message || '')) {
    // migration-009/025 not applied yet — retry without it.
    delete insertRow.consultation_fee;
    ({ data, error } = await supabaseAdmin.from('organisations').insert(insertRow).select('id, name').single());
  }
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Organisation created but no row was returned.');
  return { type: 'organisation', label: data.name, detail: `Hospital admin — ${loginHint(p10)}`, login: p10 };
}

// Public single-record seeders (used by preset & custom buttons)
export async function seedTestOrg(): Promise<SeedRecord> {
  const o = await seedTestOrgRow();
  return { type: 'organisation', label: o.name, detail: `Hospital admin — ${loginHint(o.phone)}`, login: o.phone };
}

export async function seedTestPatient(): Promise<SeedRecord> {
  const orgId = await ensureTestOrg();
  const p = await seedTestPatientRow(orgId);
  return { type: 'patient', label: p.name, detail: loginHint(p.phone), login: p.phone };
}

export async function seedTestProvider(): Promise<SeedRecord> {
  const orgId = await ensureTestOrg();
  const d = await seedTestProviderRow(orgId);
  return { type: 'provider', label: d.name, detail: `Doctor — ${loginHint(d.phone)}`, login: d.phone };
}

type CustomRole =
  | 'patient' | 'doctor' | 'opd_assistant' | 'pharmacy_assistant'
  | 'lab_technician' | 'nurse' | 'receptionist';

// Optional extras — providers use specialty/department/fee, patients use the
// rest. All optional so existing callers without them keep working.
type SeedExtra = {
  specialty?: string;
  department?: string;
  fee?: number;
  shift?: string;
  gender?: string;
  bloodGroup?: string;
  age?: number;
  walletBalance?: number;
};

export async function seedCustomAccount(
  role: CustomRole,
  name: string,
  phone?: string,
  orgId?: string,
  extra?: SeedExtra,
): Promise<SeedRecord> {
  // Use supplied orgId (a real hospital) or fall back to a test org
  const resolvedOrgId = orgId || await ensureTestOrg();

  // Use supplied phone (10 digits) or generate a random one
  const p10 = phone?.replace(/\D/g, '').slice(-10) || gen10();
  const userId = await ensureAuthUser(p10);

  if (role === 'patient') {
    const dob = extra?.age ? `${new Date().getFullYear() - extra.age}-01-01` : `${1965 + rand(40)}-0${1 + rand(8)}-1${rand(8)}`;
    await supabaseAdmin.from('profiles').insert({
      id: userId, name: `[TEST] ${name}`, phone: `+91${p10}`, email: emailFromPhone(p10),
      organisation_id: resolvedOrgId, status: 'active', is_test: true,
      date_of_birth: dob,
      gender: extra?.gender || pick(['Male', 'Female']),
      blood_group: extra?.bloodGroup || pick(BLOOD),
    });
    if (extra?.walletBalance) {
      await supabaseAdmin.from('wallets').update({ balance: extra.walletBalance }).eq('patient_id', userId);
    }
    return { type: 'patient', label: `[TEST] ${name}`, detail: loginHint(p10), login: p10 };
  }

  // Staff roles — covers every role StaffManagement.js / Operations.js let a
  // hospital admin create in the provider app.
  const ROLE_CONFIG: Record<string, { dbRole: string; idPrefix: string; label: string; dept: string }> = {
    doctor:              { dbRole: 'doctor',              idPrefix: 'DR',  label: 'Doctor',              dept: 'General'   },
    opd_assistant:       { dbRole: 'opd_assistant',       idPrefix: 'OPD', label: 'OPD Assistant',       dept: 'General'   },
    pharmacy_assistant:  { dbRole: 'pharmacy_assistant',  idPrefix: 'PH',  label: 'Pharmacy Assistant',  dept: 'Pharmacy'  },
    lab_technician:      { dbRole: 'lab_technician',      idPrefix: 'LT',  label: 'Lab Technician',      dept: 'Pathology' },
    nurse:               { dbRole: 'nurse',               idPrefix: 'NR',  label: 'Nurse / Home Care',   dept: 'Home Care' },
    receptionist:        { dbRole: 'receptionist',        idPrefix: 'RC',  label: 'Receptionist',        dept: 'General'   },
  };

  const cfg = ROLE_CONFIG[role];
  if (!cfg) throw new Error(`Unknown role: ${role}`);

  const { data, error } = await supabaseAdmin.from('staff').insert({
    staff_id: `${cfg.idPrefix}-${Date.now().toString().slice(-5)}${rand(9)}`,
    user_id: userId, organisation_id: resolvedOrgId, name: `[TEST] ${name}`,
    role: cfg.dbRole, department: extra?.department?.trim() || cfg.dept, shift: extra?.shift || 'Morning',
    phone: `+91${p10}`, email: emailFromPhone(p10),
    status: 'active', verified_at: new Date().toISOString(), is_test: true,
    ...(role === 'doctor' ? {
      specialty: extra?.specialty || pick(SPECIALTIES),
      rating: 4 + Math.random(),
      ...(extra?.fee ? { consultation_fee: extra.fee } : {}),
    } : {}),
  }).select('name').single();
  if (error) throw new Error(error.message);
  return {
    type: 'provider',
    label: data.name,
    detail: `${cfg.label} — ${loginHint(p10)}`,
    login: p10,
  };
}

// Scenario seeders — create multiple linked records
export async function seedScenario(scenario: string): Promise<SeedRecord[]> {
  const out: SeedRecord[] = [];

  if (scenario === 'onboarding') {
    const name = `[TEST] ${pick(CITIES)} Diagnostics`;
    const { error } = await supabaseAdmin.from('onboarding_queue').insert({
      name, type: 'diagnostic', city: pick(CITIES), country: 'IN',
      admin_phone: `+91${gen10()}`, admin_email: `test.${rand(99999)}@healio.dev`,
      contact_name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
      documents: ['Business License', 'Tax Certificate'],
      notes: 'Test onboarding application.', status: 'pending', is_test: true,
    });
    if (error) throw new Error(error.message);
    out.push({ type: 'organisation', label: name, detail: 'Onboarding application (pending)' });
    return out;
  }

  if (scenario === 'appointment') {
    const orgId = await ensureTestOrg();
    const patient = await seedTestPatientRow(orgId);
    const doctor = await seedTestProviderRow(orgId);
    const { error } = await supabaseAdmin.from('appointments').insert({
      patient_id: patient.id, doctor_staff_id: doctor.id, organisation_id: orgId,
      type: 'clinic', status: 'scheduled',
      scheduled_at: new Date(Date.now() + 3600000 * 24).toISOString(),
      fee: 300, platform_fee: 20, is_test: true,
    });
    if (error) throw new Error(error.message);
    out.push({ type: 'patient', label: patient.name, detail: 'Test patient' });
    out.push({ type: 'provider', label: doctor.name, detail: 'Test doctor' });
    out.push({ type: 'appointment', label: 'Scheduled appointment', detail: `${patient.name} → ${doctor.name}` });
    return out;
  }

  if (scenario === 'order') {
    const orgId = await ensureTestOrg();
    const patient = await seedTestPatientRow(orgId);
    await supabaseAdmin.from('pharmacy_orders').insert({
      patient_id: patient.id, organisation_id: orgId, status: 'pending',
      items: [{ name: 'Paracetamol 500mg', quantity: 2, unit_price: 18 }],
      total: 56, is_test: true,
    });
    await supabaseAdmin.from('lab_orders').insert({
      patient_id: patient.id, organisation_id: orgId, status: 'pending',
      tests: [{ name: 'CBC', price: 150 }], collection_type: 'walkin',
      scheduled_date: new Date().toISOString().split('T')[0], scheduled_time: '09:00 AM',
      total: 150, is_test: true,
    });
    await supabaseAdmin.from('homecare_orders').insert({
      patient_id: patient.id, organisation_id: orgId, status: 'pending',
      service_name: 'Nurse Visit', scheduled_date: new Date().toISOString().split('T')[0],
      scheduled_time: '10:00 AM', address: 'Test address', total: 350, is_test: true,
    });
    out.push({ type: 'patient', label: patient.name, detail: 'Test patient' });
    out.push({ type: 'order', label: 'Pharmacy order', detail: patient.name });
    out.push({ type: 'order', label: 'Lab order', detail: patient.name });
    out.push({ type: 'order', label: 'Home care order', detail: patient.name });
    return out;
  }

  if (scenario === 'dispute') {
    const orgId = await ensureTestOrg();
    const patient = await seedTestPatientRow(orgId);
    const doctor = await seedTestProviderRow(orgId);
    await supabaseAdmin.from('appointments').insert({
      patient_id: patient.id, doctor_staff_id: doctor.id, organisation_id: orgId,
      type: 'clinic', status: 'completed',
      scheduled_at: new Date(Date.now() - 3600000 * 48).toISOString(),
      fee: 300, platform_fee: 20, is_test: true,
    });
    await supabaseAdmin.from('refunds').insert({
      patient_id: patient.id, organisation_id: orgId, amount: 300,
      reason: 'Test refund — service issue', status: 'pending', method: 'wallet', is_test: true,
    });
    await supabaseAdmin.from('disputes').insert({
      patient_id: patient.id, organisation_id: orgId,
      subject: 'Test dispute — refund not received', category: 'Refund',
      priority: 'high', status: 'open', is_test: true,
    });
    out.push({ type: 'patient', label: patient.name, detail: 'Test patient' });
    out.push({ type: 'appointment', label: 'Completed appointment', detail: patient.name });
    out.push({ type: 'order', label: 'Pending refund', detail: patient.name });
    out.push({ type: 'order', label: 'Open dispute', detail: patient.name });
    return out;
  }

  return out;
}

// Count current test records (for the header badge)
export async function countTestData(): Promise<number> {
  // Count rows flagged is_test=true across every relevant table.
  // Also count appointments/orders linked to test orgs (patient-created rows aren't flagged).
  const directTables = ['organisations', 'profiles', 'staff',
    'pharmacy_orders', 'lab_orders', 'homecare_orders',
    'onboarding_queue', 'refunds', 'disputes', 'transactions'];

  let total = 0;
  for (const t of directTables) {
    try {
      const { count } = await supabaseAdmin
        .from(t).select('id', { count: 'exact', head: true }).eq('is_test', true);
      total += count ?? 0;
    } catch { /* column may not exist on every table */ }
  }

  // Appointments: also count ones linked to test orgs (patient app doesn't set is_test)
  try {
    const { data: testOrgIds } = await supabaseAdmin
      .from('organisations').select('id').eq('is_test', true);
    const orgIds = (testOrgIds ?? []).map((o: any) => o.id).filter(Boolean);
    if (orgIds.length) {
      const { count } = await supabaseAdmin
        .from('appointments').select('id', { count: 'exact', head: true })
        .in('organisation_id', orgIds);
      total += count ?? 0;
    } else {
      // Fallback: direct is_test flag on appointments
      const { count } = await supabaseAdmin
        .from('appointments').select('id', { count: 'exact', head: true }).eq('is_test', true);
      total += count ?? 0;
    }
  } catch { }

  return total;
}

// Delete every test record in FK-safe order + their Supabase auth users.
// Throws a descriptive error string on any failure so the UI can display it.
export async function cleanupTestData(): Promise<number> {
  const errors: string[] = [];

  // ── Step 1: collect IDs we need ─────────────────────────────────────────────
  const [{ data: testProfiles }, { data: testStaff }, { data: testOrgs }] = await Promise.all([
    supabaseAdmin.from('profiles').select('id').eq('is_test', true),
    supabaseAdmin.from('staff').select('user_id').eq('is_test', true),
    supabaseAdmin.from('organisations').select('id, admin_user_id').eq('is_test', true),
  ]);

  const authIds   = new Set<string>();
  const testOrgIds = (testOrgs ?? []).map((o: any) => o.id).filter(Boolean) as string[];
  const testProfileIds = (testProfiles ?? []).map((p: any) => p.id).filter(Boolean) as string[];

  (testProfiles ?? []).forEach((p: any) => p.id            && authIds.add(p.id));
  (testStaff   ?? []).forEach((s: any) => s.user_id        && authIds.add(s.user_id));
  (testOrgs    ?? []).forEach((o: any) => o.admin_user_id  && authIds.add(o.admin_user_id));

  // Helper: delete from a table and record any error
  const del = async (table: string, filter: Record<string, any>) => {
    try {
      let q = supabaseAdmin.from(table).delete();
      for (const [col, val] of Object.entries(filter)) {
        if (Array.isArray(val)) q = (q as any).in(col, val);
        else                    q = (q as any).eq(col, val);
      }
      const { error } = await q;
      if (error) errors.push(`${table}: ${error.message}`);
    } catch (e: any) {
      errors.push(`${table}: ${e?.message ?? 'unknown error'}`);
    }
  };

  // ── Step 2: delete leaf tables first (nothing else references them) ──────────

  // Appointments: delete both is_test=true AND those linked to test orgs
  // (patient-app bookings don't carry is_test — they're identified by org)
  if (testOrgIds.length) {
    await del('appointments', { organisation_id: testOrgIds });
  }
  await del('appointments', { is_test: true });

  // Orders linked to test orgs or flagged directly
  if (testOrgIds.length) {
    await del('pharmacy_orders',  { organisation_id: testOrgIds });
    await del('lab_orders',       { organisation_id: testOrgIds });
    await del('homecare_orders',  { organisation_id: testOrgIds });
  }
  await del('pharmacy_orders',  { is_test: true });
  await del('lab_orders',       { is_test: true });
  await del('homecare_orders',  { is_test: true });

  await del('refunds',          { is_test: true });
  await del('disputes',         { is_test: true });
  await del('transactions',     { is_test: true });

  // health_records and wallets reference profiles — delete by patient_id before profiles.
  // These tables have no is_test column, so we only delete via the patient_id link.
  if (testProfileIds.length) {
    await del('health_records', { patient_id: testProfileIds });
    await del('wallets',        { patient_id: testProfileIds });
  }

  // ── Step 3: delete parent tables ────────────────────────────────────────────
  await del('profiles',        { is_test: true });
  await del('staff',           { is_test: true });
  await del('onboarding_queue',{ is_test: true });
  await del('organisations',   { is_test: true });

  // ── Step 4: delete Supabase auth users ───────────────────────────────────────
  for (const id of authIds) {
    try { await supabaseAdmin.auth.admin.deleteUser(id); } catch { /* ignore */ }
  }

  if (errors.length) throw new Error(errors.join('\n'));
  return authIds.size;
}

// ═══════════════════════════════════════════════════════════════════════════
// FULL PLATFORM WIPE
//
// cleanupTestData() above only removes rows flagged is_test = true. This is the
// other thing: empty the platform of REAL data before go-live, while leaving
// the admin panel itself standing.
//
// KEPT   sub_admins + their auth users, features, platform_settings,
//        pricing_rules, banners, lab_tests, sla_rules, audit_logs
// WIPED  every organisation, staff member, patient, consultant, appointment,
//        order, prescription, record, transaction, wallet, dispute, onboarding
//        application — and every auth user that is not an admin.
//
// Irreversible. The UI gates it behind a typed confirmation.
// ═══════════════════════════════════════════════════════════════════════════

export type WipeReport = {
  tables: { table: string; deleted: number; error: string | null }[];
  authUsersDeleted: number;
  adminsKept: number;
  totalDeleted: number;
  errors: string[];
};

// Child-before-parent. Every table here is data ABOUT the platform's users;
// nothing in this list is configuration.
const WIPE_ORDER = [
  // Conversation / audit children first
  'dispute_messages',
  'sla_escalations',
  'rmp_commissions',
  'rmp_patients',
  'record_notes',
  'wallet_adjustments',
  // Clinical + commercial records
  'prescriptions',
  'health_records',
  'qr_checkins',
  'patient_qr_tokens',
  'emergency_admissions',
  'doctor_schedule_exceptions',
  'doctor_schedules',
  'appointments',
  'pharmacy_orders',
  'lab_orders',
  'homecare_orders',
  'refunds',
  'disputes',
  'transactions',
  'payouts',
  'wallets',
  'saved_addresses',
  'family_profiles',
  // People
  'device_tokens',
  'rmps',
  'staff',
  'profiles',
  // Tenants
  'onboarding_queue',
  'organisations',
] as const;

// PostgREST refuses an unfiltered DELETE, so every wipe needs a predicate that
// is true for every row. `id` covers all but two tables: rmp_patients has a
// composite key and no id at all, and patient_qr_tokens keys on `token`.
const WIPE_KEY: Record<string, string> = {
  rmp_patients: 'rmp_id',
  patient_qr_tokens: 'token',
};

async function wipeTable(table: string): Promise<{ table: string; deleted: number; error: string | null }> {
  const key = WIPE_KEY[table] ?? 'id';
  try {
    const { count: before, error: countErr } = await supabaseAdmin
      .from(table).select(key, { count: 'exact', head: true });
    // Table absent on this project (its migration was never run) — nothing to
    // wipe, and not a failure worth reporting.
    if (countErr) return { table, deleted: 0, error: null };
    if (!before) return { table, deleted: 0, error: null };

    const { error } = await supabaseAdmin
      .from(table).delete().not(key, 'is', null);
    if (error) return { table, deleted: 0, error: error.message };

    const { count: after } = await supabaseAdmin
      .from(table).select(key, { count: 'exact', head: true });
    return { table, deleted: (before ?? 0) - (after ?? 0), error: null };
  } catch (e: any) {
    return { table, deleted: 0, error: null };
  }
}

export async function wipeAllPlatformData(): Promise<WipeReport> {
  const errors: string[] = [];

  // 1. Who must survive, so the panel can still be logged into afterwards.
  //
  //    The sub_admins TABLE is not the whole answer. The bootstrap super admin
  //    is created by supabase/create-admin-user.mjs, which writes an auth user
  //    carrying user_metadata.role = 'super_admin' and no sub_admins row at
  //    all. An earlier version of this function keyed only on sub_admins and
  //    duly deleted the one account that could log in — the wipe succeeded and
  //    locked the operator out of their own panel.
  //
  //    So: keep anyone listed in sub_admins, AND anyone whose auth metadata
  //    marks them as an admin.
  const { data: admins } = await supabaseAdmin.from('sub_admins').select('user_id, email');
  const keepIds = new Set<string>();
  const keepEmails = new Set<string>();
  (admins ?? []).forEach((a: any) => {
    if (a.user_id) keepIds.add(a.user_id);
    if (a.email) keepEmails.add(String(a.email).toLowerCase());
  });

  const isAdminAccount = (u: any) => {
    const meta = u?.user_metadata ?? {};
    return meta.role === 'super_admin' || meta.kind === 'sub_admin';
  };

  // Last line of defence: if this wipe would leave no way into the admin panel,
  // stop before deleting anything. Recovering means re-running a script with the
  // service-role key, which is exactly the situation an operator is least able
  // to handle right after wiping their platform.
  try {
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const survivors = (list?.users ?? []).filter((u: any) =>
      keepIds.has(u.id)
      || keepEmails.has((u.email ?? '').toLowerCase())
      || isAdminAccount(u));
    if (survivors.length === 0) {
      throw new Error(
        'Refusing to wipe: no admin account would survive. Create one first '
        + '(node ../supabase/create-admin-user.mjs <email> <password>), or add a '
        + 'row to sub_admins, otherwise this wipe would lock you out of the panel.',
      );
    }
  } catch (e: any) {
    // A genuine guard failure must stop the wipe; a listUsers outage must too,
    // because we cannot prove anyone would be left.
    throw new Error(e?.message ?? 'Could not verify an admin account would survive the wipe.');
  }

  // 2. Delete the data tables, children first.
  const tables: WipeReport['tables'] = [];
  for (const t of WIPE_ORDER) {
    const result = await wipeTable(t);
    tables.push(result);
    if (result.error) errors.push(`${t}: ${result.error}`);
  }

  // 3. Delete every non-admin auth user.
  //
  //    Always re-reads page 1: each delete shifts the remaining users up, so
  //    paging forward would step over accounts. The pass ends when a full
  //    sweep finds nothing left to delete — or when only admins remain.
  let authUsersDeleted = 0;
  try {
    for (let pass = 0; pass < 200; pass++) {
      const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
      if (error) { errors.push(`auth.listUsers: ${error.message}`); break; }

      const users = list?.users ?? [];
      const deletable = users.filter((u: any) =>
        !keepIds.has(u.id)
        && !keepEmails.has((u.email ?? '').toLowerCase())
        && !isAdminAccount(u));
      if (deletable.length === 0) break;

      let deletedThisPass = 0;
      for (const u of deletable) {
        try {
          await supabaseAdmin.auth.admin.deleteUser(u.id);
          authUsersDeleted += 1;
          deletedThisPass += 1;
        } catch (e: any) {
          // Record once and keep going; a single stuck account must not abort
          // the wipe, but an endless retry loop would.
          errors.push(`auth user ${u.email || u.id}: ${e?.message ?? 'delete failed'}`);
          keepIds.add(u.id);
        }
      }
      if (deletedThisPass === 0) break;
    }
  } catch (e: any) {
    errors.push(`auth cleanup: ${e?.message ?? 'unknown error'}`);
  }

  const totalDeleted = tables.reduce((n, t) => n + t.deleted, 0);
  await writeAuditLog(
    "Wiped all platform data",
    "Danger Zone",
    `${totalDeleted} rows, ${authUsersDeleted} auth users (${keepIds.size} admins kept)`,
  );

  return {
    tables,
    authUsersDeleted,
    adminsKept: keepIds.size,
    totalDeleted,
    errors,
  };
}

// What the confirmation dialog shows before anything is destroyed.
//
// `survivingAdmins` is the important half. The first version of this feature
// reported only row counts, so there was no way to notice that the account you
// were logged in with was about to be deleted — which is exactly what happened.
export type WipePreview = {
  tables: { table: string; rows: number }[];
  survivingAdmins: string[];
};

export async function previewWipe(): Promise<WipePreview> {
  const tables: { table: string; rows: number }[] = [];
  for (const t of WIPE_ORDER) {
    try {
      const key = WIPE_KEY[t] ?? 'id';
      const { count, error } = await supabaseAdmin
        .from(t).select(key, { count: 'exact', head: true });
      if (!error && count) tables.push({ table: t, rows: count });
    } catch (_) { /* table not present on this project */ }
  }
  tables.sort((a, b) => b.rows - a.rows);

  // Mirror wipeAllPlatformData's keep rules exactly, or the preview lies.
  const survivingAdmins: string[] = [];
  try {
    const { data: subAdmins } = await supabaseAdmin.from('sub_admins').select('user_id, email');
    const keepIds = new Set((subAdmins ?? []).map((a: any) => a.user_id).filter(Boolean));
    const keepEmails = new Set(
      (subAdmins ?? []).map((a: any) => String(a.email ?? '').toLowerCase()).filter(Boolean),
    );
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    (list?.users ?? []).forEach((u: any) => {
      const meta = u.user_metadata ?? {};
      const kept = keepIds.has(u.id)
        || keepEmails.has((u.email ?? '').toLowerCase())
        || meta.role === 'super_admin'
        || meta.kind === 'sub_admin';
      if (kept && u.email) survivingAdmins.push(u.email);
    });
  } catch (_) { /* leave empty; the UI treats that as a blocker */ }

  return { tables, survivingAdmins };
}

// ═══════════════════════════════════════════════════════════════════════════
// SIDEBAR BADGE COUNTS  (live counts for the nav badges)
// ═══════════════════════════════════════════════════════════════════════════

export async function getSidebarCounts() {
  const startToday = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString(); })();
  const [onboarding, disputes, refunds, orders, appts] = await Promise.all([
    supabaseAdmin.from('onboarding_queue').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabaseAdmin.from('disputes').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    supabaseAdmin.from('refunds').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabaseAdmin.from('pharmacy_orders').select('id', { count: 'exact', head: true }).in('status', ['pending', 'confirmed', 'processing']),
    supabaseAdmin.from('appointments').select('id', { count: 'exact', head: true }).gte('scheduled_at', startToday),
  ]);
  return {
    onboarding: onboarding.count ?? 0,
    disputes: disputes.count ?? 0,
    refunds: refunds.count ?? 0,
    orders: orders.count ?? 0,
    appointmentsToday: appts.count ?? 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// FEATURES  (unified on/off toggles — replaces flags + kill switches + services)
// ═══════════════════════════════════════════════════════════════════════════

export type Feature = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  app: 'patient' | 'provider' | 'both';
  category: 'product' | 'service' | 'system';
  audience: FeatureAudience;
  sortOrder: number;
  enabled: boolean;
  updatedAt: string | null;
};

export async function listFeatures(): Promise<Feature[]> {
  const { data, error } = await supabaseAdmin
    .from('features')
    .select('*')
    .order('name');
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({
    id: r.id,
    key: r.key,
    name: r.name,
    description: r.description ?? null,
    app: r.app,
    category: r.category,
    // Fall back to 'platform' rather than 'patient' when migration-060 hasn't
    // been applied: an unclassified switch showing up under "Patient App"
    // would be an actively wrong claim about who it affects.
    audience: (FEATURE_AUDIENCES as readonly string[]).includes(r.audience)
      ? (r.audience as FeatureAudience)
      : 'platform',
    sortOrder: Number(r.sort_order ?? 100),
    enabled: !!r.enabled,
    updatedAt: r.updated_at ?? null,
  }));
}

export async function setFeature(id: string, enabled: boolean): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from('features')
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('name')
    .single();
  if (error) throw new Error(error.message);
  await writeAuditLog(`${enabled ? 'Enabled' : 'Disabled'} feature`, 'Features', data?.name ?? '');
}

// ═══════════════════════════════════════════════════════════════════════════
// PLATFORM SETTINGS  (single-row global config)
// ═══════════════════════════════════════════════════════════════════════════

export type PlatformSettings = {
  platformName: string;
  supportEmail: string;
  minWalletBalance: number;
  sessionTimeout: number;
  maintenanceMode: boolean;
  twoFactor: boolean;
  auditLogging: boolean;
  emailNotifs: boolean;
  slackNotifs: boolean;
};

export async function getPlatformSettings(): Promise<PlatformSettings> {
  const { data, error } = await supabaseAdmin
    .from('platform_settings').select('*').eq('id', 1).maybeSingle();
  if (error) throw new Error(error.message);
  const r = data ?? {};
  return {
    platformName: r.platform_name ?? 'Healio',
    supportEmail: r.support_email ?? 'support@healio.in',
    minWalletBalance: Number(r.min_wallet_balance ?? 50),
    sessionTimeout: Number(r.session_timeout ?? 30),
    maintenanceMode: r.maintenance_mode ?? false,
    twoFactor: r.two_factor ?? true,
    auditLogging: r.audit_logging ?? true,
    emailNotifs: r.email_notifs ?? true,
    slackNotifs: r.slack_notifs ?? false,
  };
}

export async function savePlatformSettings(s: PlatformSettings): Promise<void> {
  const { error } = await supabaseAdmin.from('platform_settings').upsert({
    id: 1,
    platform_name: s.platformName,
    support_email: s.supportEmail,
    min_wallet_balance: s.minWalletBalance,
    session_timeout: s.sessionTimeout,
    maintenance_mode: s.maintenanceMode,
    two_factor: s.twoFactor,
    audit_logging: s.auditLogging,
    email_notifs: s.emailNotifs,
    slack_notifs: s.slackNotifs,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  await writeAuditLog('Updated platform settings', 'Settings', '');
}

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD / ANALYTICS / REVENUE  — real aggregates
// ═══════════════════════════════════════════════════════════════════════════

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const daysAgo = (n: number) => { const d = startOfToday(); d.setDate(d.getDate() - n); return d; };
const dayKey = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

// Command-centre stat cards + side panels.
export async function getDashboardStats() {
  const todayIso = startOfToday().toISOString();
  const [orgs, appts, orders, txns, disputes, switches, patients] = await Promise.all([
    supabaseAdmin.from('organisations').select('id, name, city, status, provider_count'),
    supabaseAdmin.from('appointments').select('id, status, fee, scheduled_at, profiles(name), staff(name), organisations(name), type'),
    supabaseAdmin.from('pharmacy_orders').select('id, status, created_at'),
    supabaseAdmin.from('transactions').select('amount, type, created_at'),
    supabaseAdmin.from('disputes').select('id, status'),
    supabaseAdmin.from('kill_switches').select('name, enabled').order('category'),
    supabaseAdmin.from('profiles').select('id'),
  ]);

  const apptRows = appts.data ?? [];
  const orderRows = orders.data ?? [];
  const txnRows = txns.data ?? [];

  const apptsToday = apptRows.filter((a: any) => a.scheduled_at >= todayIso);
  const revenueToday = txnRows
    .filter((t: any) => t.created_at >= todayIso && (t.type === 'payment' || t.type === 'topup'))
    .reduce((s: number, t: any) => s + Number(t.amount || 0), 0);
  const pendingOrders = orderRows.filter((o: any) => ['pending', 'confirmed', 'processing'].includes(o.status)).length;
  const openDisputes = (disputes.data ?? []).filter((d: any) => d.status === 'open').length;
  const activeOrgs = (orgs.data ?? []).filter((o: any) => o.status === 'active').length;

  // 7-day revenue + appts + orders series
  const series: Record<string, { date: string; revenue: number; appointments: number; orders: number }> = {};
  for (let i = 6; i >= 0; i--) { const d = daysAgo(i); series[dayKey(d)] = { date: dayKey(d), revenue: 0, appointments: 0, orders: 0 }; }
  const since = daysAgo(6).toISOString();
  txnRows.filter((t: any) => t.created_at >= since).forEach((t: any) => {
    const k = dayKey(new Date(t.created_at));
    if (series[k] && (t.type === 'payment' || t.type === 'topup')) series[k].revenue += Number(t.amount || 0);
  });
  apptRows.filter((a: any) => a.scheduled_at >= since).forEach((a: any) => {
    const k = dayKey(new Date(a.scheduled_at)); if (series[k]) series[k].appointments += 1;
  });
  orderRows.filter((o: any) => o.created_at >= since).forEach((o: any) => {
    const k = dayKey(new Date(o.created_at)); if (series[k]) series[k].orders += 1;
  });

  return {
    stats: {
      activePatients: (patients.data ?? []).length,
      appointmentsToday: apptsToday.length,
      pendingOrders,
      revenueToday,
      openDisputes,
      activeOrgs,
    },
    series: Object.values(series),
    killSwitches: (switches.data ?? []).map((s: any) => ({ name: s.name, enabled: s.enabled })),
    orgs: (orgs.data ?? []).map((o: any) => ({
      id: o.id, name: o.name, city: o.city, status: o.status, providerCount: o.provider_count ?? 0,
    })),
    appointments: apptsToday.map((a: any) => ({
      id: a.id, patientName: a.profiles?.name ?? '—', providerName: a.staff?.name ?? '—',
      orgName: a.organisations?.name ?? '—', type: a.type, fee: Number(a.fee || 0),
      scheduledAt: a.scheduled_at, status: a.status,
    })),
  };
}

// Platform analytics — totals + breakdowns.
export async function getAnalytics() {
  const [patients, providers, orgs, appts, orders, txns] = await Promise.all([
    supabaseAdmin.from('profiles').select('id, created_at'),
    supabaseAdmin.from('staff').select('id, role'),
    supabaseAdmin.from('organisations').select('id, status'),
    supabaseAdmin.from('appointments').select('id, status, type, fee, scheduled_at'),
    supabaseAdmin.from('pharmacy_orders').select('id, total, status'),
    supabaseAdmin.from('transactions').select('amount, type, created_at'),
  ]);
  const apptRows = appts.data ?? [];
  const txnRows = txns.data ?? [];

  const grossRevenue = txnRows
    .filter((t: any) => t.type === 'payment' || t.type === 'topup')
    .reduce((s: number, t: any) => s + Number(t.amount || 0), 0);

  const byType: Record<string, number> = {};
  apptRows.forEach((a: any) => { byType[a.type || 'clinic'] = (byType[a.type || 'clinic'] || 0) + 1; });

  const roleCounts: Record<string, number> = {};
  (providers.data ?? []).forEach((p: any) => { roleCounts[p.role] = (roleCounts[p.role] || 0) + 1; });

  // New patients per day, last 14 days
  const reg: Record<string, { date: string; count: number }> = {};
  for (let i = 13; i >= 0; i--) { const d = daysAgo(i); reg[dayKey(d)] = { date: dayKey(d), count: 0 }; }
  const since = daysAgo(13).toISOString();
  (patients.data ?? []).filter((p: any) => p.created_at >= since).forEach((p: any) => {
    const k = dayKey(new Date(p.created_at)); if (reg[k]) reg[k].count += 1;
  });

  return {
    totals: {
      patients: (patients.data ?? []).length,
      providers: (providers.data ?? []).length,
      organisations: (orgs.data ?? []).length,
      appointments: apptRows.length,
      orders: (orders.data ?? []).length,
      grossRevenue,
      completedAppointments: apptRows.filter((a: any) => a.status === 'completed').length,
    },
    appointmentsByType: Object.entries(byType).map(([name, value]) => ({ name, value })),
    providersByRole: Object.entries(roleCounts).map(([name, value]) => ({ name, value })),
    registrations: Object.values(reg),
  };
}

// Revenue report — 30-day trend + breakdown by source + recent transactions.
export async function getRevenueReport() {
  const since = daysAgo(29).toISOString();
  const [txns, appts, orders] = await Promise.all([
    supabaseAdmin.from('transactions').select('amount, type, created_at, organisations(name)').order('created_at', { ascending: false }),
    supabaseAdmin.from('appointments').select('fee, platform_fee, status, scheduled_at'),
    supabaseAdmin.from('pharmacy_orders').select('total, status, created_at'),
  ]);
  const txnRows = txns.data ?? [];

  const trend: Record<string, { date: string; revenue: number }> = {};
  for (let i = 29; i >= 0; i--) { const d = daysAgo(i); trend[dayKey(d)] = { date: dayKey(d), revenue: 0 }; }
  txnRows.filter((t: any) => t.created_at >= since && (t.type === 'payment' || t.type === 'topup')).forEach((t: any) => {
    const k = dayKey(new Date(t.created_at)); if (trend[k]) trend[k].revenue += Number(t.amount || 0);
  });

  const consultRevenue = (appts.data ?? [])
    .filter((a: any) => a.status === 'completed')
    .reduce((s: number, a: any) => s + Number(a.fee || 0), 0);
  const platformFees = (appts.data ?? [])
    .filter((a: any) => a.status === 'completed')
    .reduce((s: number, a: any) => s + Number(a.platform_fee || 0), 0);
  const orderRevenue = (orders.data ?? [])
    .filter((o: any) => ['completed', 'dispensed', 'delivered'].includes(o.status))
    .reduce((s: number, o: any) => s + Number(o.total || 0), 0);
  const walletTopups = txnRows
    .filter((t: any) => t.type === 'topup')
    .reduce((s: number, t: any) => s + Number(t.amount || 0), 0);

  return {
    trend: Object.values(trend),
    breakdown: [
      { source: 'Consultations', amount: consultRevenue },
      { source: 'Orders', amount: orderRevenue },
      { source: 'Wallet Top-ups', amount: walletTopups },
      { source: 'Platform Fees', amount: platformFees },
    ],
    totals: {
      gross: consultRevenue + orderRevenue,
      platformFees,
      topups: walletTopups,
    },
    recent: txnRows.slice(0, 20).map((t: any) => ({
      amount: Number(t.amount || 0), type: t.type, orgName: t.organisations?.name ?? '—', createdAt: t.created_at,
    })),
  };
}
