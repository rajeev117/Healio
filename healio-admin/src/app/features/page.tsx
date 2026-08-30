'use client';
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Toggle } from '@/components/ui/Toggle';
import { cn } from '@/lib/utils';
import { featureApi } from '@/lib/api';
import type { Feature } from '@/lib/actions';

const APP_FILTERS = ['All', 'Patient App', 'Provider App'] as const;

const CATEGORY_META: Record<Feature['category'], { title: string; blurb: string }> = {
  product: { title: 'Product Features', blurb: 'Optional product capabilities (membership, video, chat).' },
  service: { title: 'Patient Services', blurb: 'Which service tiles patients can see and book.' },
  system:  { title: 'System Switches', blurb: 'Turn a whole subsystem off instantly (use in emergencies).' },
};
const CATEGORY_ORDER: Feature['category'][] = ['product', 'service', 'system'];

function FeatureRow({ feature }: { feature: Feature }) {
  const [enabled, setEnabled] = useState(feature.enabled);
  const [saving, setSaving] = useState(false);

  const toggle = async (v: boolean) => {
    setEnabled(v);
    setSaving(true);
    try {
      await featureApi.set(feature.id, v);
    } catch (e) {
      console.error('Failed to save feature:', e);
      setEnabled(!v); // revert on failure
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-4 px-4 py-3 border border-border rounded-xl bg-surface hover:bg-surface-2 transition-colors">
      <div className={cn('w-2 h-2 rounded-full shrink-0', enabled ? 'bg-success' : 'bg-danger')} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-700 text-text">{feature.name}</span>
          <Badge variant={feature.app === 'patient' ? 'info' : feature.app === 'provider' ? 'primary' : 'muted'}>
            {feature.app === 'both' ? 'Both Apps' : feature.app === 'patient' ? 'Patient' : 'Provider'}
          </Badge>
        </div>
        {feature.description && <p className="text-xs text-text-secondary mt-0.5">{feature.description}</p>}
      </div>
      <span className={cn('text-[10px] font-800 shrink-0', enabled ? 'text-success' : 'text-text-muted')}>
        {saving ? '…' : enabled ? 'ON' : 'OFF'}
      </span>
      <div className="shrink-0">
        <Toggle checked={enabled} onChange={toggle} />
      </div>
    </div>
  );
}

export default function FeaturesPage() {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [fetching, setFetching] = useState(true);
  const [appFilter, setAppFilter] = useState<string>('All');

  useEffect(() => {
    featureApi.list()
      .then(setFeatures)
      .catch((e) => console.error('Failed to load features:', e))
      .finally(() => setFetching(false));
  }, []);

  const filtered = features.filter((f) => {
    if (appFilter === 'Patient App' && f.app === 'provider') return false;
    if (appFilter === 'Provider App' && f.app === 'patient') return false;
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-800 text-text">Features</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            {fetching ? 'Loading…' : 'One switch per feature. ON = available to everyone, OFF = hidden everywhere.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="success" dot>{features.filter(f => f.enabled).length} on</Badge>
          <Badge variant="danger" dot>{features.filter(f => !f.enabled).length} off</Badge>
        </div>
      </div>

      {/* App filter */}
      <div className="flex items-center bg-surface rounded-lg border border-border p-0.5 w-fit">
        {APP_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setAppFilter(f)}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-700 transition-colors',
              appFilter === f ? 'bg-primary text-white' : 'text-text-secondary hover:text-text'
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Grouped by category */}
      {CATEGORY_ORDER.map((cat) => {
        const rows = filtered.filter((f) => f.category === cat);
        if (rows.length === 0) return null;
        const meta = CATEGORY_META[cat];
        return (
          <Card key={cat} padding="md">
            <div className="mb-3">
              <h2 className="text-sm font-800 text-text">{meta.title}</h2>
              <p className="text-xs text-text-secondary mt-0.5">{meta.blurb}</p>
            </div>
            <div className="space-y-2">
              {rows.map((feature) => (
                <FeatureRow key={feature.id} feature={feature} />
              ))}
            </div>
          </Card>
        );
      })}

      {!fetching && filtered.length === 0 && (
        <Card padding="lg">
          <p className="text-sm text-text-muted text-center">
            No features found. Run migration 012 in Supabase to seed the features table.
          </p>
        </Card>
      )}
    </div>
  );
}
