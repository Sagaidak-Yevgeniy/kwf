import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useLang } from '../i18n';
import { api } from '../lib/api';
import { DataTable, EmptyState, Skeleton } from '../components/ui/core';

const CATS = ['events', 'tournaments', 'clubs', 'results', 'announcements'];

// Public document verification (§19): enter/scan QR code → validity + details
export function Verify() {
  const { t } = useLang();
  const { code: routeCode } = useParams();
  const [code, setCode] = useState(routeCode ?? '');
  const [submitted, setSubmitted] = useState(routeCode ?? '');
  const { data, isFetching } = useQuery({
    queryKey: ['verify', submitted],
    queryFn: () => api(`/api/documents/verify/${submitted}`),
    enabled: submitted.length > 0,
  });
  return (
    <div className="space-y-4 max-w-lg mx-auto fade-up">
      <div><span className="eyebrow">{t('v.eyebrow')}</span>
        <h1 className="display text-3xl font-semibold mt-1">{t('v.title')}</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>{t('v.sub')}</p></div>
      <div className="flex gap-2">
        <input aria-label={t('v.title')} className="field flex-1 uppercase"
               placeholder={t('v.ph')} value={code}
               onChange={e => setCode(e.target.value.toUpperCase())} />
        <button className="btn-primary text-sm" onClick={() => setSubmitted(code.trim())}>{t('v.btn')}</button>
      </div>
      {isFetching && <Skeleton />}
      {data && !data.valid && <div className="card p-5 text-center font-bold">{t('v.invalid')}</div>}
      {data?.valid && (
        <div className="card p-5 space-y-1 text-sm">
          <div className="font-black text-base" style={{ color: 'var(--accent)' }}>{t('v.valid')}</div>
          <div>{t('v.id')}: {data.code}</div>
          <div>{t('v.athlete')}: {data.athlete}</div>
          <div>{t('v.tournament')}: {data.tournament} · {data.date}</div>
          {data.category && <div>{t('v.category')}: {data.category}</div>}
          {data.place && <div>{t('v.place')}: {data.place} {t('v.placeN')}</div>}
          <a className="inline-block mt-2 underline" href={`/api/documents/${data.code}/certificate.pdf`}>{t('v.pdf')}</a>
        </div>
      )}
    </div>
  );
}

function catName(t: (k: string) => string, c: string) {
  const names = t('n.cats').split(',');
  const i = CATS.indexOf(c);
  return i >= 0 ? names[i] : c;
}

export function News() {
  const { t } = useLang();
  const { data } = useQuery({ queryKey: ['news'], queryFn: () => api('/api/news') });
  if (!data) return <Skeleton className="h-60" />;
  if (!data.length) return <EmptyState title={t('n.empty')} hint={t('n.emptyHint')} />;
  return (
    <div className="space-y-3">
      <div className="flex items-center">
        <div className="flex-1"><span className="eyebrow">{t('nav.news')}</span>
          <h1 className="display text-3xl font-semibold mt-1">{t('n.title')}</h1></div>
        <Link to="/news/new" className="card px-3 py-1.5 text-sm font-semibold">{t('n.new')}</Link></div>
      {data.map((n: any) => (
        <article key={n.id} className="card p-4">
          <div className="text-xs font-bold uppercase" style={{ color: 'var(--accent)' }}>{catName(t, n.category)}</div>
          <Link to={`/news/${n.slug}`} className="font-bold">{n.title}</Link>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>{n.excerpt}</p>
        </article>
      ))}
    </div>
  );
}

export function NewsDetail() {
  const { slug } = useParams();
  const { data } = useQuery({ queryKey: ['news', slug], queryFn: () => api(`/api/news/${slug}`) });
  if (!data) return <Skeleton className="h-60" />;
  return (
    <article className="card p-6 max-w-2xl space-y-3 fade-up">
      <div className="text-xs font-bold uppercase" style={{ color: 'var(--accent)' }}>{data.category}</div>
      <h1 className="display text-2xl md:text-3xl font-semibold">{data.title}</h1>
      <p className="text-sm whitespace-pre-wrap leading-relaxed">{data.body}</p>
    </article>
  );
}

