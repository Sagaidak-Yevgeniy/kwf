import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLang } from '../i18n';
import { api } from '../lib/api';
import { DataTable } from '../components/ui/core';

// Organizer wizard (§38): steps with states
export function Organizer() {
  const { t } = useLang();
  const STEPS = [t('o.sInformation'), t('o.sCategories'), t('o.sAthletes'), t('o.sWeighin'), t('o.sSeeding'), t('o.sBrackets'), t('o.sSchedule'), t('o.sReview'), t('o.sPublish')];
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ name: '', city: '', country: '', start_date: '2026-11-01' });
  const [msg, setMsg] = useState('');
  const create = async () => {
    try {
      const tt = await api('/api/tournaments', { method: 'POST', body: JSON.stringify({ ...form, organization: 'KWF' }) });
      setMsg(`${t('o.created')} #${tt.id}. ${t('o.createdHint')}`);
    } catch (e: any) { setMsg(`${t('common.err')}: ` + e.message); }
  };
  return (
    <div className="space-y-5 max-w-3xl fade-up">
      <div><span className="eyebrow">{t('o.eyebrow')}</span>
        <h1 className="display text-3xl font-semibold mt-1">{t('o.title')}</h1></div>
      <div className="card p-5">
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3" aria-label={t('o.title')}>
          {STEPS.map((s, i) => (
            <button key={s} onClick={() => setStep(i)} className={`step text-left${i < step ? ' done' : ''}${i === step ? ' now' : ''}`}>
              <span className="step-dot">{i < step ? '✓' : i + 1}</span>
              <span><span className="block text-[11px] font-bold" style={{ color: 'var(--muted)' }}>{t('o.step')} {String(i + 1).padStart(2, '0')}</span>
              <span className="block text-sm font-bold">{s}</span></span>
            </button>
          ))}
        </div>
      </div>
      <div className="card p-5 md:p-6 space-y-3">
        <div className="display text-lg font-semibold">{STEPS[step]}</div>
        {step === 0 && (<>
          <input aria-label={t('n.fTitle')} className="field w-full" placeholder={t('n.fTitle')} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <div className="grid grid-cols-3 gap-2">
            <input aria-label={t('c.city')} className="field" placeholder={t('c.city')} value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
            <input aria-label={t('a.country')} className="field" placeholder={t('a.country')} value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} />
            <input aria-label={t('a.date')} type="date" className="field" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
          </div>
          <button className="btn-primary text-sm" onClick={create}>{t('o.create')}</button>
          {msg && <div className="text-sm">{msg}</div>}
        </>)}
        {step > 0 && <div className="text-sm" style={{ color: 'var(--muted)' }}>{t('o.wizardHint')}</div>}
        <div className="flex gap-2">
          <button className="btn-ghost text-sm !py-2" onClick={() => setStep(s => Math.max(0, s - 1))}>{t('o.back')}</button>
          <button className="btn-ghost text-sm !py-2" onClick={() => setStep(s => Math.min(STEPS.length - 1, s + 1))}>{t('o.next')}</button>
        </div>
      </div>
      <AuditLog />
    </div>
  );
}

// Audit log (§32): who did what and when — organizer/admin only
export function AuditLog() {
  const { t } = useLang();
  const { data } = useQuery({ queryKey: ['audit'], queryFn: () => api('/api/audit?limit=50') });
  if (!data) return null;
  return (
    <div className="space-y-2">
      <h2 className="font-bold">{t('o.audit')}</h2>
      <DataTable cols={[t('o.aAction'), t('o.aObj'), t('o.aWho'), t('o.aWhen')]}
        rows={data.map((a: any) => [a.action, `${a.entity} #${a.entity_id ?? '—'}`, `#${a.actor ?? '—'}`, a.at])} />
    </div>
  );
}

function LoginForm({ onDone }: { onDone: (role: string) => void }) {
  const { t } = useLang();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const submit = async () => {
    try {
      const r = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      setMsg('✓');
      onDone(r.role);
    } catch (e: any) { setMsg(`${t('common.err')}: ` + e.message); }
  };
  return (
    <div className="space-y-3">
      <input aria-label={t('me.email')} className="field w-full" placeholder={t('me.email')} value={email} onChange={e => setEmail(e.target.value)} />
      <input aria-label={t('me.pass')} type="password" className="field w-full" placeholder={t('me.pass')} value={password} onChange={e => setPassword(e.target.value)} />
      <button className="btn-primary w-full text-sm justify-center" onClick={submit}>{t('me.in')}</button>
      {msg && <div className="text-sm">{msg}</div>}
    </div>
  );
}

