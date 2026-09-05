'use client';
import { useState } from 'react';
import { Skull, AlertTriangle, Trash2, CheckCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';
import { dangerApi } from '@/lib/api';
import type { WipeReport, WipePreview } from '@/lib/actions';

// ─────────────────────────────────────────────────────────────────────────────
// Danger Zone — wipe every scrap of platform data while leaving the admin
// panel itself able to log in.
//
// Distinct from Dev Tools' "Clean up test data", which only removes rows
// flagged is_test = true. This one empties the real tables, and is what you run
// once before go-live.
//
// Gated three ways: a preview of exactly what will be destroyed, a typed
// confirmation phrase, and a final button that names the row count.
// ─────────────────────────────────────────────────────────────────────────────

const CONFIRM_PHRASE = 'WIPE ALL DATA';

const KEPT = [
  'Feature switches',
  'Platform settings',
  'Pricing rules and banners',
  'Lab test catalogue and SLA rules',
  'Audit logs (including a record of this wipe)',
];

export function DangerZoneWipe() {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<WipePreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [phrase, setPhrase] = useState('');
  const [wiping, setWiping] = useState(false);
  const [report, setReport] = useState<WipeReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const openDialog = async () => {
    setOpen(true);
    setPhrase('');
    setReport(null);
    setError(null);
    setLoadingPreview(true);
    try {
      setPreview(await dangerApi.previewWipe());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read the current row counts.');
      setPreview({ tables: [], survivingAdmins: [] });
    } finally {
      setLoadingPreview(false);
    }
  };

  const totalRows = (preview?.tables ?? []).reduce((n, t) => n + t.rows, 0);
  const admins = preview?.survivingAdmins ?? [];
  // Wiping with no surviving admin locks you out of the panel entirely.
  const lockoutRisk = !loadingPreview && admins.length === 0;
  const armed = phrase.trim().toUpperCase() === CONFIRM_PHRASE && !wiping && !lockoutRisk;

  const runWipe = async () => {
    if (!armed) return;
    setWiping(true);
    setError(null);
    try {
      setReport(await dangerApi.wipeAll());
      setPreview({ tables: [], survivingAdmins: [] });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The wipe failed.');
    } finally {
      setWiping(false);
    }
  };

  return (
    <>
      <Card padding="lg" className="border-danger/40">
        <div className="flex items-center gap-2 mb-4">
          <Skull className="w-4 h-4 text-danger" />
          <h2 className="text-sm font-800 text-danger">Danger Zone</h2>
        </div>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 max-w-xl">
            <p className="text-sm font-700 text-text">Wipe all platform data</p>
            <p className="text-xs text-text-secondary mt-1 leading-relaxed">
              Permanently deletes every organisation, staff member, patient,
              healthcare consultant, appointment, order, prescription, record,
              transaction, wallet, dispute and onboarding application — plus every
              non-admin login. The admin panel keeps working: sub-admins, feature
              switches, platform settings, pricing and banners all survive.
            </p>
            <p className="text-xs text-danger font-700 mt-2">
              This cannot be undone. Take a Supabase backup first.
            </p>
          </div>

          <button
            onClick={openDialog}
            className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-danger text-white text-sm font-700 hover:opacity-90 transition-opacity"
          >
            <Trash2 className="w-4 h-4" />
            Wipe all data
          </button>
        </div>
      </Card>

      <Modal
        open={open}
        onClose={() => !wiping && setOpen(false)}
        title={report ? 'Wipe complete' : 'Wipe all platform data'}
        size="lg"
      >
        {report ? (
          <div className="space-y-4">
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-success-soft">
              <CheckCircle className="w-4 h-4 text-success shrink-0 mt-0.5" />
              <div className="text-xs text-success">
                <p className="font-700">
                  {report.totalDeleted.toLocaleString()} rows and{' '}
                  {report.authUsersDeleted.toLocaleString()} login accounts deleted.
                </p>
                <p className="mt-0.5">
                  {report.adminsKept} admin account{report.adminsKept === 1 ? '' : 's'} kept.
                </p>
              </div>
            </div>

            <div className="max-h-56 overflow-y-auto rounded-xl border border-border">
              <table className="w-full text-xs">
                <tbody>
                  {report.tables.filter((t) => t.deleted > 0 || t.error).map((t) => (
                    <tr key={t.table} className="border-b border-border last:border-0">
                      <td className="py-2 px-3 font-mono text-text-secondary">{t.table}</td>
                      <td className="py-2 px-3 text-right font-700 text-text">
                        {t.error
                          ? <span className="text-danger">{t.error}</span>
                          : t.deleted.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {report.errors.length > 0 && (
              <div className="p-3 rounded-xl bg-warning-soft">
                <p className="text-xs font-700 text-warning mb-1">
                  {report.errors.length} problem{report.errors.length === 1 ? '' : 's'} during the wipe
                </p>
                <ul className="text-[11px] text-warning space-y-0.5 max-h-32 overflow-y-auto">
                  {report.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}

            <button
              onClick={() => { setOpen(false); window.location.reload(); }}
              className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-700 hover:bg-primary-hover transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-danger-soft">
              <AlertTriangle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
              <p className="text-xs text-danger">
                <strong className="font-700">There is no undo.</strong> Everything listed
                below is deleted from the database and every non-admin login account is
                removed from Supabase Auth. Take a backup before continuing.
              </p>
            </div>

            <div>
              <p className="text-[11px] font-700 text-text-muted uppercase tracking-wider mb-2">
                Will be deleted
                {!loadingPreview && (
                  <span className="ml-2 text-danger normal-case tracking-normal">
                    {totalRows.toLocaleString()} rows
                  </span>
                )}
              </p>
              {loadingPreview ? (
                <p className="text-xs text-text-muted">Counting…</p>
              ) : (preview?.tables ?? []).length === 0 ? (
                <p className="text-xs text-text-muted">
                  Nothing to delete — the platform tables are already empty.
                </p>
              ) : (
                <div className="max-h-48 overflow-y-auto rounded-xl border border-border">
                  <table className="w-full text-xs">
                    <tbody>
                      {(preview?.tables ?? []).map((t) => (
                        <tr key={t.table} className="border-b border-border last:border-0">
                          <td className="py-2 px-3 font-mono text-text-secondary">{t.table}</td>
                          <td className="py-2 px-3 text-right font-700 text-text">
                            {t.rows.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Which logins survive. Shown before the confirmation because the
                first version of this feature deleted the only account that could
                reach the panel, and nothing on screen said it would. */}
            <div className={cn('p-3 rounded-xl', lockoutRisk ? 'bg-danger-soft' : 'bg-surface-2')}>
              <p className="text-[11px] font-700 text-text-muted uppercase tracking-wider mb-2">
                Admin logins that will survive
              </p>
              {loadingPreview ? (
                <p className="text-xs text-text-muted">Checking…</p>
              ) : admins.length === 0 ? (
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
                  <p className="text-xs text-danger">
                    <strong className="font-700">None — this would lock you out.</strong>{' '}
                    Create an admin first:
                    <code className="block mt-1 font-mono text-[11px]">
                      node ../supabase/create-admin-user.mjs you@email.com yourpassword
                    </code>
                  </p>
                </div>
              ) : (
                <ul className="text-xs text-text space-y-1">
                  {admins.map((e) => (
                    <li key={e} className="flex items-center gap-2">
                      <CheckCircle className="w-3.5 h-3.5 text-success shrink-0" />
                      <span className="font-mono">{e}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <p className="text-[11px] font-700 text-text-muted uppercase tracking-wider mb-2">
                Also kept
              </p>
              <ul className="text-xs text-text-secondary space-y-1">
                {KEPT.map((k) => (
                  <li key={k} className="flex items-start gap-2">
                    <CheckCircle className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" />
                    {k}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <label className="block text-[11px] font-700 text-text-muted uppercase tracking-wider mb-1.5">
                Type <span className="font-mono text-danger">{CONFIRM_PHRASE}</span> to confirm
              </label>
              <input
                value={phrase}
                onChange={(e) => setPhrase(e.target.value)}
                placeholder={CONFIRM_PHRASE}
                autoComplete="off"
                className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-sm text-text font-mono placeholder:text-text-muted focus:outline-none focus:border-danger"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-danger-soft">
                <AlertTriangle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
                <span className="text-xs font-600 text-danger">{error}</span>
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={() => setOpen(false)}
                disabled={wiping}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-700 text-text-secondary hover:bg-surface-2 transition-colors disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={runWipe}
                disabled={!armed}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-700 transition-opacity',
                  armed ? 'bg-danger hover:opacity-90' : 'bg-danger/40 cursor-not-allowed',
                )}
              >
                <Trash2 className="w-4 h-4" />
                {wiping
                  ? 'Wiping…'
                  : `Delete ${totalRows.toLocaleString()} rows`}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
