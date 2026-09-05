'use client';
import { useState, useEffect } from 'react';
import {
  Send, Bell, Clock, CheckCircle, AlertTriangle, Smartphone,
} from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import { pushApi } from '@/lib/api';
import { PUSH_AUDIENCE_OPTIONS } from '@/lib/platform-meta';

// ─────────────────────────────────────────────────────────────────────────────
// Push Notifications.
//
// These used to be broadcast rows and nothing more: the apps polled the
// push_notifications table and rendered an in-app list, `delivered` was
// hardcoded to 0, and no device was ever contacted. Sending now fans the
// message out to real Expo push tokens (device_tokens, migration-059) and
// reports what Expo actually accepted.
//
// The old "Specific Organisation" option is gone — nothing implemented org
// targeting, so it would have silently gone to nobody (or, worse, everybody).
// Audiences here map onto real roles; see PUSH_AUDIENCES in platform-meta.
// ─────────────────────────────────────────────────────────────────────────────

type PushNotif = {
  id: string; title: string; body: string; audience: string; sentAt: string;
  delivered: number; opened: number; failed?: number; sendError?: string | null;
};

export default function NotificationsPage() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<string>('All Users');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<PushNotif | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<PushNotif[]>([]);
  const [reach, setReach] = useState<number | null>(null);

  useEffect(() => {
    pushApi.list().then((d) => setHistory(d as PushNotif[])).catch(() => {});
  }, []);

  // How many devices this audience currently reaches, so the admin knows
  // before sending whether anyone is actually registered. `reachKey` bumps
  // after a send so the count refreshes without re-picking the audience.
  const [reachKey, setReachKey] = useState(0);
  useEffect(() => {
    let cancelled = false;
    pushApi.countAudience(audience)
      .then((n) => { if (!cancelled) setReach(n); })
      .catch(() => { if (!cancelled) setReach(0); });
    return () => { cancelled = true; };
  }, [audience, reachKey]);

  const handleSend = async () => {
    if (!title.trim() || !body.trim() || sending) return;
    setSending(true);
    setError(null);
    setResult(null);
    try {
      const rec = await pushApi.send({ title: title.trim(), body: body.trim(), audience }) as PushNotif;
      setHistory((prev) => [rec, ...prev]);
      setResult(rec);
      setTitle('');
      setBody('');
      setReachKey((k) => k + 1);
      setTimeout(() => setResult(null), 8000);
    } catch (e) {
      console.error('Failed to send notification:', e);
      setError(e instanceof Error ? e.message : 'Could not send the notification.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-800 text-text">Push Notifications</h1>
        <p className="text-sm text-text-secondary mt-0.5 max-w-2xl">
          Broadcast to app users. The message is delivered as a real device push
          and also appears in each recipient&apos;s in-app notifications list.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Compose */}
        <Card padding="lg" className="lg:col-span-1">
          <h2 className="text-sm font-800 text-text mb-4">Compose Notification</h2>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-700 text-text-secondary mb-1.5 block">Title</label>
              <input
                type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="Notification title…"
                className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="text-xs font-700 text-text-secondary mb-1.5 block">Body</label>
              <textarea
                value={body} onChange={(e) => setBody(e.target.value)}
                placeholder="Notification body text…" rows={3}
                className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-primary resize-none"
              />
            </div>

            <div>
              <label className="text-xs font-700 text-text-secondary mb-1.5 block">Audience</label>
              <div className="space-y-1.5">
                {PUSH_AUDIENCE_OPTIONS.map((opt) => (
                  <button
                    key={opt} onClick={() => setAudience(opt)}
                    className={cn(
                      'w-full text-left px-3 py-2 rounded-lg border text-xs font-600 transition-colors',
                      audience === opt
                        ? 'border-primary bg-primary-soft text-primary'
                        : 'border-border text-text-secondary hover:border-border-strong',
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Reach */}
            <div className={cn(
              'flex items-start gap-2 px-3 py-2.5 rounded-lg',
              reach === 0 ? 'bg-warning-soft' : 'bg-surface-2',
            )}>
              {reach === 0
                ? <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                : <Smartphone className="w-4 h-4 text-text-muted shrink-0 mt-0.5" />}
              <p className="text-[11px] text-text-secondary leading-relaxed">
                {reach === null
                  ? 'Checking registered devices…'
                  : reach === 0
                    ? 'No registered devices for this audience. Push tokens register on login from a development or production build — Expo Go cannot receive push on Android. The message will still be saved to the in-app list.'
                    : <>Will reach <strong className="text-text font-700">{reach.toLocaleString()}</strong> device{reach === 1 ? '' : 's'}.</>}
              </p>
            </div>

            {result && (
              <div className="flex items-start gap-2 px-4 py-3 bg-success-soft rounded-lg">
                <CheckCircle className="w-4 h-4 text-success shrink-0 mt-0.5" />
                <div className="text-xs text-success">
                  <p className="font-700">Sent.</p>
                  <p className="mt-0.5">
                    {result.delivered.toLocaleString()} delivered
                    {result.failed ? `, ${result.failed.toLocaleString()} failed` : ''}.
                  </p>
                  {result.sendError && (
                    <p className="mt-0.5 text-warning">Expo reported: {result.sendError}</p>
                  )}
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 px-4 py-3 bg-danger-soft rounded-lg">
                <AlertTriangle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
                <span className="text-xs font-600 text-danger">{error}</span>
              </div>
            )}

            <button
              onClick={handleSend}
              disabled={!title.trim() || !body.trim() || sending}
              className={cn(
                'w-full flex items-center justify-center gap-2 py-3 bg-primary text-white text-sm font-700 rounded-lg hover:bg-primary-hover transition-colors',
                (!title.trim() || !body.trim() || sending) && 'opacity-50 cursor-not-allowed',
              )}
            >
              <Send className="w-4 h-4" />
              {sending ? 'Sending…' : 'Send Notification'}
            </button>
          </div>
        </Card>

        {/* History */}
        <Card padding="md" className="lg:col-span-2">
          <CardHeader><CardTitle>Sent Notifications</CardTitle></CardHeader>
          <div className="space-y-3">
            {history.length === 0 && (
              <p className="text-sm text-text-muted py-6 text-center">No notifications sent yet.</p>
            )}
            {history.map((notif) => (
              <div key={notif.id} className="flex items-start gap-3 p-3 rounded-xl bg-surface-2 hover:bg-surface-3 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-primary-soft flex items-center justify-center shrink-0 mt-0.5">
                  <Bell className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-700 text-text">{notif.title}</p>
                  <p className="text-xs text-text-secondary mt-0.5">{notif.body}</p>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <Badge variant="muted">{notif.audience}</Badge>
                    <span className="flex items-center gap-1 text-[10px] text-text-muted">
                      <Clock className="w-3 h-3" />
                      {notif.sentAt
                        ? new Date(notif.sentAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
                        : ''}
                    </span>
                    {!!notif.failed && (
                      <Badge variant="warning">{notif.failed.toLocaleString()} failed</Badge>
                    )}
                  </div>
                  {notif.sendError && (
                    <p className="text-[10px] text-warning mt-1">{notif.sendError}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-700 text-text">{notif.delivered.toLocaleString()}</p>
                  <p className="text-[10px] text-text-muted">delivered</p>
                  <p className="text-xs font-700 text-success mt-1">{notif.opened.toLocaleString()}</p>
                  <p className="text-[10px] text-text-muted">opened</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