// Minimal news editor (§18): no full CMS, just the fields that matter
export function NewsEditor() {
  const { t } = useLang();
  const nav = useNavigate();
  const [form, setForm] = useState({ title: '', slug: '', excerpt: '', body: '', category: 'events' });
  const [msg, setMsg] = useState('');
  const set = (k: string) => (e: any) => setForm({ ...form, [k]: e.target.value });
  const save = async () => {
    try {
      const r = await api('/api/news', { method: 'POST', body: JSON.stringify(form) });
      nav(`/news/${r.slug}`);
    } catch (e: any) { setMsg(`${t('common.err')}: ` + e.message); }
  };
  return (
    <div className="card p-5 max-w-2xl space-y-3 fade-up">
      <h1 className="display text-2xl font-semibold">{t('n.create')}</h1>
      <input aria-label={t('n.fTitle')} className="field w-full" placeholder={t('n.fTitle')} value={form.title}
             onChange={e => { set('title')(e); if (!form.slug) setForm(f => ({ ...f, title: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9а-яёәіңғүұқөһү]+/gi, '-').slice(0, 60) })); }} />
      <div className="grid grid-cols-2 gap-2">
        <input aria-label={t('n.fSlug')} className="field" placeholder={t('n.fSlug')} value={form.slug} onChange={set('slug')} />
        <select aria-label={t('n.fCat')} className="field" value={form.category} onChange={set('category')}>
          {CATS.map((c, i) => <option key={c} value={c}>{t('n.cats').split(',')[i]}</option>)}
        </select>
      </div>
      <input aria-label={t('n.fExcerpt')} className="field w-full" placeholder={t('n.fExcerpt')} value={form.excerpt} onChange={set('excerpt')} />
      <textarea aria-label={t('n.fBody')} className="field w-full" rows={10} placeholder={t('n.fBody')} value={form.body} onChange={set('body')} />
      <button className="btn-primary text-sm" onClick={save}>{t('n.publish')}</button>
      {msg && <div className="text-sm">{msg}</div>}
    </div>
  );
}

// Export buttons (§21) + results/medal table (§47) for tournament page
export function ExportBar({ tid }: { tid: string }) {
  const { t } = useLang();
  const files = [
    ['participants.csv', t('exp.pcsv')],
    ['participants.xlsx', t('exp.pxlsx')],
    ['schedule.csv', t('exp.scsv')],
    ['protocol.pdf', t('exp.proto')],
  ];
  return (
    <div className="flex gap-2 flex-wrap">
      {files.map(([f, label]) => (
        <a key={f} className="card px-3 py-1.5 text-sm font-semibold" href={`/api/tournaments/${tid}/export/${f}`}>{label}</a>
      ))}
    </div>
  );
}

export function Results({ tid }: { tid: string }) {
  const { t } = useLang();
  const { data } = useQuery({ queryKey: ['results', tid], queryFn: () => api(`/api/tournaments/${tid}/results`) });
  if (!data) return <Skeleton className="h-40" />;
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-bold mb-2">{t('res.champs')}</h3>
        <DataTable cols={[t('res.category'), t('res.champ'), t('res.finalists')]}
          rows={data.standings.map((s: any, i: number) => [s.category, s.champion, s.finalists.join(', ') || '—'])} />
      </div>
      {!!data.medal_table?.length && (
        <div>
          <h3 className="font-bold mb-2">{t('res.medals')}</h3>
          <DataTable cols={[t('res.athlete'), t('res.club'), t('res.gold'), t('res.titles')]}
            rows={data.medal_table.map((m: any, i: number) => [m.athlete, m.club, m.gold, m.titles.join(', ')])} />
        </div>
      )}
      <ReportBlock tid={tid} />
    </div>
  );
}

// Auto-generated post-tournament report (§46): stats + news draft, organizer reviews
export function ReportBlock({ tid }: { tid: string }) {
  const { t, lang } = useLang();
  const { data } = useQuery({ queryKey: ['report', tid, lang], queryFn: () => api(`/api/tournaments/${tid}/report?lang=${lang}`) });
  const [msg, setMsg] = useState('');
  if (!data) return <Skeleton className="h-32" />;
  const s = data.stats;
  const createNews = async () => {
    try {
      await api('/api/news', { method: 'POST', body: JSON.stringify({
        title: `${data.tournament}: ${lang === 'kk' ? 'қорытынды' : 'итоги'}`,
        slug: `t${tid}-results-${Date.now() % 100000}`,
        excerpt: `${s.participants} · ${s.fights_finished}/${s.fights_total}`,
        body: data.markdown, category: 'results' }) });
      setMsg('✓');
    } catch (e: any) { setMsg(`${t('common.err')}: ` + e.message); }
  };
  return (
    <div className="card p-4 space-y-2">
      <div className="font-bold">{t('res.report')}</div>
      <div className="text-sm" style={{ color: 'var(--muted)' }}>{data.markdown.split('\n')[2] || ''}</div>
      <pre className="text-xs card p-3 whitespace-pre-wrap" style={{ background: 'var(--bg)' }}>{data.markdown}</pre>
      <div className="flex gap-2 items-center">
        <button className="btn-primary text-sm" onClick={createNews}>{t('res.mkNews')}</button>
        {msg && <span className="text-sm">{msg}</span>}
      </div>
    </div>
  );
}
