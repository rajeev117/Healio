'use client';
import { useState, useEffect } from 'react';
import { Send, Bell, Users, Building2, Clock, CheckCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import { pushApi } from '@/lib/api';

type PushNotif = { id: string; title: string; body: string; audience: string; sentAt: string; delivered: number; opened: number };

const AUDIENCE_OPTIONS = ['All Users', 'All Patients', 'All Providers', 'Specific Organisation'] as const;

export default function NotificationsPage() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<string>('All Users');
  const [sent, setSent] = useState(false);
  const [history, setHistory] = useState<PushNotif[]>([]);

  useEffect(() => {
    pushApi.list().then((d) => setHistory(d as PushNotif[])).catch(() => {});
  }, []);

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) return;
    try {
      const rec = await pushApi.send({ title: title.trim(), body: body.trim(), audience });
      setHistory((prev) => [rec as PushNotif, ...prev]);
      setSent(true);
      setTimeout(() => setSent(false), 3000);
      setTitle('');
      setBody('');
    } catch (e) {
      console.error('Failed to send notification:', e);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-800 text-text">Push Notifications</h1>
        <p className="text-sm text-text-secondary mt-0.5">Broadcast push notifications to app users</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Compose */}
        <Card padding="lg" className="lg:col-span-1">
          <h2 className="text-sm font-800 text-text mb-4">Compose Notification</h2>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-700 text-text-secondary mb-1.5 block">Title</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Notification title..."
                className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-xs font-700 text-text-secondary mb-1.5 block">Body</label>
              <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Notification body text..." rows={3}
                className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-primary resize-none" />
            </div>
            <div>
              <label className="text-xs font-700 text-text-secondary mb-1.5 block">Audience</label>
              <div className="space-y-1.5">
                {AUDIENCE_OPTIONS.map(opt => (
                  <button key={opt} onClick={() => setAudience(opt)}
                    className={cn('w-full text-left px-3 py-2 rounded-lg border text-xs font-600 transition-colors',
                      audience === opt ? 'border-primary bg-primary-soft text-primary' : 'border-border text-text-secondary hover:border-border-strong')}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {sent ? (
              <div className="flex items-center gap-2 px-4 py-3 bg-success-soft rounded-lg">
                <CheckCircle className="w-4 h-4 text-success" />
                <span className="text-sm font-700 text-success">Notification sent!</span>
              </div>
            ) : (
              <button onClick={handleSend} disabled={!title.trim() || !body.trim()}
                className={cn('w-full flex items-center justify-center gap-2 py-3 bg-primary text-white text-sm font-700 rounded-lg hover:bg-primary-hover transition-colors',
                  (!title.trim() || !body.trim()) && 'opacity-50 cursor-not-allowed')}>
                <Send className="w-4 h-4" />Send Notification
              </button>
            )}
          </div>
        </Card>

        {/* History */}
        <Card padding="md" className="lg:col-span-2">
          <CardHeader><CardTitle>Sent Notifications</CardTitle></CardHeader>
          <div className="space-y-3">
            {history.length === 0 && (
              <p className="text-sm text-text-muted py-6 text-center">No notifications sent yet.</p>
            )}
            {history.map(notif => (
              <div key={notif.id} className="flex items-start gap-3 p-3 rounded-xl bg-surface-2 hover:bg-surface-3 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-primary-soft flex items-center justify-center shrink-0 mt-0.5">
                  <Bell className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-700 text-text">{notif.title}</p>
                  <p className="text-xs text-text-secondary mt-0.5">{notif.body}</p>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <Badge variant="muted">{notif.audience}</Badge>
                    <span className="flex items-center gap-1 text-[10px] text-text-muted"><Clock className="w-3 h-3" />{notif.sentAt ? new Date(notif.sentAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : ''}</span>
                  </div>
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
