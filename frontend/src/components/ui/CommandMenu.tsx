import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLang } from '../../i18n';
import { api } from '../../lib/api';

type Action = { id: string; label: string; hint: string; run: () => void; roles?: string[] };

export function CommandMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLang();
  const [q, setQ] = useState('');
  const [res, setRes] = useState<any>(null);
  const [role, setRole] = useState('public');
  const [idx, setIdx] = useState(0);
  const nav = useNavigate();
  const go = (p: string) => { nav(p); onClose(); };

  useEffect(() => {
    if (open) api('/api/auth/me').then(m => setRole(m.role)).catch(() => setRole('public'));
  }, [open ]);
  useEffect(() => {
    if (!open || q.length < 2) { setRes(null); return; }
    const t = setTimeout(() => api(`/api/search?q=${encodeURIComponent(q)}`).then(setRes).catch(() => {}), 250);
    return () => clearTimeout(t);
  }, [q, open]);
  useEffect(() => setIdx(0), [q, res]);

  const tid = useMemo(() => {
    const m = window.location.pathname.match(/^\/tournaments\/(\d+)/);
    return m ? m[1] : null;
  }, [open]);

  const post = async (path: string, label: string) => {
    try { await api(path, { method: 'POST' }); alert('✓ ' + label); } catch (e: any) { alert(`${t('common.err')}: ` + e.message); }
    onClose();
  };

  const actions: Action[] = useMemo(() => {
    const list: Action[] = [
      { id: 'tournaments', label: t('c.openT'), hint: t('c.nav'), run: () => go('/tournaments') },
      { id: 'live', label: t('c.openLive'), hint: t('c.nav'), run: () => go('/live') },
      { id: 'news', label: t('c.news'), hint: t('c.nav'), run: () => go('/news') },
      { id: 'verify', label: t('c.verify'), hint: t('c.nav'), run: () => go('/verify') },
      { id: 'referee', label: t('c.referee'), hint: t('c.nav'), run: () => go('/referee') },
      { id: 'create', label: t('c.create'), hint: t('c.org'), run: () => go('/organizer'), roles: ['organizer', 'admin'] },
    ];
    if (tid) {
      list.push(
        { id: 't-open', label: `#${tid} — ${t('c.tOpen')}`, hint: t('c.nav'), run: () => go(`/tournaments/${tid}`) },
        { id: 't-live', label: `#${tid} — ${t('c.tLive')}`, hint: t('c.nav'), run: () => go(`/tournaments/${tid}?tab=live`) },
        { id: 't-tv', label: `#${tid} — ${t('c.tTv')}`, hint: t('c.nav'), run: () => go(`/tv/${tid}`) },
        { id: 't-parts', label: `#${tid} — ${t('c.tParts')}`, hint: t('c.nav'), run: () => go(`/tournaments/${tid}?tab=participants`) },
        { id: 't-brackets', label: `#${tid} — ${t('c.tBrackets')}`, hint: t('c.org'), run: () => post(`/api/tournaments/${tid}/brackets/generate`, `#${tid}`), roles: ['organizer', 'admin'] },
        { id: 't-sched', label: `#${tid} — ${t('c.tSched')}`, hint: t('c.org'), run: () => post(`/api/tournaments/${tid}/schedule/generate`, `#${tid}`), roles: ['organizer', 'admin'] },
        { id: 't-validate', label: `#${tid} — ${t('c.tCheck')}`, hint: t('c.org'), run: () => go(`/tournaments/${tid}?tab=overview`), roles: ['organizer', 'admin'] },
      );
    }
    const needle = q.toLowerCase();
    return list.filter(a => (!a.roles || a.roles.includes(role)) && (!needle || a.label.toLowerCase().includes(needle)));
  }, [q, role, tid]);

  if (!open) return null;
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(i + 1, actions.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && actions[idx]) actions[idx].run();
    if (e.key === 'Escape') onClose();
  };
  return (
    <div role="dialog" aria-label="Command menu" className="fixed inset-0 z-50 p-4" style={{ background: 'rgba(2,6,12,.55)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="card max-w-lg mx-auto mt-16 md:mt-24 p-2 fade-up" style={{ background: 'var(--bg)', boxShadow: 'var(--shadow-lg)' }} onClick={e => e.stopPropagation()}>
        <input autoFocus value={q} onChange={e => setQ(e.target.value)} onKeyDown={onKey}
               placeholder={t('cmdk.ph')} className="field w-full !border-0 !shadow-none !text-[15px] !py-3" aria-label={t('nav.search')} />
        <div className="mt-1 text-sm max-h-[40vh] overflow-y-auto" role="listbox" aria-label="Commands">
          {!actions.length && !res && <div className="px-3 py-4 text-[13px]" style={{ color: 'var(--muted)' }}>{t('cmdk.empty')}</div>}
          {actions.map((a, i) => (
            <button key={a.id} role="option" aria-selected={i === idx} onClick={a.run}
                    onMouseEnter={() => setIdx(i)} className="flex w-full items-center justify-between px-3 py-2 rounded-lg"
                    style={i === idx ? { background: 'var(--accent-soft)', fontWeight: 800 } : {}}>
              <span>{a.label}</span><span className="badge">{a.hint}</span>
            </button>
          ))}
        </div>
        {res && (
          <div className="mt-1 px-3 py-2 text-sm border-t" style={{ borderColor: 'var(--border)' }}>
            {res.athletes?.map((a: any) => <button key={'a' + a.id} className="block py-1" onClick={() => go('/athletes')}>{a.name}</button>)}
            {res.clubs?.map((c: any) => <button key={'c' + c.id} className="block py-1" onClick={() => go('/clubs')}>{c.name}</button>)}
          </div>
        )}
        <div className="flex gap-3 px-3 py-2 text-[11px] border-t" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
          <span><kbd>↑↓</kbd></span><span>Enter</span><span>Esc</span>
        </div>
      </div>
    </div>
  );
}
