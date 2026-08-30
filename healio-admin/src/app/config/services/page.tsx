'use client';
import { useState, useEffect } from 'react';
import { Plus, GripVertical, Pencil, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Toggle } from '@/components/ui/Toggle';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';
import { serviceCategoryApi, auditApi } from '@/lib/api';

type Category = {
  id: string; name: string; icon: string; description: string;
  enabled: boolean; order: number; app: string;
};

const emptyForm = { name: '', description: '', icon: '' };

export default function ServiceCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [fetching, setFetching] = useState(true);
  const [editing, setEditing] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [adding, setAdding] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', description: '' });
  const [addForm, setAddForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    serviceCategoryApi.list()
      .then((d) => setCategories(d as Category[]))
      .catch((e) => console.error('Failed to load service categories:', e))
      .finally(() => setFetching(false));
  }, []);

  const handleToggle = async (id: string, value: boolean) => {
    await serviceCategoryApi.update(id, { enabled: value });
    setCategories(prev => prev.map(c => c.id === id ? { ...c, enabled: value } : c));
  };

  const openEdit = (cat: Category) => {
    setEditing(cat);
    setEditForm({ name: cat.name, description: cat.description });
  };

  const handleSaveEdit = async () => {
    if (!editing || !editForm.name.trim()) return;
    setLoading(true);
    await serviceCategoryApi.update(editing.id, { name: editForm.name, description: editForm.description });
    await auditApi.log('Updated service category', 'Config', editForm.name);
    setCategories(prev => prev.map(c => c.id === editing.id ? { ...c, ...editForm } : c));
    setLoading(false);
    setEditing(null);
  };

  const handleAdd = async () => {
    if (!addForm.name.trim()) return;
    setLoading(true);
    try {
      const newCat = await serviceCategoryApi.create({
        name: addForm.name.trim(),
        description: addForm.description.trim(),
        icon: addForm.icon.trim() || 'grid',
        order: categories.length + 1,
      });
      await auditApi.log('Added service category', 'Config', newCat.name);
      setCategories(prev => [...prev, newCat as Category]);
      setAddForm(emptyForm);
      setAdding(false);
    } catch (e) {
      console.error('Failed to add category:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setLoading(true);
    await serviceCategoryApi.delete(deleting.id);
    await auditApi.log('Deleted service category', 'Config', deleting.name);
    setCategories(prev => prev.filter(c => c.id !== deleting.id));
    setLoading(false);
    setDeleting(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-800 text-text">Service Categories</h1>
          <p className="text-sm text-text-secondary mt-0.5">{fetching ? 'Loading…' : 'Manage categories shown in the patient app Services tab'}</p>
        </div>
        <button onClick={() => { setAddForm(emptyForm); setAdding(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-xs font-700 rounded-lg hover:bg-primary-hover transition-colors">
          <Plus className="w-3.5 h-3.5" />Add Category
        </button>
      </div>

      <Card padding="none">
        <div className="divide-y divide-border">
          {categories.sort((a, b) => a.order - b.order).map(cat => (
            <div key={cat.id} className={cn('flex items-center gap-4 px-5 py-4 hover:bg-surface-2 transition-colors', !cat.enabled && 'opacity-50')}>
              <GripVertical className="w-4 h-4 text-text-muted cursor-grab shrink-0" />
              <div className="w-10 h-10 rounded-xl bg-primary-soft flex items-center justify-center shrink-0">
                <span className="text-primary text-sm font-800">{cat.order}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-700 text-text">{cat.name}</p>
                  {!cat.enabled && <Badge variant="muted">Hidden</Badge>}
                </div>
                <p className="text-xs text-text-secondary mt-0.5">{cat.description}</p>
              </div>
              <Toggle checked={cat.enabled} onChange={(v) => handleToggle(cat.id, v)} size="sm" />
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => openEdit(cat)} className="p-1.5 rounded-md hover:bg-surface-3 text-text-muted" title="Edit">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setDeleting(cat)} className="p-1.5 rounded-md hover:bg-danger-soft text-danger" title="Delete">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Add category modal */}
      <Modal open={adding} onClose={() => setAdding(false)} title="Add Service Category" size="sm"
        footer={
          <>
            <button onClick={() => setAdding(false)} className="px-4 py-2 text-xs font-700 text-text-secondary border border-border rounded-lg hover:text-text transition-colors">Cancel</button>
            <button onClick={handleAdd} disabled={loading || !addForm.name.trim()}
              className="px-4 py-2 text-xs font-700 text-white bg-primary rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-60">
              {loading ? 'Adding…' : 'Add Category'}
            </button>
          </>
        }>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-700 text-text mb-1.5">Name *</label>
            <input type="text" value={addForm.name} onChange={(e) => setAddForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Mental Health"
              className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-primary" />
          </div>
          <div>
            <label className="block text-xs font-700 text-text mb-1.5">Description</label>
            <input type="text" value={addForm.description} onChange={(e) => setAddForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Short description shown in app"
              className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-primary" />
          </div>
          <div>
            <label className="block text-xs font-700 text-text mb-1.5">Icon name (Expo icon key)</label>
            <input type="text" value={addForm.icon} onChange={(e) => setAddForm(f => ({ ...f, icon: e.target.value }))}
              placeholder="e.g. heart, star, medical-bag"
              className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-primary" />
          </div>
        </div>
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Edit — ${editing?.name}`} size="sm"
        footer={
          <>
            <button onClick={() => setEditing(null)} className="px-4 py-2 text-xs font-700 text-text-secondary border border-border rounded-lg hover:text-text transition-colors">Cancel</button>
            <button onClick={handleSaveEdit} disabled={loading || !editForm.name.trim()}
              className="px-4 py-2 text-xs font-700 text-white bg-primary rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-60">
              {loading ? 'Saving…' : 'Save Changes'}
            </button>
          </>
        }>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-700 text-text mb-1.5">Name</label>
            <input type="text" value={editForm.name} onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-xs text-text focus:outline-none focus:border-primary" />
          </div>
          <div>
            <label className="block text-xs font-700 text-text mb-1.5">Description</label>
            <input type="text" value={editForm.description} onChange={(e) => setEditForm(f => ({ ...f, description: e.target.value }))}
              className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-xs text-text focus:outline-none focus:border-primary" />
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        loading={loading}
        title="Delete Category"
        message={deleting ? `Delete "${deleting.name}"? This will remove it from the patient app immediately.` : ''}
        confirmLabel="Delete"
        confirmVariant="danger"
      />
    </div>
  );
}
