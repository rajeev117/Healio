'use client';
import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Eye, Calendar } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Toggle } from '@/components/ui/Toggle';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';
import { bannerApi, auditApi } from '@/lib/api';

type Banner = {
  id: string; title: string; subtitle: string; app: string; position: string;
  enabled: boolean; startDate: string; endDate: string; bgColor: string; clicks: number;
};
type EditForm = { title: string; subtitle: string; startDate: string; endDate: string; bgColor: string };

export default function BannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [fetching, setFetching] = useState(true);
  const [editing, setEditing] = useState<Banner | null>(null);
  const [deleting, setDeleting] = useState<Banner | null>(null);
  const [form, setForm] = useState<EditForm>({ title: '', subtitle: '', startDate: '', endDate: '', bgColor: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    bannerApi.list()
      .then((d) => setBanners(d as Banner[]))
      .catch((e) => console.error('Failed to load banners:', e))
      .finally(() => setFetching(false));
  }, []);

  const handleToggle = async (id: string, value: boolean) => {
    await bannerApi.update(id, { enabled: value });
    setBanners(prev => prev.map(b => b.id === id ? { ...b, enabled: value } : b));
  };

  const openEdit = (banner: Banner) => {
    setEditing(banner);
    setForm({ title: banner.title, subtitle: banner.subtitle, startDate: banner.startDate, endDate: banner.endDate, bgColor: banner.bgColor });
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    setLoading(true);
    await bannerApi.update(editing.id, form);
    await auditApi.log('Updated banner', 'Config', form.title);
    setBanners(prev => prev.map(b => b.id === editing.id ? { ...b, ...form } : b));
    setLoading(false);
    setEditing(null);
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setLoading(true);
    await bannerApi.delete(deleting.id);
    await auditApi.log('Deleted banner', 'Config', deleting.title);
    setBanners(prev => prev.filter(b => b.id !== deleting.id));
    setLoading(false);
    setDeleting(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-800 text-text">In-App Banners</h1>
          <p className="text-sm text-text-secondary mt-0.5">{fetching ? 'Loading…' : 'Manage promotional banners across apps'}</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-xs font-700 rounded-lg hover:bg-primary-hover transition-colors">
          <Plus className="w-3.5 h-3.5" />Create Banner
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {banners.map(banner => (
          <Card key={banner.id} padding="none" className={cn(!banner.enabled && 'opacity-60')}>
            <div className="rounded-t-lg px-4 py-3 text-white" style={{ backgroundColor: banner.bgColor }}>
              <p className="text-sm font-800">{banner.title}</p>
              <p className="text-xs opacity-80 mt-0.5">{banner.subtitle}</p>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Badge variant={banner.app === 'patient' ? 'info' : banner.app === 'provider' ? 'primary' : 'muted'}>
                  {banner.app === 'both' ? 'Both Apps' : banner.app === 'patient' ? 'Patient App' : 'Provider App'}
                </Badge>
                <Badge variant="muted">{banner.position.replace('_', ' ')}</Badge>
                <Badge variant={banner.enabled ? 'success' : 'muted'} dot>{banner.enabled ? 'Live' : 'Draft'}</Badge>
              </div>
              <div className="flex items-center gap-4 text-[10px] text-text-muted mb-3">
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{banner.startDate} → {banner.endDate}</span>
                <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{banner.clicks.toLocaleString()} clicks</span>
              </div>
              <div className="flex items-center justify-between">
                <Toggle checked={banner.enabled} onChange={(v) => handleToggle(banner.id, v)} size="sm" label={banner.enabled ? 'Live' : 'Disabled'} />
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(banner)} className="p-1.5 rounded-md hover:bg-surface-3 text-text-muted" title="Edit banner">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setDeleting(banner)} className="p-1.5 rounded-md hover:bg-danger-soft text-danger" title="Delete banner">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Edit banner modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Banner" size="md"
        footer={
          <>
            <button onClick={() => setEditing(null)} className="px-4 py-2 text-xs font-700 text-text-secondary border border-border rounded-lg hover:text-text transition-colors">Cancel</button>
            <button onClick={handleSaveEdit} disabled={loading || !form.title.trim()}
              className="px-4 py-2 text-xs font-700 text-white bg-primary rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-60">
              {loading ? 'Saving…' : 'Save Changes'}
            </button>
          </>
        }>
        {editing && (
          <div className="space-y-4">
            {/* Live preview */}
            <div className="rounded-xl px-4 py-3 text-white transition-colors" style={{ backgroundColor: form.bgColor || editing.bgColor }}>
              <p className="text-sm font-800">{form.title || 'Banner Title'}</p>
              <p className="text-xs opacity-80 mt-0.5">{form.subtitle || 'Banner subtitle'}</p>
            </div>
            <div>
              <label className="block text-xs font-700 text-text mb-1.5">Title</label>
              <input type="text" value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-xs text-text focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-xs font-700 text-text mb-1.5">Subtitle</label>
              <input type="text" value={form.subtitle} onChange={(e) => setForm(f => ({ ...f, subtitle: e.target.value }))}
                className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-xs text-text focus:outline-none focus:border-primary" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-700 text-text mb-1.5">Start Date</label>
                <input type="date" value={form.startDate} onChange={(e) => setForm(f => ({ ...f, startDate: e.target.value }))}
                  className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-xs text-text focus:outline-none focus:border-primary" />
              </div>
              <div>
                <label className="block text-xs font-700 text-text mb-1.5">End Date</label>
                <input type="date" value={form.endDate} onChange={(e) => setForm(f => ({ ...f, endDate: e.target.value }))}
                  className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-xs text-text focus:outline-none focus:border-primary" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-700 text-text mb-1.5">Background Color</label>
              <div className="flex items-center gap-2">
                <input type="color" value={form.bgColor} onChange={(e) => setForm(f => ({ ...f, bgColor: e.target.value }))}
                  className="w-10 h-8 rounded border border-border cursor-pointer" />
                <input type="text" value={form.bgColor} onChange={(e) => setForm(f => ({ ...f, bgColor: e.target.value }))}
                  className="flex-1 px-3 py-2 bg-surface-2 border border-border rounded-lg text-xs text-text font-mono focus:outline-none focus:border-primary" />
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        loading={loading}
        title="Delete Banner"
        message={deleting ? `Delete "${deleting.title}"? This will remove it from all apps immediately.` : ''}
        confirmLabel="Delete Banner"
        confirmVariant="danger"
      />
    </div>
  );
}
