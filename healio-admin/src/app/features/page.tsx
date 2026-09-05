'use client';
import { useEffect, useMemo, useState } from 'react';
import {
  Users, Building2, Stethoscope, FlaskConical, Pill, HeartHandshake, Layers,
  Search, AlertTriangle, Check, X, type LucideIcon,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Toggle } from '@/components/ui/Toggle';
import { cn } from '@/lib/utils';
import { featureApi } from '@/lib/api';
import type { Feature } from '@/lib/actions';
import { AUDIENCE_META, AUDIENCE_ORDER, type FeatureAudience } from '@/lib/platform-meta';

// ─────────────────────────────────────────────────────────────────────────────
// Features — a role picker across the top, that role's switches underneath.
//
// The screen started as one flat list whose only axis was "Patient App /
// Provider App", which told an admin nothing: "provider" covers hospitals, solo
// doctors, standalone labs, standalone pharmacies and consultants.
//
// Grouping by role fixed the meaning but stacked seven tables vertically, so
// reaching the last role meant scrolling past everything above it. Roles are a
// pick-one axis, not a reading order — so they belong in a tab bar, the same
// pattern the organisation detail page uses for its sections.
// ─────────────────────────────────────────────────────────────────────────────

const ICONS: Record<string, LucideIcon> = {
  Users, Building2, Stethoscope, FlaskConical, Pill, HeartHandshake, Layers,
};

// Switches that disable an entire provider category rather than one capability.
const MASTER_KEYS = new Set([
  'individual_doctors',
  'independent_labs',
  'independent_pharmacies',
  'rmp_network',
]);

type Filter = 'all' | 'on' | 'off';

