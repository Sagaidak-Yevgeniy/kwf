import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useLang } from '../i18n';
import { api } from '../lib/api';
import { DataTable, Skeleton, Badge } from '../components/ui/core';

export function Athletes() {
  const { t } = useLang();
  const [q, setQ] = useState('');
  const { data } = useQuery({ queryKey: ['athletes', q], queryFn: () => api(`/api/athletes?q=${encodeURIComponent(q)}`) });
  if (!data) return <Skeleton className="h-60" />;
  return <div className="space-y-4"><div><span className="eyebrow">{t('a.eyebrow')}</span><h1 className="display text-3xl font-semibold mt-1">{t('a.title')}</h1></div>
    <input aria-label={t('a.searchPh')} className="field w-full" placeholder={t('a.searchPh')} value={q} onChange={e => setQ(e.target.value)} />
    <DataTable cols={[t('a.name'), t('a.country'), t('a.weight'), t('a.points'), t('a.wl')]}
      rows={data.map((a: any) => [<Link key={a.id} to={`/athletes/${a.id}`} className="font-semibold">{a.name}</Link>, a.country, a.weight, a.points, `${a.wins}-${a.losses}`])} /></div>;
}

export function AthleteDetail() {
  const { t } = useLang();
  const { id } = useParams();
  const RESULT: Record<string, string> = { champion: t('r.champion'), finalist: t('r.finalist'), semifinalist: t('r.semi'), participant: t('r.part'), registered: t('r.reg') };
  const { data } = useQuery({ queryKey: ['athlete', id], queryFn: () => api(`/api/athletes/${id}`) });
  if (!data) return <Skeleton className="h-60" />;
  return (
    <div className="space-y-4 max-w-2xl">
      <div><Link to="/athletes" className="text-[13px] font-semibold" style={{ color: 'var(--muted)' }}>{t('a.back')}</Link>
        <h1 className="display text-3xl font-semibold mt-1">{data.name}</h1>
        <div className="text-sm" style={{ color: 'var(--muted)' }}>
          {data.gender === 'male' ? t('a.men') : t('a.women')} · {data.birth_year} {t('a.born')} · {data.weight} {t('w.kg')} · {data.level} · {data.country}
        </div>
        <div className="mt-1 text-sm">{t('a.club')}: {data.club_id ? <Link to={`/clubs/${data.club_id}`}>{data.club}</Link> : data.club} · {t('a.points')}: <b>{data.points}</b> · {t('a.wl')}: {data.wins}-{data.losses}</div></div>
      <h2 className="font-bold">{t('a.history')}</h2>
      {!data.history.length ? <div className="card p-4 text-sm" style={{ color: 'var(--muted)' }}>{t('a.noHist')}</div> :
        <DataTable cols={[t('a.tournament'), t('a.date'), t('res.category'), t('a.result')]}
          rows={data.history.map((h: any, i: number) => [<Link key={i} to={`/tournaments/${h.tournament_id}`}>{h.tournament}</Link>, h.date, h.category, <Badge key={i} tone="gold">{RESULT[h.result] ?? h.result}</Badge>])} />}
    </div>
  );
}

export function Rankings() {
  const { t } = useLang();
  const [gender, setGender] = useState('');
  const [country, setCountry] = useState('');
  const [wmax, setWmax] = useState('');
  const qs = `gender=${gender}&country=${country}${wmax ? `&weight_max=${wmax}` : ''}`;
  const { data } = useQuery({ queryKey: ['rankings', qs], queryFn: () => api(`/api/rankings?${qs}`) });
  if (!data) return <Skeleton className="h-60" />;
  return <div className="space-y-4"><div><span className="eyebrow">{t('rk.eyebrow')}</span><h1 className="display text-3xl font-semibold mt-1">{t('rk.title')}</h1></div>
    <div className="flex gap-2 flex-wrap text-sm">
      <select aria-label={t('a.men') + '/' + t('a.women')} className="field" value={gender} onChange={e => setGender(e.target.value)}>
        <option value="">{t('rk.all')}</option><option value="male">{t('rk.men')}</option><option value="female">{t('rk.women')}</option>
      </select>
      <input aria-label={t('rk.country')} className="field w-28" placeholder={t('rk.country')} value={country} onChange={e => setCountry(e.target.value)} />
      <input aria-label={t('rk.wmax')} className="field w-32" placeholder={t('rk.wmax')} inputMode="decimal" value={wmax} onChange={e => setWmax(e.target.value)} />
    </div>
    <DataTable cols={[t('rk.rank'), t('a.name'), t('rk.weight'), t('a.points'), t('a.wl')]}
      rows={data.map((r: any) => [r.rank, <Link key={r.id} to={`/athletes/${r.id}`}>{r.name}</Link>, r.weight, r.points, `${r.wins}-${r.losses}`])} /></div>;
}

export function Clubs() {
  const { t } = useLang();
  const { data } = useQuery({ queryKey: ['clubs'], queryFn: () => api('/api/clubs') });
  if (!data) return <Skeleton className="h-60" />;
  return <div className="space-y-4"><div><span className="eyebrow">{t('c.eyebrow')}</span><h1 className="display text-3xl font-semibold mt-1">{t('c.title')}</h1></div>
    <DataTable cols={[t('res.club'), t('a.country'), t('c.city'), t('c.coach')]}
      rows={data.map((c: any) => [<Link key={c.id} to={`/clubs/${c.id}`} className="font-semibold">{c.name}</Link>, c.country, c.city, c.coach])} /></div>;
}

export function ClubDetail() {
  const { t } = useLang();
  const { id } = useParams();
  const { data } = useQuery({ queryKey: ['club', id], queryFn: () => api(`/api/clubs/${id}`) });
  if (!data) return <Skeleton className="h-60" />;
  return (
    <div className="space-y-4 max-w-2xl">
      <div><Link to="/clubs" className="text-[13px] font-semibold" style={{ color: 'var(--muted)' }}>{t('c.back')}</Link>
        <h1 className="display text-3xl font-semibold mt-1">{data.name}</h1>
        <div className="text-sm" style={{ color: 'var(--muted)' }}>{data.country} · {data.city} · {t('c.coach')}: {data.coach} · {t('c.titles')}: {data.titles}</div></div>
      <h2 className="font-bold">{t('c.athletes')}</h2>
      <DataTable cols={[t('a.name'), t('a.points'), t('a.wl')]}
        rows={data.athletes.map((a: any) => [<Link key={a.id} to={`/athletes/${a.id}`}>{a.name}</Link>, a.points, `${a.wins}-${a.losses}`])} />
    </div>
  );
}

export function LiveAll() {
  const { t } = useLang();
  const { data } = useQuery({ queryKey: ['tournaments-live'], queryFn: () => api('/api/tournaments?status=live') });
  return <div className="space-y-4"><div><span className="eyebrow">{t('l.eyebrow')}</span><h1 className="display text-3xl font-semibold mt-1">{t('l.title')}</h1></div>
    {!data?.length ? <div className="card p-8 text-center text-sm" style={{ color: 'var(--muted)' }}>{t('l.empty')}</div> :
      data.map((x: any) => <Link key={x.id} to={`/tournaments/${x.id}?tab=live`} className="card card-hover p-4 flex items-center gap-3 font-bold"><span className="pulse-dot" />{x.name}</Link>)}</div>;
}