function RegisterForm() {
  const { t } = useLang();
  const [form, setForm] = useState({ email: '', password: '', full_name: '', role: 'athlete' });
  const [msg, setMsg] = useState('');
  const submit = async () => {
    try { await api('/api/auth/register', { method: 'POST', body: JSON.stringify(form) }); setMsg(t('me.okReg')); }
    catch (e: any) { setMsg(`${t('common.err')}: ` + e.message); }
  };
  return (
    <div className="space-y-3">
      <input aria-label={t('me.name')} className="field w-full" placeholder={t('me.name')} value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
      <input aria-label={t('me.email')} className="field w-full" placeholder={t('me.email')} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
      <input aria-label={t('me.pass')} type="password" className="field w-full" placeholder={t('me.pass')} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
      <select aria-label={t('me.role')} className="field w-full" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
        {['athlete', 'coach', 'referee', 'public'].map(r => <option key={r} value={r}>{t(`role.${r}`)}</option>)}
      </select>
      <button className="btn-primary w-full text-sm justify-center" onClick={submit}>{t('me.doReg')}</button>
      {msg && <div className="text-sm">{msg}</div>}
    </div>
  );
}

function OrgRequestForm() {
  const { t } = useLang();
  const [form, setForm] = useState({ org_name: '', message: '' });
  const [msg, setMsg] = useState('');
  const submit = async () => {
    try { await api('/api/auth/request-organizer', { method: 'POST', body: JSON.stringify(form) }); setMsg(t('me.sent')); }
    catch (e: any) { setMsg(`${t('common.err')}: ` + e.message); }
  };
  return (
    <div className="space-y-3">
      <p className="text-sm" style={{ color: 'var(--muted)' }}>{t('me.reqHint')}</p>
      <input aria-label={t('me.orgName')} className="field w-full" placeholder={t('me.orgName')} value={form.org_name} onChange={e => setForm({ ...form, org_name: e.target.value })} />
      <textarea aria-label={t('me.orgMsg')} className="field w-full" rows={3} placeholder={t('me.orgMsg')} value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} />
      <button className="btn-ghost w-full text-sm justify-center" onClick={submit}>{t('me.send')}</button>
      {msg && <div className="text-sm">{msg}</div>}
    </div>
  );
}

function AdminRequests() {
  const { t } = useLang();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['orgreq'], queryFn: () => api('/api/admin/organizer-requests') });
  if (!data) return null;
  const decide = async (id: number, approve: boolean) => {
    await api(`/api/admin/organizer-requests/${id}/decision?approve=${approve}`, { method: 'POST' });
    qc.invalidateQueries({ queryKey: ['orgreq'] });
  };
  return (
    <div className="space-y-2">
      <h2 className="font-bold">{t('me.adminT')}</h2>
      {!data.length ? <div className="text-sm" style={{ color: 'var(--muted)' }}>{t('me.noReq')}</div> :
        data.map((r: any) => (
          <div key={r.id} className="card p-3 flex flex-wrap items-center gap-3 text-sm">
            <div className="flex-1"><b>{r.org_name}</b> — {r.user} ({r.email}){r.message && <span className="block" style={{ color: 'var(--muted)' }}>{r.message}</span>}</div>
            <button className="btn-primary text-xs !py-1.5" onClick={() => decide(r.id, true)}>{t('me.approve')}</button>
            <button className="btn-ghost text-xs !py-1.5" onClick={() => decide(r.id, false)}>{t('me.reject')}</button>
          </div>
        ))}
    </div>
  );
}

// Auth hub: login + registration + organizer request + admin review
export function Auth() {
  const { t } = useLang();
  const [mode, setMode] = useState<'login' | 'reg'>('login');
  const [role, setRole] = useState<string | null>(null);
  useEffect(() => { api('/api/auth/me').then(m => setRole(m.role)).catch(() => {}); }, []);
  return (
    <div className="space-y-4 max-w-md mx-auto fade-up">
      <div><span className="eyebrow">{t('me.eyebrow')}</span>
        <h1 className="display text-3xl font-semibold mt-1">{t('me.login')}</h1>
        {role && <div className="mt-1"><span className="badge badge-gold">{t(`role.${role}`)}</span></div>}</div>
      <div className="card p-5 space-y-4">
        <div className="tabs">
          <button className="tab" aria-selected={mode === 'login'} onClick={() => setMode('login')}>{t('me.in')}</button>
          <button className="tab" aria-selected={mode === 'reg'} onClick={() => setMode('reg')}>{t('me.reg')}</button>
        </div>
        {mode === 'login' ? <LoginForm onDone={setRole} /> : <RegisterForm />}
      </div>
      <div className="card p-5 space-y-3">
        <h2 className="font-bold">{t('me.reqT')}</h2>
        <OrgRequestForm />
      </div>
      {(role === 'admin') && <AdminRequests />}
    </div>
  );
}

// legacy export
export const Login = Auth;
