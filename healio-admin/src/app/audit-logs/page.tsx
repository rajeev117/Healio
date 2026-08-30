'use client';
import { Search, ScrollText } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { auditApi } from '@/lib/api';
import type { AuditLog } from '@/types';

const moduleColors: Record<string, 'primary' | 'info' | 'warning' | 'success' | 'danger' | 'muted'> = {
  'Feature Flags': 'warning', Users: 'info', Financial: 'success',
  Organisations: 'primary', 'Sub-Admins': 'danger',
};

export default function AuditLogsPage() {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    auditApi.list()
      .then(setAuditLogs)
      .catch((e) => console.error('Failed to load audit logs:', e));
  }, []);

  const filtered = auditLogs.filter(l =>
    !search || l.adminName.toLowerCase().includes(search.toLowerCase()) || l.action.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-800 text-text">Audit Logs</h1>
        <p className="text-sm text-text-secondary mt-0.5">Every admin action is recorded here</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
        <input type="text" placeholder="Search logs..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="pl-9 pr-3 py-2 w-full bg-surface border border-border rounded-lg text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-primary" />
      </div>

      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-text-muted font-600 border-b border-border bg-surface-2">
                <th className="px-4 py-3">Admin</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Module</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">Organisation</th>
                <th className="px-4 py-3">IP</th>
                <th className="px-4 py-3">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((log) => (
                <tr key={log.id} className="hover:bg-surface-2 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar name={log.adminName} size="sm" />
                      <div>
                        <p className="font-700 text-text">{log.adminName}</p>
                        <p className="text-[10px] text-text-muted capitalize">{log.adminRole.replace('_', ' ')}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-600 text-text">{log.action}</td>
                  <td className="px-4 py-3"><Badge variant={moduleColors[log.module] || 'muted'}>{log.module}</Badge></td>
                  <td className="px-4 py-3 text-text-secondary">{log.target}</td>
                  <td className="px-4 py-3 text-text-secondary">{log.orgName || '—'}</td>
                  <td className="px-4 py-3 font-mono text-[10px] text-text-muted">{log.ip}</td>
                  <td className="px-4 py-3 text-text-muted">
                    {new Date(log.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