function FeatureRow({
  feature, onToggled,
}: {
  feature: Feature;
  onToggled: (id: string, enabled: boolean) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const isMaster = MASTER_KEYS.has(feature.key);
  const enabled = feature.enabled;

  const toggle = async (next: boolean) => {
    // Optimistic: flip the shared list so the counts move at once, then put it
    // back if the write loses.
    onToggled(feature.id, next);
    setSaving(true);
    setFailed(false);
    try {
      await featureApi.set(feature.id, next);
    } catch (e) {
      console.error('Failed to save feature:', e);
      onToggled(feature.id, !next);
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={cn(
      'flex items-start gap-4 px-4 py-3 border-t border-border transition-colors hover:bg-surface-2',
      isMaster && 'bg-warning-soft/30',
    )}>
      <span className={cn(
        'mt-1.5 w-2 h-2 rounded-full shrink-0',
        enabled ? 'bg-success' : 'bg-danger',
      )} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-700 text-text">{feature.name}</span>
          {isMaster && (
            <Badge variant="warning">
              <AlertTriangle className="w-3 h-3" />
              Master switch
            </Badge>
          )}
          <code className="text-[10px] text-text-muted font-mono hidden lg:inline">{feature.key}</code>
        </div>
        {feature.description && (
          <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">{feature.description}</p>
        )}
        {isMaster && (
          <p className="text-[11px] text-warning font-600 mt-1">
            Turning this off disables every provider in this category, whatever their
            individual switches say.
          </p>
        )}
        {failed && (
          <p className="text-[11px] text-danger font-600 mt-1">
            Could not save — the switch was put back. Try again.
          </p>
        )}
      </div>

      <span className={cn(
        'text-[11px] font-800 tracking-wide shrink-0 mt-1 w-12 text-right',
        saving ? 'text-text-muted' : enabled ? 'text-success' : 'text-text-muted',
      )}>
        {saving ? '…' : enabled ? 'ON' : 'OFF'}
      </span>

      <div className="shrink-0">
        <Toggle checked={enabled} onChange={toggle} disabled={saving} />
      </div>
    </div>
  );
}

export default function FeaturesPage() {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [role, setRole] = useState<FeatureAudience>('patient');

  useEffect(() => {
    let cancelled = false;
    featureApi.list()
      .then((d) => { if (!cancelled) setFeatures(d); })
      .catch((e) => {
        if (cancelled) return;
        console.error('Failed to load features:', e);
        setError(e?.message ?? 'Could not load features.');
      })
      .finally(() => { if (!cancelled) setFetching(false); });
    return () => { cancelled = true; };
  }, []);

  const onToggled = (id: string, enabled: boolean) =>
    setFeatures((prev) => prev.map((f) => (f.id === id ? { ...f, enabled } : f)));

  // Counts per role come from the FULL list, so the tab bar keeps showing where
  // things live even while a search narrows what is on screen.
  const countsByRole = useMemo(() => {
    const m = new Map<FeatureAudience, { on: number; total: number }>();
    AUDIENCE_ORDER.forEach((a) => m.set(a, { on: 0, total: 0 }));
    features.forEach((f) => {
      const c = m.get(f.audience) ?? { on: 0, total: 0 };
      c.total += 1;
      if (f.enabled) c.on += 1;
      m.set(f.audience, c);
    });
    return m;
  }, [features]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return features
      .filter((f) => f.audience === role)
      .filter((f) => {
        if (filter === 'on' && !f.enabled) return false;
        if (filter === 'off' && f.enabled) return false;
        if (!q) return true;
        return (
          f.name.toLowerCase().includes(q) ||
          f.key.toLowerCase().includes(q) ||
          (f.description ?? '').toLowerCase().includes(q)
        );
      })
      // Master switches first — they govern everything under them.
      .sort((a, b) => {
        const am = MASTER_KEYS.has(a.key) ? 0 : 1;
        const bm = MASTER_KEYS.has(b.key) ? 0 : 1;
        if (am !== bm) return am - bm;
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return a.name.localeCompare(b.name);
      });
  }, [features, role, search, filter]);

  const meta = AUDIENCE_META[role] ?? AUDIENCE_META.platform;
  const RoleIcon = ICONS[meta.icon] ?? Layers;
  const roleCount = countsByRole.get(role) ?? { on: 0, total: 0 };
  const totalOn = features.filter((f) => f.enabled).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-800 text-text">Features</h1>
          <p className="text-sm text-text-secondary mt-0.5 max-w-2xl">
            Pick a role, then switch its features on or off. ON means available to
            everyone in that role; OFF closes it in the app immediately.
          </p>
        </div>
        {!fetching && (
          <div className="flex items-center gap-2">
            <Badge variant="success" dot>{totalOn} on</Badge>
            <Badge variant="muted" dot>{features.length - totalOn} off</Badge>
          </div>
        )}
      </div>

      {/* Role picker — the outer section. Horizontal so switching role is one
          click rather than a scroll past every other role's table. */}
      <Card padding="none" className="overflow-hidden">
        <div className="flex items-center overflow-x-auto">
          {AUDIENCE_ORDER.map((a) => {
            const m = AUDIENCE_META[a];
            const Icon = ICONS[m.icon] ?? Layers;
            const c = countsByRole.get(a) ?? { on: 0, total: 0 };
            const active = role === a;
            return (
              <button
                key={a}
                onClick={() => setRole(a)}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-xs font-700 whitespace-nowrap border-b-2 transition-colors shrink-0',
                  active
                    ? 'border-primary text-primary bg-primary-soft/40'
                    : 'border-transparent text-text-secondary hover:text-text hover:border-border',
                )}
              >
                <Icon className="w-4 h-4" />
                {m.label}
                <span className={cn(
                  'text-[10px] font-800 px-1.5 py-0.5 rounded-full',
                  active ? 'bg-primary text-white' : 'bg-surface-3 text-text-secondary',
                )}>
                  {c.total === 0 ? '0' : `${c.on}/${c.total}`}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* The selected role — the inner section */}
      <Card padding="none" className="overflow-hidden">
        <div className="flex items-start justify-between gap-4 px-4 py-3.5 bg-surface-2 border-b border-border flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            <span className="w-9 h-9 rounded-lg bg-primary-soft flex items-center justify-center shrink-0">
              <RoleIcon className="w-4 h-4 text-primary" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-800 text-text">{meta.label}</h2>
              <p className="text-xs text-text-secondary mt-0.5">{meta.blurb}</p>
            </div>
          </div>

          {/* Search + state filter, scoped to the selected role */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                className="w-40 pl-8 pr-2 py-1.5 rounded-lg border border-border bg-surface text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-primary"
              />
            </div>
            <div className="flex items-center bg-surface rounded-lg border border-border p-0.5">
              {([['all', 'All'], ['on', 'On'], ['off', 'Off']] as const).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setFilter(value)}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-[11px] font-700 transition-colors',
                    filter === value ? 'bg-primary text-white' : 'text-text-secondary hover:text-text',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            {roleCount.total > 0 && (
              <Badge variant="success"><Check className="w-3 h-3" />{roleCount.on}</Badge>
            )}
            {roleCount.total - roleCount.on > 0 && (
              <Badge variant="muted"><X className="w-3 h-3" />{roleCount.total - roleCount.on}</Badge>
            )}
          </div>
        </div>

        {fetching ? (
          <p className="text-sm text-text-muted text-center py-10">Loading features…</p>
        ) : error ? (
          <p className="text-sm text-danger text-center py-10">{error}</p>
        ) : visible.length === 0 ? (
          <p className="text-xs text-text-muted text-center py-10 px-4">
            {roleCount.total === 0
              ? 'No switches for this role yet — nothing in the apps is gated on it. Run migrations 060 and 063 if you expect some here.'
              : 'Nothing matches that search in this role.'}
          </p>
        ) : (
          visible.map((f) => (
            <FeatureRow key={f.id} feature={f} onToggled={onToggled} />
          ))
        )}
      </Card>
    </div>
  );
}
