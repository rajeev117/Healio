// ─────────────────────────────────────────────────────────────────────────────
// Client-facing API surface.
// Thin wrapper that maps the existing orgApi/patientApi/… object shape onto the
// real server actions in ./actions. Safe to import from client components — the
// actual DB work (and the service-role key) stays on the server.
// ─────────────────────────────────────────────────────────────────────────────
import * as a from './actions';

// ── Organisations ─────────────────────────────────────────────────────────────
export const orgApi = {
  list: a.listOrgs,
  create: a.createOrg,
  approve: (id: string) => a.setOrgStatus(id, 'active'),
  suspend: (id: string) => a.setOrgStatus(id, 'suspended'),
  delete: a.deleteOrg,
};

// ── Org staff ─────────────────────────────────────────────────────────────────
export const staffApi = {
  listByOrg: a.listOrgStaff,
  create: a.createOrgStaff,
  activate: (id: string) => a.setStaffStatus(id, 'active'),
  deactivate: (id: string) => a.setStaffStatus(id, 'inactive'),
};

// ── Onboarding queue ──────────────────────────────────────────────────────────
export const onboardingApi = {
  list: a.listOnboarding,
  approveOrg: a.approveOnboarding,
  rejectOrg: a.rejectOnboarding,
};

// ── Patients ──────────────────────────────────────────────────────────────────
export const patientApi = {
  list: a.listPatients,
  ban: (id: string) => a.setPatientStatus(id, 'banned'),
  unban: (id: string) => a.setPatientStatus(id, 'active'),
  adjustWallet: a.adjustPatientWallet,
  remove: a.deletePatient,
};

// ── Providers ─────────────────────────────────────────────────────────────────
export const providerApi = {
  list: a.listProviders,
  verify: a.verifyProvider,
  suspend: a.suspendProvider,
};

// ── RMPs (village health workers) ─────────────────────────────────────────────
export const rmpApi = {
  list: a.listRmps,
  activate: a.verifyRmp,
  suspend: a.suspendRmp,
};

// ── Sub-admins ────────────────────────────────────────────────────────────────
export const subAdminApi = {
  list: a.listSubAdmins,
  create: a.createSubAdmin,
  update: a.updateSubAdmin,
  revoke: a.revokeSubAdmin,
  resetPassword: a.resetSubAdminPassword,
};

// ── Appointments ──────────────────────────────────────────────────────────────
export const appointmentApi = {
  list:     a.listAppointments,
  confirm:  (id: string) => a.setAppointmentStatus(id, 'in_progress'),  // accept booking → active
  complete: (id: string) => a.setAppointmentStatus(id, 'completed'),    // mark session done
  cancel:   (id: string) => a.setAppointmentStatus(id, 'cancelled'),
};

// ── Orders ────────────────────────────────────────────────────────────────────
export const orderApi = {
  list: a.listOrders,
};

// ── Refunds ───────────────────────────────────────────────────────────────────
export const refundApi = {
  list: a.listRefunds,
  approve: (id: string) => a.setRefundStatus(id, 'approved'),
  reject: (id: string, reason: string) => a.setRefundStatus(id, 'rejected', reason),
};

// ── Disputes ──────────────────────────────────────────────────────────────────
export const disputeApi = {
  list: a.listDisputes,
  respond: a.respondDispute,
  resolve: a.resolveDispute,
};

// ── SLA ───────────────────────────────────────────────────────────────────────
export const slaApi = {
  escalate: a.escalateSla,
};

// ── Transactions ──────────────────────────────────────────────────────────────
export const transactionApi = {
  list: a.listTransactions,
};

// ── Audit logs ────────────────────────────────────────────────────────────────
export const auditApi = {
  list: a.listAuditLogs,
  log: a.writeAuditLog,
};

// ── Service categories ────────────────────────────────────────────────────────
export const serviceCategoryApi = {
  list: a.listServiceCategories,
  create: a.createServiceCategory,
  update: a.updateServiceCategory,
  delete: a.deleteServiceCategory,
};

// ── Pricing rules ─────────────────────────────────────────────────────────────
export const pricingApi = {
  list: a.listPricingRules,
  create: a.createPricingRule,
  update: a.updatePricingRule,
};

// ── Banners ───────────────────────────────────────────────────────────────────
export const bannerApi = {
  list: a.listBanners,
  update: a.updateBanner,
  delete: a.deleteBanner,
};

// ── Feature flags & kill switches ─────────────────────────────────────────────
export const featureFlagApi = {
  list: a.listFeatureFlags,
  set: a.setFeatureFlag,
};
export const killSwitchApi = {
  list: a.listKillSwitches,
  set: a.setKillSwitch,
};

// ── Push notifications ────────────────────────────────────────────────────────
export const pushApi = {
  list: a.listPushNotifications,
  send: a.sendPushNotification,
};

// ── Reports & aggregates (dashboard / analytics / revenue) ────────────────────
export const reportApi = {
  dashboard: a.getDashboardStats,
  analytics: a.getAnalytics,
  revenue: a.getRevenueReport,
};

// ── Platform settings ─────────────────────────────────────────────────────────
export const settingsApi = {
  get: a.getPlatformSettings,
  save: a.savePlatformSettings,
};

// ── Features (unified on/off toggles) ─────────────────────────────────────────
export const featureApi = {
  list: a.listFeatures,
  set: a.setFeature,
};

// ── Sidebar badge counts ──────────────────────────────────────────────────────
export const navApi = {
  counts: a.getSidebarCounts,
};

// ── Dev tools (test data) ─────────────────────────────────────────────────────
export const devApi = {
  seedOrg: a.seedTestOrg,
  seedCustomOrg: a.seedCustomOrg,
  seedPatient: a.seedTestPatient,
  seedProvider: a.seedTestProvider,
  seedCustom: a.seedCustomAccount,
  seedScenario: a.seedScenario,
  count: a.countTestData,
  cleanup: a.cleanupTestData,
  listOrgs: a.listOrgNames,
};
