// ─────────────────────────────────────────────────────────────────────────────
// Client-facing API surface.
// Thin wrapper that maps the existing orgApi/patientApi/… object shape onto the
// real server actions in ./actions. Safe to import from client components — the
// actual DB work (and the service-role key) stays on the server.
//
// Reads go through `cached()` and writes through `invalidating()` (see
// ./cache). Pages fetch in a useEffect on mount and App Router remounts them on
// every client-side navigation, so without this layer moving between sections
// re-queried Supabase every time. Nothing in a page component had to change.
//
// The rule when adding to this file: a read gets a tag, and every write that
// could alter what that read returns must list the same tag. A write with no
// tags will silently serve stale data for up to a minute.
// ─────────────────────────────────────────────────────────────────────────────
import * as a from './actions';
import { cached, invalidating, invalidateAll } from './cache';

// ── Organisations ─────────────────────────────────────────────────────────────
export const orgApi = {
  list: cached('orgs', a.listOrgs),
  create: invalidating(['orgs'], a.createOrg),
  // Suspending an org cascades to its staff, so both tags go.
  approve: invalidating(['orgs', 'staff', 'individualProviders'],
    (id: string) => a.setOrgStatus(id, 'active')),
  suspend: invalidating(['orgs', 'staff', 'individualProviders'],
    (id: string, reason?: string) => a.setOrgStatus(id, 'suspended', reason)),
  delete: invalidating(['orgs', 'staff', 'individualProviders'], a.deleteOrg),
  documents: cached('orgs', a.getOrgDocuments),
  detail: cached('orgs', a.getOrgDetail),
};

// ── Individual / standalone providers (solo doctors, labs, pharmacies) ────────
export const individualProviderApi = {
  list: cached('individualProviders', a.listIndividualProviders),
  detail: cached('individualProviders', a.getIndividualProviderDetail),
  enable: invalidating(['individualProviders', 'orgs', 'staff'],
    (id: string) => a.setIndividualProviderStatus(id, true)),
  disable: invalidating(['individualProviders', 'orgs', 'staff'],
    (id: string, reason?: string) => a.setIndividualProviderStatus(id, false, reason)),
};

// ── Org staff ─────────────────────────────────────────────────────────────────
export const staffApi = {
  listByOrg: cached('staff', a.listOrgStaff),
  create: invalidating(['staff', 'orgs', 'providers'], a.createOrgStaff),
  activate: invalidating(['staff', 'providers'], (id: string) => a.setStaffStatus(id, 'active')),
  deactivate: invalidating(['staff', 'providers'], (id: string) => a.setStaffStatus(id, 'inactive')),
};

// ── Onboarding queue ──────────────────────────────────────────────────────────
export const onboardingApi = {
  list: cached('onboarding', a.listOnboarding),
  // Approval creates an organisation, so it moves the org lists too.
  approveOrg: invalidating(['onboarding', 'orgs', 'individualProviders', 'navCounts'], a.approveOnboarding),
  rejectOrg: invalidating(['onboarding', 'navCounts'], a.rejectOnboarding),
};

// ── Patients ──────────────────────────────────────────────────────────────────
export const patientApi = {
  list: cached('patients', a.listPatients),
  ban: invalidating(['patients'], (id: string) => a.setPatientStatus(id, 'banned')),
  unban: invalidating(['patients'], (id: string) => a.setPatientStatus(id, 'active')),
  adjustWallet: invalidating(['patients', 'transactions'], a.adjustPatientWallet),
  remove: invalidating(['patients'], a.deletePatient),
};

// ── Providers ─────────────────────────────────────────────────────────────────
export const providerApi = {
  list: cached('providers', a.listProviders),
  // Server-side paged/filtered listing — what the Organisation Staff page uses.
  // Short TTL: the key includes the filters, so a cache entry is only reused
  // when the user returns to exactly the same page of the same query.
  page: cached('providers', a.listStaffPage, 30_000),
  searchOrgs: cached('orgs', a.searchOrgNames),
  verify: invalidating(['providers', 'staff'], a.verifyProvider),
  suspend: invalidating(['providers', 'staff'], a.suspendProvider),
};

// ── RMPs (village health workers) ─────────────────────────────────────────────
export const rmpApi = {
  list: cached('rmps', a.listRmps),
  activate: invalidating(['rmps'], a.verifyRmp),
  suspend: invalidating(['rmps'], a.suspendRmp),
};

// ── Sub-admins ────────────────────────────────────────────────────────────────
export const subAdminApi = {
  list: cached('subAdmins', a.listSubAdmins),
  create: invalidating(['subAdmins'], a.createSubAdmin),
  update: invalidating(['subAdmins'], a.updateSubAdmin),
  revoke: invalidating(['subAdmins'], a.revokeSubAdmin),
  // Returns a generated password — never cache it.
  resetPassword: a.resetSubAdminPassword,
};

// ── Appointments ──────────────────────────────────────────────────────────────
export const appointmentApi = {
  list: cached('appointments', a.listAppointments),
  confirm:  invalidating(['appointments', 'navCounts'], (id: string) => a.setAppointmentStatus(id, 'in_progress')),
  complete: invalidating(['appointments', 'navCounts'], (id: string) => a.setAppointmentStatus(id, 'completed')),
  cancel:   invalidating(['appointments', 'navCounts'], (id: string) => a.setAppointmentStatus(id, 'cancelled')),
};

