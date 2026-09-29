import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useLang } from '../i18n';
import { api } from '../lib/api';

function fmt(sec: number) {
  const m = Math.floor(sec / 60), s = Math.max(sec % 60, 0);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// TV Board: huge type, fullscreen, minimal elements (§13), realtime via SSE
export function TvBoard() {
  const { t } = useLang();
  const { id } = useParams();
  const { data } = useQuery({ queryKey: ['live', id], queryFn: () => api(`/api/tournaments/${id}/live`), refetchInterval: 5000 });
  const [timer, setTimer] = useState<any>(null);
  const [lastFight, setLastFight] = useState<any>(null);
  useEffect(() => {
    if (!id) return;
    const es = new EventSource(`/api/tournaments/${id}/live/stream`);
    es.onmessage = e => {
      const ev = JSON.parse(e.data);
      if (ev.type === 'timer') setTimer(ev);
      if (ev.type === 'fight_finished') setLastFight(ev);
    };
    return () => es.close();
  }, [id]);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);
  const remain = timer?.action === 'running' && timer.ends_at
    ? Math.max(Math.round(timer.ends_at - now / 1000), 0)
    : timer?.remaining_sec ?? timer?.duration_sec ?? null;
  const cur = data?.live?.[0];
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center p-8" style={{ background: '#05080D', color: '#F8FAFC', borderTop: '3px solid #C9A227' }}>
      <div className="text-xs font-bold tracking-[.3em]" style={{ color: '#C9A227' }}>{t('tv.tatami')}</div>
      {remain !== null && <div className="display font-semibold tabular-nums mt-4" style={{ fontSize: 'clamp(72px, 16vw, 170px)', lineHeight: 1 }} aria-label={t('ref.dur')}>{fmt(remain)}</div>}
      {cur ? <div className="display text-3xl md:text-5xl font-medium mt-5">{cur.a} <span style={{ color: '#C9A227' }}>—</span> {cur.b}</div>
        : lastFight ? <div className="display text-2xl md:text-4xl font-medium mt-5">{t('lv.fight')} {lastFight.match_id} → 🏆 {lastFight.winner}</div>
        : <div className="display text-4xl md:text-6xl font-medium mt-5">{t('tv.wait')}</div>}
      <button className="mt-8 px-4 py-2 text-sm rounded-lg border" style={{ borderColor: '#1E293B', color: '#94A3B8' }} onClick={() => document.documentElement.requestFullscreen()}>{t('tv.fs')}</button>
    </div>
  );
}

