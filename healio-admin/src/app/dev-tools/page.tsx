'use client';
import { useState, useEffect } from 'react';
import {
  FlaskConical, User, UserCog, Building2, CalendarClock,
  Package, Trash2, CheckCircle, RefreshCw, ShieldAlert,
  Plus, Zap, AlertTriangle,
} from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { ConfirmModal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';
import { devApi } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────
type TestRecord = {
  id: string;
  type: 'patient' | 'provider' | 'organisation' | 'appointment' | 'order';
  label: string;
  detail: string;
  createdAt: string;
};

type ScenarioStatus = 'idle' | 'running' | 'done';

// ── Test scenarios ────────────────────────────────────────────────────────────
const SCENARIOS = [
  {
    id: 'onboarding',
    icon: Building2,
    color: 'text-primary',
    bg: 'bg-primary-soft',
    title: 'Full Onboarding Flow',
    description: 'Creates a test org → pending status → ready for onboarding queue approval',
    seeds: ['1 organisation (pending)', '1 contact person', '2 documents'],
  },
  {
    id: 'appointment',
    icon: CalendarClock,
    color: 'text-info',
    bg: 'bg-info-soft',
    title: 'Appointment Lifecycle',
    description: 'Creates a patient + provider + scheduled appointment ready to confirm/cancel',
    seeds: ['1 test patient', '1 test doctor', '1 scheduled appointment'],
  },
  {
    id: 'dispute',
    icon: AlertTriangle,
    color: 'text-danger',
    bg: 'bg-danger-soft',
    title: 'Dispute & Refund Cycle',
    description: 'Creates a completed appointment with a disputed charge and pending refund',
    seeds: ['1 completed appointment', '1 open dispute', '1 pending refund'],
  },
  {
    id: 'order',
    icon: Package,
    color: 'text-warning',
    bg: 'bg-warning-soft',
    title: 'Order Pipeline',
    description: 'Creates a pharmacy + lab + homecare order across 3 statuses',
    seeds: ['1 pharmacy order', '1 lab order', '1 homecare order'],
  },
  {
    id: 'rmp',
    icon: User,
    color: 'text-success',
    bg: 'bg-success-soft',
    title: 'Healthcare Consultant Booking Flow',
    description: 'Creates a healthcare consultant + linked patient + appointment with ₹60 partner incentive',
    seeds: ['1 healthcare consultant account (rmps table)', '1 linked patient', '1 appointment (rmp_id set)', '1 partner incentive entry (₹60)'],
  },
];

// ── Preset accounts ───────────────────────────────────────────────────────────
// OTP for all accounts (test mode): 1111
// Supabase auth email = 91<phone>@healio.app  e.g. 919000000001@healio.app
const PRESETS = [
  // Hospital / Org Admin
  { id: 'tp1', role: 'organisation' as const, label: 'Hospital Admin',       email: '919000000001@healio.app', phone: '+91 90000 00001', org: 'Healio City Hospital (HOSP-2451)' },

  // Provider roles — all registered under Healio City Hospital
  { id: 'tp2', role: 'provider' as const,     label: 'Doctor (General)',     email: '919000000002@healio.app', phone: '+91 90000 00002', org: 'Healio City Hospital' },
  { id: 'tp3', role: 'provider' as const,     label: 'Doctor (Specialist)',  email: '919000000007@healio.app', phone: '+91 90000 00007', org: 'Healio City Hospital' },
  { id: 'tp4', role: 'provider' as const,     label: 'Lab Technician',       email: '919000000003@healio.app', phone: '+91 90000 00003', org: 'Healio Diagnostics' },
  { id: 'tp5', role: 'provider' as const,     label: 'Pharmacist',           email: '919000000004@healio.app', phone: '+91 90000 00004', org: 'Healio Pharmacy' },
  { id: 'tp6', role: 'provider' as const,     label: 'OPD / Receptionist',   email: '919000000005@healio.app', phone: '+91 90000 00005', org: 'Healio City Hospital' },

  // RMP Partner (standalone healio-rmp-mobile app — sign up first, then log in)
  { id: 'tp7', role: 'provider' as const,     label: 'Healthcare Consultant', email: '919000000006@healio.app', phone: '+91 90000 00006', org: 'Independent (sign up as consultant first)' },

  // Patient (helio-patient-mobile app)
  { id: 'tp8', role: 'patient' as const,      label: 'Patient Alpha',        email: '919100000001@healio.app', phone: '+91 91000 00001', org: '—' },
  { id: 'tp9', role: 'patient' as const,      label: 'Patient Beta',         email: '919100000002@healio.app', phone: '+91 91000 00002', org: '—' },
];

const roleIcon: Record<string, React.ElementType> = { patient: User, provider: UserCog, organisation: Building2 };

// ── Page ──────────────────────────────────────────────────────────────────────
export default function DevToolsPage() {
  const [createdRecords, setCreatedRecords] = useState<TestRecord[]>([]);
  const [scenarioStatus, setScenarioStatus] = useState<Record<string, ScenarioStatus>>({});
  const [seededPresets, setSeededPresets] = useState<Set<string>>(new Set());
  const [clearConfirm, setClearConfirm] = useState(false);
  const [clearLoading, setClearLoading] = useState(false);
  const [clearError,   setClearError]   = useState<string | null>(null);

  // ── Build Test User — Organisation / Patient / Provider ─────────────────────
  type AccountKind = 'organisation' | 'patient' | 'provider';
  const ACCOUNT_KINDS: { value: AccountKind; label: string; icon: typeof User }[] = [
    { value: 'organisation', label: 'Organisation', icon: Building2 },
    { value: 'patient',      label: 'Patient',       icon: User      },
    { value: 'provider',     label: 'Provider',      icon: UserCog   },
  ];
  const [accountKind, setAccountKind] = useState<AccountKind>('patient');

  type CustomRole = 'doctor' | 'opd_assistant' | 'pharmacy_assistant' | 'lab_technician' | 'nurse' | 'receptionist';
  const PROVIDER_ROLES: { value: CustomRole; label: string }[] = [
    { value: 'doctor',              label: 'Doctor'            },
    { value: 'opd_assistant',       label: 'OPD Assistant'     },
    { value: 'pharmacy_assistant',  label: 'Pharmacy Asst.'    },
    { value: 'lab_technician',      label: 'Lab Technician'    },
    { value: 'nurse',               label: 'Nurse / Home Care' },
    { value: 'receptionist',        label: 'Receptionist'      },
  ];
  const ORG_TYPES: { value: string; label: string }[] = [
    { value: 'hospital',   label: 'Hospital'   },
    { value: 'clinic',     label: 'Clinic'     },
    { value: 'diagnostic', label: 'Diagnostic' },
    { value: 'pharmacy',   label: 'Pharmacy'   },
  ];
  const DEPT_OPTIONS = ['General', 'Cardiology', 'Orthopaedics', 'Dermatology', 'Paediatrics', 'Pathology', 'Pharmacy'];

  // Shared fields
  const [customName, setCustomName] = useState('');
  const [customPhone, setCustomPhone] = useState('');
  const [customOrgId, setCustomOrgId] = useState('');
  const [realOrgs, setRealOrgs] = useState<{ id: string; name: string }[]>([]);
  const [creating, setCreating] = useState(false);
  const [createDone, setCreateDone] = useState(false);

  // Provider-only fields
  const [customRole, setCustomRole] = useState<CustomRole>('doctor');
  const [specialty, setSpecialty] = useState('');
  const [department, setDepartment] = useState('');
  const [fee, setFee] = useState('');

  // Patient-only fields
  const [gender, setGender] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [age, setAge] = useState('');
  const [walletBalance, setWalletBalance] = useState('');

  // Organisation-only fields
  const [orgCity, setOrgCity] = useState('');
  const [orgType, setOrgType] = useState('hospital');
  const [orgBeds, setOrgBeds] = useState('');
  const [orgDepts, setOrgDepts] = useState<string[]>(['General']);
  const [orgFee, setOrgFee] = useState('');
  const toggleOrgDept = (d: string) =>
    setOrgDepts(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);

  // Load real organisations for the picker
  useEffect(() => {
    devApi.listOrgs().then(setRealOrgs).catch(() => {});
  }, []);

  // Live count of test rows in the database
  const [dbCount, setDbCount] = useState(0);
  const refreshCount = () => devApi.count().then(setDbCount).catch(() => {});
  useEffect(() => { refreshCount(); }, []);

  const totalTestRecords = dbCount;

  const logRecord = (type: string, label: string, detail: string) =>
    setCreatedRecords(prev => [...prev, {
      id: `${type}-${Date.now()}-${Math.random()}`,
      type: type as TestRecord['type'],
      label, detail, createdAt: new Date().toLocaleTimeString(),
    }]);

  // Seed a preset account → real DB insert
  const seedPreset = async (preset: typeof PRESETS[number]) => {
    try {
      const rec = preset.role === 'organisation'
        ? await devApi.seedOrg()
        : preset.role === 'provider'
          ? await devApi.seedProvider()
          : await devApi.seedPatient();
      setSeededPresets(prev => new Set([...prev, preset.id]));
      logRecord(rec.type, rec.label, rec.detail);
      await refreshCount();
    } catch (e) {
      console.error('Seed failed:', e);
    }
  };

  const seedAll = async () => {
    for (const p of PRESETS) {
      // eslint-disable-next-line no-await-in-loop
      await seedPreset(p);
    }
  };

  // Run a scenario → real linked inserts
  const runScenario = async (id: string) => {
    setScenarioStatus(s => ({ ...s, [id]: 'running' }));
    try {
      const recs = await devApi.seedScenario(id);
      recs.forEach(r => logRecord(r.type, r.label, r.detail));
      setScenarioStatus(s => ({ ...s, [id]: 'done' }));
      await refreshCount();
      setTimeout(() => setScenarioStatus(s => ({ ...s, [id]: 'idle' })), 3000);
    } catch (e) {
      console.error('Scenario failed:', e);
      setScenarioStatus(s => ({ ...s, [id]: 'idle' }));
    }
  };

  // Create custom account → real DB insert. Branches on accountKind since
  // organisations, patients, and providers each go through a different
  // server action / need different extra fields.
  const createCustom = async () => {
    if (!customName.trim()) return;
    setCreating(true);
    try {
      const rec = accountKind === 'organisation'
        ? await devApi.seedCustomOrg({
            name: customName.trim(),
            city: orgCity.trim() || undefined,
            type: orgType as 'hospital' | 'clinic' | 'diagnostic' | 'pharmacy',
            beds: orgBeds ? Number(orgBeds) : undefined,
            departments: orgDepts.length ? orgDepts : undefined,
            consultationFee: orgFee ? Number(orgFee) : undefined,
          })
        : await devApi.seedCustom(
            accountKind === 'patient' ? 'patient' : customRole,
            customName.trim(),
            customPhone.trim() || undefined,
            customOrgId || undefined,
            accountKind === 'patient'
              ? {
                  gender: gender || undefined,
                  bloodGroup: bloodGroup || undefined,
                  age: age ? Number(age) : undefined,
                  walletBalance: walletBalance ? Number(walletBalance) : undefined,
                }
              : {
                  specialty: specialty.trim() || undefined,
                  department: department.trim() || undefined,
                  fee: fee ? Number(fee) : undefined,
                },
          );
      logRecord(rec.type, rec.label, rec.detail);
      setCreateDone(true);
      // Reset only the fields relevant to what was just created
      setCustomName(''); setCustomPhone('');
      setSpecialty(''); setDepartment(''); setFee('');
      setGender(''); setBloodGroup(''); setAge(''); setWalletBalance('');
      setOrgCity(''); setOrgBeds(''); setOrgFee(''); setOrgDepts(['General']);
      await refreshCount();
      setTimeout(() => setCreateDone(false), 2000);
    } catch (e) {
      console.error('Custom create failed:', e);
    } finally {
      setCreating(false);
    }
  };

  // Clear all test data → real bulk delete
  const clearAll = async () => {
    setClearLoading(true);
    setClearError(null);
    try {
      await devApi.cleanup();
      setCreatedRecords([]);
      setSeededPresets(new Set());
      setScenarioStatus({});
      await refreshCount();
      setClearConfirm(false);
    } catch (e: any) {
      // Show the actual error so it's actionable — don't silently swallow it
      setClearError(e?.message ?? 'Cleanup failed. Check the browser console for details.');
      console.error('Cleanup failed:', e);
    } finally {
      setClearLoading(false);
    }
  };

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-800 text-text">Dev Tools</h1>
            <Badge variant="warning">Dev Only</Badge>
          </div>
          <p className="text-sm text-text-secondary mt-0.5">Seed test accounts and scenarios directly into the database</p>
        </div>
        {totalTestRecords > 0 && (
          <button onClick={() => setClearConfirm(true)}
            className="flex items-center gap-2 px-4 py-2 border border-danger text-danger text-xs font-700 rounded-lg hover:bg-danger-soft transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
            Clear All Test Data ({totalTestRecords})
          </button>
        )}
      </div>

      {/* Warning banner */}
      <Card padding="sm" className="bg-warning-soft border-warning/30">
        <div className="flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 text-warning shrink-0" />
          <p className="text-xs text-warning font-600">
            All records created here are flagged <code className="bg-warning/10 px-1 py-0.5 rounded font-mono">is_test: true</code> and can be bulk-deleted at any time. Never use this in production with real patient data present.
          </p>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Left — Scenarios + Custom */}
        <div className="lg:col-span-2 space-y-5">

          {/* Test Scenarios */}
          <Card padding="lg">
            <CardHeader>
              <div className="flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-primary" />
                <CardTitle>Test Scenarios</CardTitle>
              </div>
              <p className="text-xs text-text-muted">One-click multi-record seeds</p>
            </CardHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SCENARIOS.map(s => {
                const status = scenarioStatus[s.id] ?? 'idle';
                const Icon = s.icon;
                return (
                  <div key={s.id} className={cn(
                    'rounded-xl border p-4 transition-all',
                    status === 'done' ? 'border-success/40 bg-success-soft/30' : 'border-border hover:border-border-strong hover:shadow-sm',
                  )}>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', s.bg)}>
                        <Icon className={cn('w-4 h-4', s.color)} />
                      </div>
                      {status === 'done' && <CheckCircle className="w-4 h-4 text-success shrink-0 mt-0.5" />}
                    </div>
                    <p className="text-xs font-800 text-text mb-1">{s.title}</p>
                    <p className="text-[11px] text-text-secondary leading-relaxed mb-3">{s.description}</p>
                    <div className="flex flex-wrap gap-1 mb-3">
                      {s.seeds.map(seed => (
                        <span key={seed} className="text-[10px] bg-surface-2 border border-border text-text-secondary px-2 py-0.5 rounded-full">{seed}</span>
                      ))}
                    </div>
                    <button onClick={() => runScenario(s.id)} disabled={status === 'running'}
                      className={cn(
                        'w-full flex items-center justify-center gap-1.5 py-2 text-xs font-700 rounded-lg transition-colors',
                        status === 'done'
                          ? 'bg-success text-white'
                          : status === 'running'
                          ? 'bg-surface-2 text-text-muted cursor-not-allowed'
                          : 'bg-primary text-white hover:bg-primary-hover',
                      )}>
                      {status === 'running' ? (
                        <><RefreshCw className="w-3.5 h-3.5 animate-spin" />Seeding…</>
                      ) : status === 'done' ? (
                        <><CheckCircle className="w-3.5 h-3.5" />Seeded!</>
                      ) : (
                        <><Zap className="w-3.5 h-3.5" />Run Scenario</>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Build Test User */}
          <Card padding="lg">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-info" />
                <CardTitle>Build Test User</CardTitle>
              </div>
              <p className="text-xs text-text-muted">Auto-generates login credentials — no email needed.</p>
            </CardHeader>
            <div className="space-y-4">
              {/* Account kind */}
              <div>
                <p className="text-xs font-700 text-text mb-2">Account Type</p>
                <div className="flex flex-wrap gap-2">
                  {ACCOUNT_KINDS.map(k => {
                    const Icon = k.icon;
                    return (
                      <button key={k.value} onClick={() => setAccountKind(k.value)}
                        className={cn('flex items-center gap-1.5 px-3 py-1.5 text-xs font-700 rounded-lg border transition-colors',
                          accountKind === k.value ? 'bg-primary text-white border-primary' : 'border-border text-text-secondary hover:border-border-strong')}>
                        <Icon className="w-3.5 h-3.5" />
                        {k.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Provider role chips — only when building a provider */}
              {accountKind === 'provider' && (
                <div>
                  <p className="text-xs font-700 text-text mb-2">Provider Role</p>
                  <div className="flex flex-wrap gap-2">
                    {PROVIDER_ROLES.map(r => (
                      <button key={r.value} onClick={() => setCustomRole(r.value)}
                        className={cn('px-3 py-1.5 text-xs font-700 rounded-lg border transition-colors',
                          customRole === r.value ? 'bg-primary text-white border-primary' : 'border-border text-text-secondary hover:border-border-strong')}>
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Name + phone — shared by patient & provider; organisation uses Name as the hospital name */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-700 text-text mb-1.5">
                    {accountKind === 'organisation' ? 'Hospital / Org Name *' : 'Name *'}
                  </label>
                  <input type="text" value={customName} onChange={e => setCustomName(e.target.value)}
                    placeholder={accountKind === 'organisation' ? 'e.g. Sunrise Multispecialty' : 'e.g. Rajan Mehta'}
                    className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-primary" />
                </div>
                {accountKind !== 'organisation' && (
                  <div>
                    <label className="block text-xs font-700 text-text mb-1.5">Phone (optional)</label>
                    <input type="tel" value={customPhone} onChange={e => setCustomPhone(e.target.value)}
                      placeholder="10-digit (auto if blank)"
                      className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-primary" />
                  </div>
                )}
              </div>

              {/* Organisation extra fields */}
              {accountKind === 'organisation' && (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-700 text-text mb-1.5">Type</label>
                      <select value={orgType} onChange={e => setOrgType(e.target.value)}
                        className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-xs text-text focus:outline-none focus:border-primary">
                        {ORG_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-700 text-text mb-1.5">City (optional)</label>
                      <input type="text" value={orgCity} onChange={e => setOrgCity(e.target.value)}
                        placeholder="Random if blank"
                        className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-primary" />
                    </div>
                    <div>
                      <label className="block text-xs font-700 text-text mb-1.5">Beds (optional)</label>
                      <input type="number" value={orgBeds} onChange={e => setOrgBeds(e.target.value)}
                        placeholder="Random if blank"
                        className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-primary" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-700 text-text mb-1.5">Departments</label>
                    <div className="flex flex-wrap gap-2">
                      {DEPT_OPTIONS.map(d => (
                        <button key={d} onClick={() => toggleOrgDept(d)}
                          className={cn('px-2.5 py-1 text-[11px] font-700 rounded-full border transition-colors',
                            orgDepts.includes(d) ? 'bg-primary text-white border-primary' : 'border-border text-text-secondary hover:border-border-strong')}>
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-700 text-text mb-1.5">Default Consultation Fee (optional)</label>
                    <input type="number" value={orgFee} onChange={e => setOrgFee(e.target.value)}
                      placeholder="e.g. 500"
                      className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-primary" />
                  </div>
                </>
              )}

              {/* Patient extra fields */}
              {accountKind === 'patient' && (
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-700 text-text mb-1.5">Gender</label>
                    <select value={gender} onChange={e => setGender(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-xs text-text focus:outline-none focus:border-primary">
                      <option value="">Random</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-700 text-text mb-1.5">Blood Group</label>
                    <select value={bloodGroup} onChange={e => setBloodGroup(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-xs text-text focus:outline-none focus:border-primary">
                      <option value="">Random</option>
                      {['A+', 'B+', 'O+', 'AB+', 'A-', 'O-'].map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-700 text-text mb-1.5">Age</label>
                    <input type="number" value={age} onChange={e => setAge(e.target.value)}
                      placeholder="Random"
                      className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="block text-xs font-700 text-text mb-1.5">Wallet (₹)</label>
                    <input type="number" value={walletBalance} onChange={e => setWalletBalance(e.target.value)}
                      placeholder="e.g. 1000"
                      className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-primary" />
                  </div>
                </div>
              )}

              {/* Provider extra fields */}
              {accountKind === 'provider' && (
                <div className="grid grid-cols-3 gap-3">
                  {customRole === 'doctor' && (
                    <div>
                      <label className="block text-xs font-700 text-text mb-1.5">Specialty</label>
                      <input type="text" value={specialty} onChange={e => setSpecialty(e.target.value)}
                        placeholder="Random if blank"
                        className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-primary" />
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-700 text-text mb-1.5">
                      {customRole === 'lab_technician' ? 'Lab / Department name' : 'Department'}
                    </label>
                    <input type="text" value={department} onChange={e => setDepartment(e.target.value)}
                      placeholder={customRole === 'lab_technician' ? 'e.g. Pathology Lab' : 'Default if blank'}
                      className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-primary" />
                  </div>
                  {customRole === 'doctor' && (
                    <div>
                      <label className="block text-xs font-700 text-text mb-1.5">Consultation Fee (optional)</label>
                      <input type="number" value={fee} onChange={e => setFee(e.target.value)}
                        placeholder="Hospital default"
                        className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-primary" />
                    </div>
                  )}
                </div>
              )}

              {/* Organisation picker — patient/provider only; org-builder doesn't need this */}
              {accountKind !== 'organisation' && (
                <div>
                  <label className="block text-xs font-700 text-text mb-1.5">Organisation (leave blank → use test org)</label>
                  <select value={customOrgId} onChange={e => setCustomOrgId(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-xs text-text focus:outline-none focus:border-primary">
                    <option value="">— Auto / Test Org —</option>
                    {realOrgs.map(o => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <button onClick={createCustom}
                disabled={creating || !customName.trim()}
                className={cn(
                  'w-full flex items-center justify-center gap-2 py-2.5 text-xs font-700 rounded-lg transition-colors',
                  createDone ? 'bg-success text-white' : 'bg-primary text-white hover:bg-primary-hover',
                  (creating || !customName.trim()) && 'opacity-60 cursor-not-allowed',
                )}>
                {createDone ? <><CheckCircle className="w-3.5 h-3.5" />Created!</>
                  : creating ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" />Creating…</>
                  : <><Plus className="w-3.5 h-3.5" />Create Test Account</>}
              </button>
            </div>
          </Card>
        </div>

        {/* Right — Preset accounts + log */}
        <div className="space-y-5">

          {/* Preset accounts */}
          <Card padding="lg">
            <CardHeader>
              <CardTitle>Preset Accounts</CardTitle>
              <button onClick={seedAll} className="text-[10px] font-700 text-primary hover:underline">Seed All</button>
            </CardHeader>
            <div className="space-y-2">
              {PRESETS.map(p => {
                const Icon = roleIcon[p.role];
                const seeded = seededPresets.has(p.id);
                return (
                  <div key={p.id} className={cn(
                    'flex items-center gap-3 p-2.5 rounded-xl border transition-all',
                    seeded ? 'border-success/30 bg-success-soft/20' : 'border-border hover:border-border-strong',
                  )}>
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                      p.role === 'patient' ? 'bg-info-soft' : p.role === 'provider' ? 'bg-primary-soft' : 'bg-warning-soft',
                    )}>
                      <Icon className={cn('w-4 h-4', p.role === 'patient' ? 'text-info' : p.role === 'provider' ? 'text-primary' : 'text-warning')} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-700 text-text truncate">{p.label}</p>
                      <p className="text-[10px] text-text-muted truncate">📞 {p.phone} · OTP: 1111</p>
                      <p className="text-[10px] text-text-muted truncate">🏥 {p.org}</p>
                    </div>
                    {seeded ? (
                      <CheckCircle className="w-4 h-4 text-success shrink-0" />
                    ) : (
                      <button onClick={() => seedPreset(p)}
                        className="text-[10px] font-700 text-primary hover:underline shrink-0">
                        Seed
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Session log */}
          <Card padding="none">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h3 className="text-xs font-800 text-text">Session Log</h3>
              <Badge variant={totalTestRecords > 0 ? 'warning' : 'muted'}>{totalTestRecords} records</Badge>
            </div>
            {createdRecords.length === 0 ? (
              <div className="py-10 text-center">
                <FlaskConical className="w-7 h-7 text-border-strong mx-auto mb-2" />
                <p className="text-xs text-text-muted">No test records created yet</p>
              </div>
            ) : (
              <div className="divide-y divide-border max-h-72 overflow-y-auto">
                {[...createdRecords].reverse().map(record => {
                  const Icon = roleIcon[record.type as keyof typeof roleIcon] ?? Package;
                  return (
                    <div key={record.id} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="w-6 h-6 rounded-md bg-surface-2 flex items-center justify-center shrink-0">
                        <Icon className="w-3.5 h-3.5 text-text-muted" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-700 text-text truncate">{record.label}</p>
                        <p className="text-[10px] text-text-muted truncate">{record.detail}</p>
                      </div>
                      <span className="text-[10px] text-text-muted shrink-0 font-mono">{record.createdAt}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>

      <ConfirmModal
        open={clearConfirm}
        onClose={() => { setClearConfirm(false); setClearError(null); }}
        onConfirm={clearAll}
        loading={clearLoading}
        title="Clear All Test Data"
        message={
          clearError
            ? `❌ Cleanup failed:\n\n${clearError}`
            : `This will delete all ${totalTestRecords} test records (patients, providers, organisations, appointments, orders) — including appointments created through the patient app that belong to test hospitals. Real data will not be affected.`
        }
        confirmLabel={clearError ? 'Retry' : 'Clear All Test Data'}
        confirmVariant="danger"
      />
    </div>
  );
}
