'use client';
import { useState, useEffect } from 'react';
import { Plus, Eye, Trash2, Clock } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { subAdminApi, auditApi } from '@/lib/api';
import { ROLE_PERMISSIONS, ROLE_DESCRIPTIONS, ALL_MODULES, fullMatrix, compactMatrix } from '@/lib/roles';
import type { Perm } from '@/lib/roles';
import type { SubAdmin, SubAdminRole } from '@/types';

const ROLE_COLORS: Record<string, 'primary' | 'info' | 'warning' | 'success' | 'danger' | 'muted'> = {
  support: 'info', finance: 'success', ops: 'warning', content: 'primary', regional: 'danger', custom: 'muted',
};

const ROLES: SubAdminRole[] = ['support', 'finance', 'ops', 'content', 'regional', 'custom'];

// Editable Read/Write/Delete matrix over every module — lets admins build
// their own custom role.
function PermissionMatrix({ matrix, onChange }: {
  matrix: Record<string, Perm>;
  onChange: (m: Record<string, Perm>) => void;
}) {
  const toggle = (mod: string, key: keyof Perm) => {
    const cur = matrix[mod] || {};
    onChange({ ...matrix, [mod]: { ...cur, [key]: !cur[key] } });
  };
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="grid grid-cols-[1fr_auto] gap-2 px-3 py-2 bg-surface-2 text-[10px] font-700 text-text-muted uppercase tracking-wider">
        <span>Module</span>
        <span className="flex gap-3"><span className="w-7 text-center">R</span><span className="w-7 text-center">W</span><span className="w-7 text-center">D</span></span>
      </div>
      <div className="max-h-56 overflow-y-auto">
        {ALL_MODULES.map((mod) => {
          const p = matrix[mod] || {};
          return (
            <div key={mod} className="grid grid-cols-[1fr_auto] gap-2 px-3 py-1.5 border-t border-border items-center">
              <span className="text-xs font-600 text-text capitalize">{mod.replace('_', ' ')}</span>
              <span className="flex gap-3">
                {(['read', 'write', 'delete'] as (keyof Perm)[]).map((k) => (
                  <input key={k} type="checkbox" checked={!!p[k]} onChange={() => toggle(mod, k)}
                    className="w-7 h-4 accent-primary cursor-pointer" />
                ))}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type ModalState =
  | { type: 'view'; admin: SubAdmin }
  | { type: 'revoke'; admin: SubAdmin }
  | { type: 'create' }
  | { type: 'credentials'; email: string; password: string; title: string }
  | null;

const emptyForm = { name: '', email: '', role: 'support' as SubAdminRole, scope: 'platform' as 'platform' | 'org', expiresAt: '' };

export default function SubAdminsPage() {
  const [subAdmins, setSubAdmins] = useState<SubAdmin[]>([]);
  const [fetching, setFetching] = useState(true);
  const [modal, setModal] = useState<ModalState>(null);
  const [form, setForm] = useState(emptyForm);
  const [matrix, setMatrix] = useState<Record<string, Perm>>(fullMatrix(ROLE_PERMISSIONS.support));
  const [editMatrix, setEditMatrix] = useState<Record<string, Perm>>({});
  const [loading, setLoading] = useState(false);

  const openCreate = () => {
    setForm(emptyForm);
    setMatrix(fullMatrix(ROLE_PERMISSIONS.support));
    setModal({ type: 'create' });
  };
  // Switching the role applies that role's template into the editable matrix.
  const applyRoleTemplate = (role: SubAdminRole) => {
    setForm(f => ({ ...f, role }));
    setMatrix(fullMatrix(ROLE_PERMISSIONS[role] || {}));
  };
  const openView = (admin: SubAdmin) => {
    setEditMatrix(fullMatrix(admin.permissions || {}));
    setModal({ type: 'view', admin });
  };

  useEffect(() => {
    subAdminApi.list()
      .then(setSubAdmins)
      .catch((e) => console.error('Failed to load sub-admins:', e))
      .finally(() => setFetching(false));
  }, []);

  const handleRevoke = async () => {
    if (modal?.type !== 'revoke') return;
    setLoading(true);
    await subAdminApi.revoke(modal.admin.id);
    await auditApi.log('Revoked sub-admin access', 'Sub-Admins', modal.admin.name);
    setSubAdmins(prev => prev.map(a => a.id === modal.admin.id ? { ...a, status: 'inactive' } : a));
    setLoading(false);
    setModal(null);
  };

  const handleCreate = async () => {
    if (!form.name.trim() || !form.email.trim()) return;
    setLoading(true);
    try {
      const newAdmin = await subAdminApi.create({
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
        scope: form.scope,
        expiresAt: form.expiresAt || undefined,
        permissions: compactMatrix(matrix),
      });
      await auditApi.log('Created sub-admin', 'Sub-Admins', newAdmin.name);
      setSubAdmins(prev => [...prev, newAdmin]);
      setForm(emptyForm);
      // Show the generated login password once.
      setModal({ type: 'credentials', email: newAdmin.email, password: newAdmin.tempPassword, title: 'Sub-Admin Created' });
    } catch (e) {
      console.error('Failed to create sub-admin:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (admin: SubAdmin) => {
    setLoading(true);
    try {
      const { password } = await subAdminApi.resetPassword(admin.id);
      await auditApi.log('Reset sub-admin password', 'Sub-Admins', admin.name);
      setModal({ type: 'credentials', email: admin.email, password, title: 'New Password' });
    } catch (e) {
      console.error('Failed to reset password:', e);
    } finally {
      setLoading(false);
    }
  };

  const copy = (text: string) => { try { navigator.clipboard?.writeText(text); } catch { /* ignore */ } };

  const handleSavePermissions = async () => {
    if (modal?.type !== 'view') return;
    setLoading(true);
    try {
      const updated = await subAdminApi.update(modal.admin.id, { permissions: compactMatrix(editMatrix) });
      await auditApi.log('Updated sub-admin permissions', 'Sub-Admins', modal.admin.name);
      setSubAdmins(prev => prev.map(a => a.id === updated.id ? updated : a));
      setModal(null);
    } catch (e) {
      console.error('Failed to update permissions:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-800 text-text">Sub-Admins</h1>
          <p className="text-sm text-text-secondary mt-0.5">Manage team access and permissions</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-xs font-700 rounded-lg hover:bg-primary-hover transition-colors">
          <Plus className="w-3.5 h-3.5" />
          Create Sub-Admin
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
        {subAdmins.map((admin) => (
          <Card key={admin.id} padding="md" className="hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <Avatar name={admin.name} size="lg" />
                <div>
                  <p className="text-sm font-800 text-text">{admin.name}</p>
                  <p className="text-[10px] text-text-muted">{admin.email}</p>
                </div>
              </div>
              <Badge variant={admin.status === 'active' ? 'success' : admin.status === 'expired' ? 'danger' : 'muted'} dot>
                {admin.status}
              </Badge>
            </div>

            <div className="flex items-center gap-2 mb-3">
              <Badge variant={ROLE_COLORS[admin.role]}>{admin.role}</Badge>
              <Badge variant={admin.scope === 'platform' ? 'info' : 'warning'}>
                {admin.scope === 'platform' ? 'Platform-wide' : `${admin.orgIds?.length || 0} org(s)`}
              </Badge>
            </div>

            <div className="bg-surface-2 rounded-lg p-3 mb-3">
              <p className="text-[10px] font-700 text-text-muted uppercase tracking-wider mb-2">Permissions</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(admin.permissions).map(([mod, perms]) => (
                  <span key={mod} className="text-[10px] font-600 text-text-secondary bg-surface rounded px-2 py-0.5 border border-border capitalize">
                    {mod.replace('_', ' ')}: {[perms.read && 'R', perms.write && 'W', perms.delete && 'D'].filter(Boolean).join('/')}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between text-[10px] text-text-muted">
              <span>Last login: {admin.lastLoginAt ? new Date(admin.lastLoginAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Never'}</span>
              {admin.expiresAt && (
                <span className="flex items-center gap-1 text-warning">
                  <Clock className="w-3 h-3" />
                  Expires {new Date(admin.expiresAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
              <button onClick={() => openView(admin)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-border text-xs font-700 text-text hover:bg-surface-2 transition-colors">
                <Eye className="w-3.5 h-3.5" /> View / Edit
              </button>
              <button onClick={() => setModal({ type: 'revoke', admin })}
                disabled={admin.status === 'inactive'}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-danger text-xs font-700 text-danger hover:bg-danger-soft transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                <Trash2 className="w-3.5 h-3.5" /> Revoke
              </button>
            </div>
          </Card>
        ))}
      </div>

      {/* Create sub-admin modal */}
      <Modal open={modal?.type === 'create'} onClose={() => setModal(null)} title="Create Sub-Admin" size="md"
        footer={
          <>
            <button onClick={() => setModal(null)} className="px-4 py-2 text-xs font-700 text-text-secondary border border-border rounded-lg hover:text-text transition-colors">Cancel</button>
            <button onClick={handleCreate} disabled={loading || !form.name.trim() || !form.email.trim()}
              className="px-4 py-2 text-xs font-700 text-white bg-primary rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-60">
              {loading ? 'Creating…' : 'Create Sub-Admin'}
            </button>
          </>
        }>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-700 text-text mb-1.5">Full Name *</label>
              <input type="text" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. John Doe"
                className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-xs font-700 text-text mb-1.5">Email *</label>
              <input type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="john@healio.in"
                className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-primary" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-700 text-text mb-1.5">Role (template)</label>
              <select value={form.role} onChange={(e) => applyRoleTemplate(e.target.value as SubAdminRole)}
                className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-xs text-text focus:outline-none focus:border-primary">
                {ROLES.map(r => <option key={r} value={r} className="capitalize">{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-700 text-text mb-1.5">Scope</label>
              <select value={form.scope} onChange={(e) => setForm(f => ({ ...f, scope: e.target.value as 'platform' | 'org' }))}
                className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-xs text-text focus:outline-none focus:border-primary">
                <option value="platform">Platform-wide</option>
                <option value="org">Org-specific</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-700 text-text mb-1.5">Access Expiry (optional)</label>
            <input type="date" value={form.expiresAt} onChange={(e) => setForm(f => ({ ...f, expiresAt: e.target.value }))}
              className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-xs text-text focus:outline-none focus:border-primary" />
            <p className="text-[10px] text-text-muted mt-1">Leave blank for no expiry</p>
          </div>
          {/* Custom permissions — start from the role template, then tweak/define your own */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-700 text-text">Permissions (define your own)</label>
              <button type="button" onClick={() => setMatrix(fullMatrix(ROLE_PERMISSIONS[form.role] || {}))}
                className="text-[10px] font-700 text-primary">Reset to “{form.role}” template</button>
            </div>
            <p className="text-[11px] text-text-secondary mb-2">{ROLE_DESCRIPTIONS[form.role]} Tick exactly what this person can do.</p>
            <PermissionMatrix matrix={matrix} onChange={setMatrix} />
          </div>
          <div className="bg-info-soft rounded-xl p-3 border border-info/20">
            <p className="text-xs text-text-secondary">
              A login password will be generated and shown once after creation. The sub-admin signs in at the admin login with their email + that password (changeable anytime via “Reset password”). R=Read, W=Write, D=Delete.
            </p>
          </div>
        </div>
      </Modal>

      {/* Credentials modal — shows generated/reset password once */}
      <Modal open={modal?.type === 'credentials'} onClose={() => setModal(null)}
        title={modal?.type === 'credentials' ? modal.title : ''} size="sm">
        {modal?.type === 'credentials' && (
          <div className="space-y-3">
            <p className="text-xs text-text-secondary">
              Share these credentials securely. The password is shown <b>only once</b> — you can reset it later.
            </p>
            <div className="bg-surface-2 rounded-lg p-3 border border-border">
              <p className="text-[10px] font-700 text-text-muted uppercase tracking-wider">Email</p>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-700 text-text break-all">{modal.email}</p>
                <button onClick={() => copy(modal.email)} className="text-[10px] font-700 text-primary shrink-0">Copy</button>
              </div>
            </div>
            <div className="bg-surface-2 rounded-lg p-3 border border-border">
              <p className="text-[10px] font-700 text-text-muted uppercase tracking-wider">Password</p>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-800 text-text font-mono">{modal.password}</p>
                <button onClick={() => copy(modal.password)} className="text-[10px] font-700 text-primary shrink-0">Copy</button>
              </div>
            </div>
            <button onClick={() => setModal(null)}
              className="w-full py-2 text-xs font-700 text-white bg-primary rounded-lg hover:bg-primary-hover transition-colors">
              Done
            </button>
          </div>
        )}
      </Modal>

      {/* View admin modal */}
      <Modal open={modal?.type === 'view'} onClose={() => setModal(null)} title="Sub-Admin Details" size="lg">
        {modal?.type === 'view' && (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <Avatar name={modal.admin.name} size="xl" />
              <div>
                <p className="text-base font-800 text-text">{modal.admin.name}</p>
                <p className="text-xs text-text-secondary">{modal.admin.email}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <Badge variant={ROLE_COLORS[modal.admin.role]}>{modal.admin.role}</Badge>
                  <Badge variant={modal.admin.status === 'active' ? 'success' : 'danger'} dot>{modal.admin.status}</Badge>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Scope', value: modal.admin.scope === 'platform' ? 'Platform-wide' : `${modal.admin.orgIds?.join(', ')}` },
                { label: 'Created', value: new Date(modal.admin.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) },
                { label: 'Last Login', value: modal.admin.lastLoginAt ? new Date(modal.admin.lastLoginAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Never' },
                { label: 'Expires', value: modal.admin.expiresAt ? new Date(modal.admin.expiresAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'No expiry' },
              ].map(({ label, value }) => (
                <div key={label} className="bg-surface-2 rounded-xl p-3">
                  <p className="text-[10px] font-700 text-text-muted uppercase tracking-wider mb-1">{label}</p>
                  <p className="text-sm font-700 text-text">{value}</p>
                </div>
              ))}
            </div>
            <div>
              <p className="text-[10px] font-700 text-text-muted uppercase tracking-wider mb-2">Module Permissions (editable)</p>
              <PermissionMatrix matrix={editMatrix} onChange={setEditMatrix} />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleSavePermissions}
                disabled={loading}
                className="flex-1 py-2.5 text-xs font-700 text-white bg-primary rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-60">
                {loading ? 'Saving…' : 'Save Permissions'}
              </button>
              <button
                onClick={() => handleResetPassword(modal.admin)}
                disabled={loading}
                className="flex-1 py-2.5 text-xs font-700 text-primary border border-primary rounded-lg hover:bg-primary-soft transition-colors disabled:opacity-60">
                Reset Password
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={modal?.type === 'revoke'}
        onClose={() => setModal(null)}
        onConfirm={handleRevoke}
        loading={loading}
        title="Revoke Access"
        message={modal?.type === 'revoke' ? `Revoke ${modal.admin.name}'s admin access? They will immediately lose all platform permissions.` : ''}
        confirmLabel="Revoke Access"
        confirmVariant="danger"
      />
    </div>
  );
}