// Referee mode: big buttons, minimal text (§14) — timer + score + finish wired to API
export function Referee() {
  const { t } = useLang();
  const [tid, setTid] = useState('1');
  const [mid, setMid] = useState('');
  const [dur, setDur] = useState(180);
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [winner, setWinner] = useState<'A' | 'B'>('A');
  const [timer, setTimer] = useState<any>(null);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    if (!tid) return;
    const es = new EventSource(`/api/tournaments/${tid}/live/stream`);
    es.onmessage = e => { const ev = JSON.parse(e.data); if (ev.type === 'timer' && String(ev.match_id) === mid) setTimer(ev); };
    return () => es.close();
  }, [tid, mid]);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const tt = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(tt); }, []);
  const remain = timer?.action === 'running' && timer.ends_at
    ? Math.max(Math.round(timer.ends_at - now / 1000), 0)
    : timer?.remaining_sec ?? timer?.duration_sec ?? dur;
  const call = async (path: string, body: any, ok: string) => {
    try { const r = await api(path, { method: 'POST', body: JSON.stringify(body) }); if (body.action) setTimer(r); setMsg('✓ ' + ok); }
    catch (e: any) { setMsg(`${t('common.err')}: ` + e.message); }
  };
  const big = 'rounded-2xl py-8 text-3xl font-black card w-full';
  return (
    <div className="space-y-4 max-w-lg mx-auto fade-up">
      <div><span className="eyebrow">{t('ref.eyebrow')}</span>
        <h1 className="display text-3xl font-semibold mt-1">{t('ref.title')}</h1></div>
      <div className="flex gap-2">
        <input aria-label={t('ref.tid')} className="field w-24" value={tid} onChange={e => setTid(e.target.value)} inputMode="numeric" />
        <input aria-label={t('ref.mid')} className="field flex-1" placeholder={t('ref.mid')} value={mid} onChange={e => setMid(e.target.value)} inputMode="numeric" />
        <input aria-label={t('ref.dur')} className="field w-24" type="number" value={dur} onChange={e => setDur(Number(e.target.value))} />
      </div>
      <div className="card p-5 text-center" style={timer?.action === 'running' ? { borderColor: 'var(--accent)' } : {}}>
        <div className="display font-semibold tabular-nums" style={{ fontSize: 64, lineHeight: 1 }} aria-label={t('ref.dur')}>{fmt(remain)}</div>
        <div className="text-xs font-bold uppercase tracking-[.14em] mt-1" style={{ color: 'var(--muted)' }}>
          {timer?.action === 'running' ? t('ref.running') : timer?.action === 'paused' ? t('ref.paused') : t('ref.idle')}
        </div>
        <div className="flex gap-2 mt-4">
          <button className="btn-primary flex-1 justify-center !py-3" onClick={() => call(`/api/tournaments/matches/${mid}/timer`, { action: 'start', duration_sec: dur }, t('ref.start'))}>{t('ref.start')}</button>
          <button className="btn-ghost flex-1 justify-center !py-3" onClick={() => call(`/api/tournaments/matches/${mid}/timer`, { action: 'pause', duration_sec: dur }, t('ref.paused'))}>{t('ref.pause')}</button>
          <button className="btn-ghost flex-1 justify-center !py-3" onClick={() => call(`/api/tournaments/matches/${mid}/timer`, { action: 'reset', duration_sec: dur }, t('ref.reset'))}>{t('ref.reset')}</button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-6 text-center"><div className="font-black text-2xl">Aka</div><div className="text-5xl font-black">{scoreA}</div>
          <button className={big} onClick={() => setScoreA(s => s + 1)} aria-label="Aka +">+</button></div>
        <div className="card p-6 text-center"><div className="font-black text-2xl">Shiro</div><div className="text-5xl font-black">{scoreB}</div>
          <button className={big} onClick={() => setScoreB(s => s + 1)} aria-label="Shiro +">+</button></div>
      </div>
      <div className="flex gap-2 text-sm">
        <button className="card px-3 py-2 flex-1 font-bold" style={winner === 'A' ? { borderColor: 'var(--accent)' } : {}} onClick={() => setWinner('A')}>{t('ref.wA')}</button>
        <button className="card px-3 py-2 flex-1 font-bold" style={winner === 'B' ? { borderColor: 'var(--accent)' } : {}} onClick={() => setWinner('B')}>{t('ref.wB')}</button>
      </div>
      <button className="btn-primary w-full py-4 text-lg justify-center" onClick={async () => {
        try {
          const live = await api(`/api/tournaments/${tid}/live`);
          const m = [...live.live, ...live.queue].find((x: any) => String(x.id) === mid);
          if (!m) { setMsg(`${t('common.err')}: ` + t('ref.noFight')); return; }
          const wid = winner === 'A' ? m.a : m.b;
          await api(`/api/tournaments/matches/${mid}/finish`, { method: 'POST', body: JSON.stringify({ winner_id: wid, score_a: scoreA, score_b: scoreB }) });
          setMsg(t('ref.done'));
        } catch (e: any) { setMsg(`${t('common.err')}: ` + e.message); }
      }}>{t('ref.finish')}</button>
      {msg && <div className="text-sm">{msg}</div>}
    </div>
  );
}
