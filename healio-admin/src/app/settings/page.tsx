'use client';
import { useEffect, useState } from 'react';
import { Save, Shield, Globe, Bell, Key } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Toggle } from '@/components/ui/Toggle';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import { settingsApi } from '@/lib/api';
import { DangerZoneWipe } from '@/components/DangerZoneWipe';

export default function SettingsPage() {
  const [platformName, setPlatformName] = useState('Healio');
  const [supportEmail, setSupportEmail] = useState('support@healio.in');
  const [minWalletBalance, setMinWalletBalance] = useState('50');
  const [sessionTimeout, setSessionTimeout] = useState('30');
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [twoFactor, setTwoFactor] = useState(true);
  const [auditLogging, setAuditLogging] = useState(true);
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [slackNotifs, setSlackNotifs] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    settingsApi.get().then((s) => {
      setPlatformName(s.platformName);
      setSupportEmail(s.supportEmail);
      setMinWalletBalance(String(s.minWalletBalance));
      setSessionTimeout(String(s.sessionTimeout));
      setMaintenanceMode(s.maintenanceMode);
      setTwoFactor(s.twoFactor);
      setAuditLogging(s.auditLogging);
      setEmailNotifs(s.emailNotifs);
      setSlackNotifs(s.slackNotifs);
    }).catch((e) => console.error('settings load failed', e));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await settingsApi.save({
        platformName, supportEmail,
        minWalletBalance: Number(minWalletBalance) || 0,
        sessionTimeout: Number(sessionTimeout) || 0,
        maintenanceMode, twoFactor, auditLogging, emailNotifs, slackNotifs,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error('settings save failed', e);
      alert('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-800 text-text">Platform Settings</h1>
          <p className="text-sm text-text-secondary mt-0.5">Global configuration for the Healio platform</p>
        </div>
        <button onClick={handleSave} disabled={saving}
          className={cn('flex items-center gap-2 px-4 py-2 text-xs font-700 rounded-lg transition-colors disabled:opacity-60',
            saved ? 'bg-success text-white' : 'bg-primary text-white hover:bg-primary-hover')}>
          {saved ? 'Saved!' : saving ? 'Saving…' : <><Save className="w-3.5 h-3.5" />Save Changes</>}
        </button>
      </div>

      {/* General */}
      <Card padding="lg">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-800 text-text">General</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-700 text-text-secondary mb-1.5 block">Platform Name</label>
            <input type="text" value={platformName} onChange={e => setPlatformName(e.target.value)}
              className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary" />
          </div>
          <div>
            <label className="text-xs font-700 text-text-secondary mb-1.5 block">Support Email</label>
            <input type="email" value={supportEmail} onChange={e => setSupportEmail(e.target.value)}
              className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary" />
          </div>
          <div>
            <label className="text-xs font-700 text-text-secondary mb-1.5 block">Minimum Wallet Balance for Booking (₹)</label>
            <input type="number" value={minWalletBalance} onChange={e => setMinWalletBalance(e.target.value)}
              className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary" />
            <p className="text-[10px] text-text-muted mt-1">Patients need at least this much in their wallet to book appointments</p>
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-700 text-text">Maintenance Mode</p>
              <p className="text-xs text-text-secondary mt-0.5">Temporarily disable all patient/provider apps</p>
            </div>
            <Toggle checked={maintenanceMode} onChange={setMaintenanceMode} />
          </div>
        </div>
      </Card>

      {/* Security */}
      <Card padding="lg">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4 text-danger" />
          <h2 className="text-sm font-800 text-text">Security</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-700 text-text-secondary mb-1.5 block">Admin Session Timeout (minutes)</label>
            <input type="number" value={sessionTimeout} onChange={e => setSessionTimeout(e.target.value)}
              className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary" />
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-700 text-text">Two-Factor Authentication</p>
              <p className="text-xs text-text-secondary mt-0.5">Require 2FA for all admin logins</p>
            </div>
            <Toggle checked={twoFactor} onChange={setTwoFactor} />
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-700 text-text">Audit Logging</p>
              <p className="text-xs text-text-secondary mt-0.5">Log every admin action with timestamps and IP</p>
            </div>
            <Toggle checked={auditLogging} onChange={setAuditLogging} />
          </div>
        </div>
      </Card>

      {/* Notifications */}
      <Card padding="lg">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-4 h-4 text-warning" />
          <h2 className="text-sm font-800 text-text">Admin Notifications</h2>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-700 text-text">Email Alerts</p>
              <p className="text-xs text-text-secondary mt-0.5">SLA breaches, disputes, critical events</p>
            </div>
            <Toggle checked={emailNotifs} onChange={setEmailNotifs} />
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-700 text-text">Slack Integration</p>
              <p className="text-xs text-text-secondary mt-0.5">Post alerts to a Slack channel</p>
            </div>
            <Toggle checked={slackNotifs} onChange={setSlackNotifs} />
          </div>
        </div>
      </Card>

      {/* API */}
      <Card padding="lg">
        <div className="flex items-center gap-2 mb-4">
          <Key className="w-4 h-4 text-info" />
          <h2 className="text-sm font-800 text-text">API Configuration</h2>
        </div>
        <div className="space-y-3">
          <div className="bg-surface-2 rounded-lg p-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-700 text-text">API Base URL</p>
              <p className="text-xs text-text-muted font-mono mt-0.5">https://api.healio.in/v1</p>
            </div>
            <Badge variant="success" dot>Connected</Badge>
          </div>
          <div className="bg-surface-2 rounded-lg p-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-700 text-text">WebSocket URL</p>
              <p className="text-xs text-text-muted font-mono mt-0.5">wss://ws.healio.in</p>
            </div>
            <Badge variant="success" dot>Connected</Badge>
          </div>
          <div className="bg-surface-2 rounded-lg p-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-700 text-text">Database</p>
              <p className="text-xs text-text-muted font-mono mt-0.5">PostgreSQL 16 — healio_prod</p>
            </div>
            <Badge variant="success" dot>Healthy</Badge>
          </div>
        </div>
      </Card>

      {/* Danger Zone — full platform wipe (keeps the admin panel itself) */}
      <DangerZoneWipe />
    </div>
  );
}
