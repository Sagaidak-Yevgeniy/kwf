import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { CalendarDays, MapPin, Users, Layers, Clock, CheckCircle2, AlertTriangle, ArrowRight, Tv, Swords, Trophy } from 'lucide-react';
import { useLang } from '../i18n';
import { api } from '../lib/api';
import { Badge, EmptyState, Skeleton } from '../components/ui/core';
import { ExportBar, Results } from './Documents';
import { STATUS_TONE, FLOW } from '../components/ui/tournament';

const TABS = ['overview', 'participants', 'brackets', 'schedule', 'live', 'results', 'weighin'] as const;

export function TournamentDetail() {
  const { t, lang } = useLang();
  const TAB_RU: Record<string, string> = {
    overview: t('tab.overview'), participants: t('tab.participants'), brackets: t('tab.brackets'),
    schedule: t('tab.schedule'), live: t('tab.live'), results: t('tab.results'), weighin: t('tab.weighin'),
  };
  const FLOW_RU: Record<string, string> = {
    upcoming: t('d.flow1'), registration: t('d.flow2'), live: t('d.flow3'), finished: t('d.flow4'),
  };
  const { id } = useParams();
  const [sp] = useSearchParams();
  const initial = TABS.includes(sp.get('tab') as any) ? sp.get('tab') as typeof TABS[number] : 'overview';
  const [tab, setTab] = useState<typeof TABS[number]>(initial);
  const qc = useQueryClient();
  const { data: tt } = useQuery({ queryKey: ['t', id], queryFn: () => api(`/api/tournaments/${id}`) });
  const { data: regs } = useQuery({ queryKey: ['regs', id], queryFn: () => api(`/api/tournaments/${id}/registrations`), enabled: tab === 'participants' || tab === 'weighin' });
  const { data: brackets } = useQuery({ queryKey: ['br', id], queryFn: () => api(`/api/tournaments/${id}/brackets`), enabled: tab === 'brackets' || tab === 'overview' || tab === 'schedule' });
  const { data: validation } = useQuery({ queryKey: ['val', id, lang], queryFn: () => api(`/api/tournaments/${id}/validate?lang=${lang}`), enabled: tab === 'overview' });
  const genB = useMutation({ mutationFn: () => api(`/api/tournaments/${id}/brackets/generate`, { method: 'POST' }), onSuccess: () => qc.invalidateQueries({ queryKey: ['br'] }) });
  const genS = useMutation({ mutationFn: () => api(`/api/tournaments/${id}/schedule/generate`, { method: 'POST' }), onSuccess: () => qc.invalidateQueries() });
  const [flowMsg, setFlowMsg] = useState('');
  const advance = async (status: string) => {
    try {
      await api(`/api/tournaments/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) });
      setFlowMsg('');
      qc.invalidateQueries({ queryKey: ['t', id] });
    } catch (e: any) { setFlowMsg(e.message); }
  };
  const NEXT: Record<string, { to: string; label: string }> = {
    upcoming: { to: 'registration', label: t('ov.toReg') },
    registration: { to: 'live', label: t('ov.toLive') },
    live: { to: 'finished', label: t('ov.toFin') },
  };
  // realtime: single SSE only on live tab
  const [liveEvents, setLiveEvents] = useState<any[]>([]);
  useEffect(() => {
    if (tab !== 'live' || !id) return;
    const es = new EventSource(`/api/tournaments/${id}/live/stream`);
    es.onmessage = e => setLiveEvents(p => [...p.slice(-19), JSON.parse(e.data)]);
    return () => es.close();
  }, [tab, id]);
  if (!tt) return <Skeleton className="h-60" />;
  const flowIdx = FLOW.indexOf(tt.status);
  const checksOk = validation?.filter((v: any) => v.ok).length ?? 0;
  return (
    <div className="space-y-5 fade-up">
      <div className="t-head">
        <div className="t-head-top" />
        <div className="p-5 md:p-7">
          <Link to="/tournaments" className="text-[13px] font-semibold" style={{ color: 'var(--muted)' }}>{t('d.back')}</Link>
          <div className="flex flex-wrap items-center gap-3 mt-1.5">
            <h1 className="display text-2xl md:text-[34px] font-semibold">{tt.name}</h1>
            <Badge tone={STATUS_TONE[tt.status] ?? 'gray'}>{tt.status}</Badge>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5">
            <span className="chip"><CalendarDays size={14} />{tt.start_date}</span>
            <span className="chip"><MapPin size={14} />{tt.city}{tt.country ? `, ${tt.country}` : ''}</span>
            <span className="chip"><Users size={14} />{tt.participants}</span>
            <span className="chip"><Layers size={14} />{tt.categories?.length ?? 0} {t('d.cats')}</span>
          </div>
          <div className="flow mt-4" aria-label={tt.name}>
            {FLOW.map((s, i) => (
              <span key={s} className="flex items-center">
                {i > 0 && <span className={`flow-line${i <= flowIdx ? ' done' : ''}`} />}
                <span className={`flow-step${i < flowIdx ? ' done' : ''}${i === flowIdx ? ' now' : ''}`}>
                  <span className="flow-dot">{i < flowIdx ? '✓' : i + 1}</span>{FLOW_RU[s]}
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="tabs" role="tablist" aria-label={tt.name}>
        {TABS.map(x => <button key={x} role="tab" className="tab" aria-selected={tab === x} onClick={() => setTab(x)}>{TAB_RU[x]}</button>)}
      </div>
      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: Users, label: t('ov.participants'), value: tt.participants },
              { icon: Layers, label: t('ov.categories'), value: tt.categories?.length ?? 0 },
              { icon: Swords, label: t('ov.brackets'), value: brackets?.length ?? 0 },
              { icon: CheckCircle2, label: t('ov.checks'), value: `${checksOk}/${validation?.length ?? 0}` },
            ].map(s => (
              <div key={s.label} className="card p-4">
                <s.icon size={18} style={{ color: 'var(--accent)' }} />
                <div className="display text-[26px] font-semibold mt-1.5">{s.value}</div>
                <div className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div className="card p-5">
            <div className="font-extrabold text-sm mb-1">{t('ov.validation')}</div>
            {!validation ? <Skeleton className="h-20" /> : validation.map((v: any) => (
              <div key={v.key} className="check-row">
                {v.ok
                  ? <CheckCircle2 size={16} className="flex-none mt-0.5" style={{ color: 'var(--ok)' }} />
                  : <AlertTriangle size={16} className="flex-none mt-0.5" style={{ color: 'var(--warn)' }} />}
                <span>{v.message}{v.suggestion && <span className="block text-[13px]" style={{ color: 'var(--muted)' }}>→ {v.suggestion}</span>}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-2.5 flex-wrap">
            <button className="btn-primary text-sm" onClick={() => genB.mutate()}>{genB.isPending ? '…' : t('ov.genB')}</button>
            <button className="btn-ghost text-sm !py-2.5" onClick={() => genS.mutate()}>{genS.isPending ? '…' : t('ov.genS')}</button>
            {NEXT[tt.status] && <button className="btn-ghost text-sm !py-2.5" style={{ borderColor: 'var(--accent)' }} onClick={() => advance(NEXT[tt.status].to)}>{NEXT[tt.status].label} <ArrowRight size={15} /></button>}
          </div>
          {flowMsg && <div className="card p-3 text-sm">{flowMsg}</div>}
          {genB.isError || genS.isError ? <div className="card p-3 text-sm">{t('ov.genErr')}</div> : null}
        </div>
      )}
      {tab === 'participants' && <Participants tid={id!} />}
      {tab === 'brackets' && <BracketView brackets={brackets} />}
      {tab === 'schedule' && <BracketView brackets={brackets} showSchedule />}
      {tab === 'live' && (
        <div className="card p-8 text-center">
          <span className="eyebrow !justify-center">{t('lv.eyebrow')}</span>
          <div className="display text-2xl font-semibold mt-3">{t('lv.title')}</div>
          <div className="text-sm mt-2 space-y-1" style={{ color: 'var(--muted)' }}>
            {liveEvents.length
              ? liveEvents.map((e, i) => <div key={i}>{t('lv.fight')} {e.match_id} → 🏆 {e.winner} ({e.score_a}:{e.score_b})</div>)
              : t('lv.empty')}
          </div>
          <Link to={`/tv/${id}`} className="btn-primary text-sm inline-flex mt-5"><Tv size={15} /> {t('lv.tv')}</Link>
        </div>
      )}
      {tab === 'results' && <div className="space-y-3"><Results tid={id!} /><ExportBar tid={id!} /></div>}
      {tab === 'weighin' && <WeighIn regs={regs} tid={id!} />}
    </div>
  );
}

function ImportBox({ tid }: { tid: string }) {
  const { t } = useLang();
  const qc = useQueryClient();
  const [summary, setSummary] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const upload = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', f);
      const res = await fetch(`/api/tournaments/${tid}/registrations/import`, { method: 'POST', body: fd, credentials: 'include', headers: { 'Accept-Language': localStorage.getItem('kwf-lang') || 'ru' } });
      const body = await res.json();
      if (!res.ok) throw new Error(body.detail || `Error ${res.status}`);
      setSummary(body);
      qc.invalidateQueries({ queryKey: ['regs', tid] });
    } catch (e: any) { setSummary({ summary: e.message, errors: [] }); }
    setBusy(false);
  };
  return (
    <div className="card p-3 text-sm space-y-2">
      <label className="font-bold block">{t('p.impT')} <span className="font-normal" style={{ color: 'var(--muted)' }}>{t('p.impHint')}</span></label>
      <input type="file" accept=".csv,.xlsx" aria-label={t('p.impT')} disabled={busy}
             onChange={e => upload(e.target.files?.[0])} />
      {summary && (
        <div>
          <div>{summary.summary}</div>
          {!!summary.errors?.length && (
            <ul className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
              {summary.errors.slice(0, 5).map((e: any, i: number) => <li key={i}>{t('p.impRow')} {e.row}: {e.error}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

const WI_LABEL: Record<string, string> = { ok: 'w.ok', over: 'w.over', under: 'w.under', pending: 'w.pending' };

function Participants({ tid }: { tid: string }) {
  const { t } = useLang();
  const qc = useQueryClient();
  const { data: regs } = useQuery({ queryKey: ['regs', tid], queryFn: () => api(`/api/tournaments/${tid}/registrations`) });
  const toggle = useMutation({
    mutationFn: (r: any) => api(`/api/tournaments/${tid}/check-in/${r.id}`, { method: 'POST', body: JSON.stringify({ checked_in: !r.checked_in }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['regs', tid] }),
  });
  if (!regs?.length) return <EmptyState title={t('p.empty')} hint={t('p.emptyHint')} />;
  const done = regs.filter((r: any) => r.checked_in).length;
  return (
    <div className="space-y-2">
      <ImportBox tid={tid} />
      <div className="text-sm" style={{ color: 'var(--muted)' }}>{t('p.checkin')}: {done}/{regs.length}</div>
      {regs.map((r: any) => (
        <div key={r.id} className="card p-3 flex items-center gap-3">
          <div className="flex-1"><div className="font-semibold text-sm">{r.athlete}</div>
            <div className="text-xs" style={{ color: 'var(--muted)' }}>{r.weigh_in_kg ? `${r.weigh_in_kg}${t('w.kg')} (${t(WI_LABEL[r.weigh_in_status] ?? 'w.pending')})` : t('p.notWeighed')}</div></div>
          <button onClick={() => toggle.mutate(r)} aria-label={`${t('p.checkin')} ${r.athlete}`}
                  className="card px-4 py-2 text-sm font-bold" style={r.checked_in ? { borderColor: 'var(--accent)' } : {}}>
            {r.checked_in ? t('p.present') : t('p.mark')}
          </button>
        </div>
      ))}
    </div>
  );
}

function BracketView({ brackets, showSchedule }: { brackets: any[] | undefined; showSchedule?: boolean }) {
  const { t } = useLang();
  if (!brackets?.length) return <EmptyState title={t('br.empty')} hint={t('br.emptyHint')} />;
  return <div className="space-y-4">{brackets.map(b => {
    const rounds = Array.from(new Set<number>(b.matches.map((m: any) => m.round))).sort((x, y) => x - y);
    const total = rounds.length;
    const roundName = (r: number) => {
      const fromEnd = total - r;
      return fromEnd === 0 ? t('br.final') : fromEnd === 1 ? t('br.semi') : fromEnd === 2 ? t('br.quarter') : `${t('br.round')} ${r}`;
    };
    return (
      <div key={b.id} className="card p-4 md:p-5 overflow-x-auto">
        <div className="font-extrabold text-sm mb-3">{t('res.category')} {b.category_id} · {b.size} · {t('br.single')}</div>
        <div className="flex gap-5 min-w-max items-stretch">{rounds.map(r => (
          <div key={r} className="br-col space-y-2 flex flex-col justify-around">
            <div className="br-round">{roundName(r)}</div>
            {b.matches.filter((m: any) => m.round === r).map((m: any) => (
              <div key={m.id} className={`br-match${m.status === 'bye' ? ' bye' : ''}${m.winner ? ' won' : ''}`}>
                <Fighter name={m.a ?? t('br.bye')} score={m.score_a} win={m.winner === m.a} />
                <Fighter name={m.b ?? t('br.bye')} score={m.score_b} win={m.winner === m.b} />
                <div className="flex items-center gap-2 mt-1 text-[11px]" style={{ color: 'var(--muted)' }}>
                  <span>#{m.id} · {m.status}</span>
                  {m.tatami_id && <span>T{m.tatami_id}</span>}
                  {showSchedule && m.scheduled_at && <span className="inline-flex items-center gap-1"><Clock size={11} />{String(m.scheduled_at).slice(11, 16)}</span>}
                  {m.winner ? <Trophy size={11} style={{ color: 'var(--accent)' }} /> : null}
                </div>
              </div>
            ))}
          </div>))}</div>
      </div>);
  })}</div>;
}
function Fighter({ name, score, win }: { name: any; score: number; win: boolean }) {
  return <div className={`br-fighter${win ? ' winner' : ''}`}><span>{win ? '🏆 ' : ''}{name}</span><span>{score}</span></div>;
}

function WeighIn({ regs, tid }: { regs: any[] | undefined; tid: string }) {
  const { t } = useLang();
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [w, setW] = useState<Record<number, string>>({});
  const [msg, setMsg] = useState('');
  const list = (regs ?? []).filter(r => r.athlete.toLowerCase().includes(q.toLowerCase()));
  const submit = async (id: number) => {
    try {
      const r = await api(`/api/tournaments/${tid}/weigh-in/${id}`, { method: 'POST', body: JSON.stringify({ weigh_in_kg: Number(w[id]) }) });
      setMsg(`✓ ${r.label}`);
      qc.invalidateQueries({ queryKey: ['regs'] });
    } catch (e: any) { setMsg(`${t('common.err')}: ` + e.message); }
  };
  return <div className="space-y-2"><input aria-label={t('nav.search')} className="field w-full" placeholder={t('w.searchPh')} value={q} onChange={e => setQ(e.target.value)} />
    {msg && <div className="text-sm">{msg}</div>}
    {list.map((r: any) => <div key={r.id} className="card p-3 flex items-center gap-3"><div className="font-semibold text-sm flex-1">{r.athlete}</div>
      <input aria-label={t('a.weight')} className="field w-24" placeholder={t('w.kg')} value={w[r.id] ?? ''} onChange={e => setW({ ...w, [r.id]: e.target.value })} inputMode="decimal" />
      <button className="btn-primary text-sm" onClick={() => submit(r.id)}>{t('common.save')}</button></div>)}
    {!list.length && <EmptyState title={t('w.none')} hint={t('w.noneHint')} />}</div>;
}