// ── Orders ────────────────────────────────────────────────────────────────────
export const orderApi = {
  list: cached('orders', a.listOrders),
};

// ── Refunds ───────────────────────────────────────────────────────────────────
export const refundApi = {
  list: cached('refunds', a.listRefunds),
  approve: invalidating(['refunds', 'navCounts'], (id: string) => a.setRefundStatus(id, 'approved')),
  reject: invalidating(['refunds', 'navCounts'], (id: string, reason: string) => a.setRefundStatus(id, 'rejected', reason)),
};

// ── Disputes ──────────────────────────────────────────────────────────────────
export const disputeApi = {
  list: cached('disputes', a.listDisputes),
  respond: invalidating(['disputes'], a.respondDispute),
  resolve: invalidating(['disputes', 'navCounts'], a.resolveDispute),
};

// ── SLA ───────────────────────────────────────────────────────────────────────
export const slaApi = {
  escalate: invalidating(['audit'], a.escalateSla),
};

// ── Transactions ──────────────────────────────────────────────────────────────
export const transactionApi = {
  list: cached('transactions', a.listTransactions),
};

// ── Audit logs ────────────────────────────────────────────────────────────────
export const auditApi = {
  list: cached('audit', a.listAuditLogs),
  log: invalidating(['audit'], a.writeAuditLog),
};

// ── Service categories ────────────────────────────────────────────────────────
export const serviceCategoryApi = {
  list: cached('serviceCategories', a.listServiceCategories),
  create: invalidating(['serviceCategories'], a.createServiceCategory),
  update: invalidating(['serviceCategories'], a.updateServiceCategory),
  delete: invalidating(['serviceCategories'], a.deleteServiceCategory),
};

// ── Pricing rules ─────────────────────────────────────────────────────────────
export const pricingApi = {
  list: cached('pricing', a.listPricingRules),
  create: invalidating(['pricing'], a.createPricingRule),
  update: invalidating(['pricing'], a.updatePricingRule),
};

// ── Banners ───────────────────────────────────────────────────────────────────
export const bannerApi = {
  list: cached('banners', a.listBanners),
  update: invalidating(['banners'], a.updateBanner),
  delete: invalidating(['banners'], a.deleteBanner),
};

// ── Feature flags & kill switches (legacy tables, kept for compatibility) ─────
export const featureFlagApi = {
  list: cached('features', a.listFeatureFlags),
  set: invalidating(['features'], a.setFeatureFlag),
};
export const killSwitchApi = {
  list: cached('features', a.listKillSwitches),
  set: invalidating(['features'], a.setKillSwitch),
};

// ── Push notifications ────────────────────────────────────────────────────────
export const pushApi = {
  list: cached('push', a.listPushNotifications),
  send: invalidating(['push'], a.sendPushNotification),
  // Device counts move as people log in and out; keep this one short-lived.
  countAudience: cached('push', a.countPushAudience, 15_000),
};

// ── Reports & aggregates (dashboard / analytics / revenue) ────────────────────
export const reportApi = {
  dashboard: cached('reports', a.getDashboardStats),
  analytics: cached('reports', a.getAnalytics),
  revenue: cached('reports', a.getRevenueReport),
};

// ── Platform settings ─────────────────────────────────────────────────────────
export const settingsApi = {
  get: cached('settings', a.getPlatformSettings),
  save: invalidating(['settings'], a.savePlatformSettings),
};

// ── Features (unified on/off toggles) ─────────────────────────────────────────
export const featureApi = {
  list: cached('features', a.listFeatures),
  set: invalidating(['features'], a.setFeature),
};

// ── Sidebar badge counts ──────────────────────────────────────────────────────
// The sidebar refreshes these on its own timer, so the cache only needs to
// absorb the duplicate call from a remount.
export const navApi = {
  counts: cached('navCounts', a.getSidebarCounts, 30_000),
};

// ── Dev tools (test data) ─────────────────────────────────────────────────────
// Seeding and cleanup rewrite most of the platform, so they clear everything.
const clearEverything = <A extends unknown[], R>(fn: (...args: A) => Promise<R>) =>
  async (...args: A): Promise<R> => {
    const result = await fn(...args);
    invalidateAll();
    return result;
  };

export const devApi = {
  seedOrg: clearEverything(a.seedTestOrg),
  seedCustomOrg: clearEverything(a.seedCustomOrg),
  seedPatient: clearEverything(a.seedTestPatient),
  seedProvider: clearEverything(a.seedTestProvider),
  seedCustom: clearEverything(a.seedCustomAccount),
  seedScenario: clearEverything(a.seedScenario),
  count: a.countTestData,
  cleanup: clearEverything(a.cleanupTestData),
  listOrgs: cached('orgs', a.listOrgNames),
};

// ── Danger zone: full platform wipe (keeps the admin panel itself) ────────────
export const dangerApi = {
  // Never cached — the preview must reflect the database as it is right now.
  previewWipe: a.previewWipe,
  wipeAll: clearEverything(a.wipeAllPlatformData),
};
