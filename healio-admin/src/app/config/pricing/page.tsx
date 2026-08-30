'use client';
import { useState, useEffect } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { formatCurrency, cn } from '@/lib/utils';
import { pricingApi, auditApi } from '@/lib/api';

type PricingRule = {
  id: string; service: string; type: string; basePrice: number; platformFee: number;
  orgOverrides: { org: string; price: number }[];
};

const TYPE_TABS = ['All', 'Appointment', 'Home Care', 'Lab', 'Subscription'] as const;
const typeMap: Record<string, string> = { appointment: 'Appointment', homecare: 'Home Care', lab: 'Lab', subscription: 'Subscription' };
const typeBadge: Record<string, 'primary' | 'warning' | 'info' | 'success'> = { appointment: 'primary', homecare: 'warning', lab: 'info', subscription: 'success' };

const emptyAddForm = { service: '', type: 'appointment', basePrice: '', platformFee: '0' };

export default function PricingPage() {
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [fetching, setFetching] = useState(true);
  const [tab, setTab] = useState('All');
  const [editing, setEditing] = useState<PricingRule | null>(null);
  const [adding, setAdding] = useState(false);
  const [editForm, setEditForm] = useState({ basePrice: '', platformFee: '' });
  const [addForm, setAddForm] = useState(emptyAddForm);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    pricingApi.list()
      .then((d) => setRules(d as PricingRule[]))
      .catch((e) => console.error('Failed to load pricing rules:', e))
      .finally(() => setFetching(false));
  }, []);

  const filtered = rules.filter(r => tab === 'All' || typeMap[r.type] === tab);

  const openEdit = (rule: PricingRule) => {
    setEditing(rule);
    setEditForm({ basePrice: String(rule.basePrice), platformFee: String(rule.platformFee) });
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    const basePrice = parseFloat(editForm.basePrice);
    const platformFee = parseFloat(editForm.platformFee);
    if (isNaN(basePrice) || isNaN(platformFee)) return;
    setLoading(true);
    await pricingApi.update(editing.id, { basePrice, platformFee });
    await auditApi.log('Updated pricing rule', 'Config', editing.service);
    setRules(prev => prev.map(r => r.id === editing.id ? { ...r, basePrice, platformFee } : r));
    setLoading(false);
    setEditing(null);
  };

  const handleAddRule = async () => {
    if (!addForm.service.trim()) return;
    const basePrice = parseFloat(addForm.basePrice);
    const platformFee = parseFloat(addForm.platformFee) || 0;
    if (isNaN(basePrice) || basePrice <= 0) return;
    setLoading(true);
    try {
      const newRule = await pricingApi.create({
        service: addForm.service.trim(),
        type: addForm.type,
        basePrice,
        platformFee,
      });
      await auditApi.log('Added pricing rule', 'Config', newRule.service);
      setRules(prev => [...prev, newRule as PricingRule]);
      setAddForm(emptyAddForm);
      setAdding(false);
    } catch (e) {
      console.error('Failed to add pricing rule:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-800 text-text">Pricing Rules</h1>
          <p className="text-sm text-text-secondary mt-0.5">{fetching ? 'Loading…' : 'Manage base prices and platform fees per service'}</p>
        </div>
        <button onClick={() => { setAddForm(emptyAddForm); setAdding(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-xs font-700 rounded-lg hover:bg-primary-hover transition-colors">
          <Plus className="w-3.5 h-3.5" />Add Rule
        </button>
      </div>

      <div className="flex items-center bg-surface rounded-lg border border-border p-0.5 w-fit">
        {TYPE_TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-3 py-1.5 rounded-md text-xs font-700 transition-colors', tab === t ? 'bg-primary text-white' : 'text-text-secondary hover:text-text')}>
            {t}
          </button>
        ))}
      </div>

      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-text-muted font-600 border-b border-border bg-surface-2">
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Base Price</th>
                <th className="px-4 py-3">Platform Fee</th>
                <th className="px-4 py-3">Total to Patient</th>
                <th className="px-4 py-3">Org Overrides</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(rule => (
                <tr key={rule.id} className="hover:bg-surface-2 transition-colors">
                  <td className="px-4 py-3 font-700 text-text">{rule.service}</td>
                  <td className="px-4 py-3"><Badge variant={typeBadge[rule.type] || 'muted'}>{typeMap[rule.type]}</Badge></td>
                  <td className="px-4 py-3 font-700 text-text">{formatCurrency(rule.basePrice)}</td>
                  <td className="px-4 py-3 text-text-secondary">{rule.platformFee > 0 ? formatCurrency(rule.platformFee) : '—'}</td>
                  <td className="px-4 py-3 font-800 text-primary">{formatCurrency(rule.basePrice + rule.platformFee)}</td>
                  <td className="px-4 py-3">
                    {rule.orgOverrides.length > 0 ? (
                      <div className="space-y-0.5">
                        {rule.orgOverrides.map(ov => (
                          <span key={ov.org} className="text-[10px] text-text-secondary block">{ov.org}: {formatCurrency(ov.price)}</span>
                        ))}
                      </div>
                    ) : <span className="text-text-muted">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(rule)} className="p-1.5 rounded-md hover:bg-surface-3 text-text-muted" title="Edit pricing">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add rule modal */}
      <Modal open={adding} onClose={() => setAdding(false)} title="Add Pricing Rule" size="sm"
        footer={
          <>
            <button onClick={() => setAdding(false)} className="px-4 py-2 text-xs font-700 text-text-secondary border border-border rounded-lg hover:text-text transition-colors">Cancel</button>
            <button onClick={handleAddRule} disabled={loading || !addForm.service.trim() || !addForm.basePrice}
              className="px-4 py-2 text-xs font-700 text-white bg-primary rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-60">
              {loading ? 'Adding…' : 'Add Rule'}
            </button>
          </>
        }>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-700 text-text mb-1.5">Service Name *</label>
            <input type="text" value={addForm.service} onChange={(e) => setAddForm(f => ({ ...f, service: e.target.value }))}
              placeholder="e.g. Dental Checkup"
              className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-primary" />
          </div>
          <div>
            <label className="block text-xs font-700 text-text mb-1.5">Type</label>
            <select value={addForm.type} onChange={(e) => setAddForm(f => ({ ...f, type: e.target.value }))}
              className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-xs text-text focus:outline-none focus:border-primary">
              <option value="appointment">Appointment</option>
              <option value="homecare">Home Care</option>
              <option value="lab">Lab</option>
              <option value="subscription">Subscription</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-700 text-text mb-1.5">Base Price (₹) *</label>
              <input type="number" min="0" value={addForm.basePrice} onChange={(e) => setAddForm(f => ({ ...f, basePrice: e.target.value }))}
                placeholder="0"
                className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-xs font-700 text-text mb-1.5">Platform Fee (₹)</label>
              <input type="number" min="0" value={addForm.platformFee} onChange={(e) => setAddForm(f => ({ ...f, platformFee: e.target.value }))}
                placeholder="0"
                className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-primary" />
            </div>
          </div>
          {addForm.basePrice && (
            <div className="bg-surface-2 rounded-xl p-3">
              <p className="text-[10px] font-700 text-text-muted uppercase tracking-wider mb-1">Total to Patient</p>
              <p className="text-base font-800 text-primary">
                {formatCurrency((parseFloat(addForm.basePrice) || 0) + (parseFloat(addForm.platformFee) || 0))}
              </p>
            </div>
          )}
        </div>
      </Modal>

      {/* Edit pricing modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Edit — ${editing?.service}`} size="sm"
        footer={
          <>
            <button onClick={() => setEditing(null)} className="px-4 py-2 text-xs font-700 text-text-secondary border border-border rounded-lg hover:text-text transition-colors">Cancel</button>
            <button onClick={handleSaveEdit} disabled={loading}
              className="px-4 py-2 text-xs font-700 text-white bg-primary rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-60">
              {loading ? 'Saving…' : 'Save Changes'}
            </button>
          </>
        }>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-700 text-text mb-1.5">Base Price (₹)</label>
            <input type="number" min="0" value={editForm.basePrice} onChange={(e) => setEditForm(f => ({ ...f, basePrice: e.target.value }))}
              className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-xs text-text focus:outline-none focus:border-primary" />
          </div>
          <div>
            <label className="block text-xs font-700 text-text mb-1.5">Platform Fee (₹)</label>
            <input type="number" min="0" value={editForm.platformFee} onChange={(e) => setEditForm(f => ({ ...f, platformFee: e.target.value }))}
              className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-xs text-text focus:outline-none focus:border-primary" />
          </div>
          {editForm.basePrice && (
            <div className="bg-surface-2 rounded-xl p-3">
              <p className="text-[10px] font-700 text-text-muted uppercase tracking-wider mb-1">Total to Patient</p>
              <p className="text-base font-800 text-primary">
                {formatCurrency((parseFloat(editForm.basePrice) || 0) + (parseFloat(editForm.platformFee) || 0))}
              </p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
