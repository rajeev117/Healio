// ─────────────────────────────────────────────────────────────────────────────
// Sub-admin roles → what each can access. Single source of truth shared by the
// admin UI (to preview access) and the server action (to assign permissions).
// ─────────────────────────────────────────────────────────────────────────────
export type Perm = { read?: boolean; write?: boolean; delete?: boolean };
export type PermissionSet = Record<string, Perm>;

export const ROLE_PERMISSIONS: Record<string, PermissionSet> = {
  support: {
    appointments: { read: true, write: true },
    disputes: { read: true, write: true },
    patients: { read: true },
    orders: { read: true },
  },
  finance: {
    transactions: { read: true },
    refunds: { read: true, write: true },
    wallets: { read: true, write: true },
    revenue: { read: true },
  },
  ops: {
    appointments: { read: true, write: true },
    orders: { read: true, write: true },
    organisations: { read: true },
    sla: { read: true, write: true },
  },
  content: {
    banners: { read: true, write: true, delete: true },
    features: { read: true, write: true },
    pricing: { read: true, write: true },
    notifications: { read: true, write: true },
  },
  regional: {
    organisations: { read: true, write: true },
    providers: { read: true, write: true },
    patients: { read: true },
    appointments: { read: true, write: true },
  },
  custom: {
    patients: { read: true },
  },
};

export const ROLE_DESCRIPTIONS: Record<string, string> = {
  support: 'Handles patient appointments & disputes. Read-only on patients and orders.',
  finance: 'Manages refunds & wallets. Views transactions and revenue.',
  ops: 'Manages appointments, orders and SLAs. Views organisations.',
  content: 'Manages banners, features, pricing and push notifications.',
  regional: 'Manages organisations and providers within assigned scope.',
  custom: 'Minimal access — customise permissions after creation.',
};

export function rolePermissions(role: string): PermissionSet {
  return ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS.custom;
}

// Every module a sub-admin's access can be defined over. Used to render the
// custom permission matrix so admins can build their own roles.
export const ALL_MODULES: string[] = [
  'dashboard', 'organisations', 'patients', 'providers', 'sub_admins',
  'appointments', 'orders', 'transactions', 'wallets', 'refunds',
  'disputes', 'sla', 'features', 'pricing', 'banners', 'notifications',
  'audit', 'dev_tools',
];

// Expand a (possibly partial) permission set to a full editable matrix.
export function fullMatrix(perms: PermissionSet = {}): Record<string, Perm> {
  const out: Record<string, Perm> = {};
  for (const m of ALL_MODULES) {
    const p = perms[m] || {};
    out[m] = { read: !!p.read, write: !!p.write, delete: !!p.delete };
  }
  return out;
}

// Keep only modules that have at least one permission enabled (for storage).
export function compactMatrix(matrix: Record<string, Perm>): PermissionSet {
  const out: PermissionSet = {};
  for (const [m, p] of Object.entries(matrix)) {
    if (p.read || p.write || p.delete) out[m] = { read: !!p.read, write: !!p.write, delete: !!p.delete };
  }
  return out;
}
