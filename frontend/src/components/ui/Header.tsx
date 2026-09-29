import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Bell, Menu, Moon, Sun, Search, Trophy } from 'lucide-react';
import { useLang, LangToggle } from '../../i18n';
import { api } from '../../lib/api';

export function Header({ onCmdk }: { onCmdk: () => void }) {
  const { t } = useLang();
  const NAV: [string, string][] = [
    ['/tournaments', t('nav.tournaments')], ['/athletes', t('nav.athletes')], ['/rankings', t('nav.rankings')],
    ['/live', t('nav.live')], ['/news', t('nav.news')], ['/clubs', t('nav.clubs')], ['/organizer', t('nav.cabinet')],
  ];
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  const [notes, setNotes] = useState<any>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [menu, setMenu] = useState(false);
  const nav = useNavigate();
  const toggle = () => { setDark(!dark); document.documentElement.classList.toggle('dark', !dark); };
  const loadNotes = () => api('/api/notifications').then(setNotes).catch(() => {});
  useEffect(() => { loadNotes(); const t = setInterval(loadNotes, 30000); return () => clearInterval(t); }, []);
  const link = ({ isActive }: any) => ({
    color: isActive ? 'var(--accent)' : 'var(--text)', fontWeight: 700, fontSize: 13.5,
    borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent', paddingBottom: 4,
  });
  return (
    <header className="header-blur border-b sticky top-0 z-20" style={{ background: 'color-mix(in srgb, var(--bg) 82%, transparent)', borderColor: 'var(--border)' }}>
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-5">
        <Link to="/" className="flex items-center gap-2.5" aria-label="KWF home">
          <span className="grid place-items-center w-9 h-9 rounded-[10px] font-black" style={{ background: 'var(--navy)', color: 'var(--bg)' }}>
            <Trophy size={17} strokeWidth={2.5} />
          </span>
          <span className="leading-none">
            <span className="display block text-[19px] font-semibold tracking-wide">KWF</span>
            <span className="block text-[10px] font-bold tracking-[.18em]" style={{ color: 'var(--muted)' }}>KYOKUSHIN</span>
          </span>
        </Link>
        <nav className="hidden md:flex gap-4 items-center" aria-label="Main">
          {NAV.map(([to, label]) => <NavLink key={to} to={to} style={link}>{label}{to === '/live' && <span className="pulse-dot inline-block ml-1.5" style={{ width: 7, height: 7 }} />}</NavLink>)}
        </nav>
        <div className="ml-auto flex gap-2 items-center relative">
          <LangToggle />
          <button onClick={() => setMenu(v => !v)} className="md:hidden card p-2" aria-label={t('nav.menu')} aria-expanded={menu}><Menu size={18} /></button>
          <button onClick={onCmdk} className="card hidden sm:flex items-center gap-1.5 px-3 py-2 text-[13px] font-semibold" aria-label="Command menu">
            <Search size={14} /> {t('nav.search')} <kbd className="text-[11px] px-1 rounded" style={{ background: 'var(--border)' }}>⌘K</kbd>
          </button>
          <button onClick={onCmdk} className="sm:hidden card p-2" aria-label={t('nav.search')}><Search size={18} /></button>
          <button onClick={() => setShowNotes(v => !v)} className="card p-2 relative" aria-label={t('nav.notifications')}>
            <Bell size={18} />
            {!!notes?.unread && <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-black grid place-items-center" style={{ background: 'var(--accent)', color: '#05080D' }}>{notes.unread}</span>}
          </button>
          {showNotes && notes && (
            <div className="card absolute right-0 top-12 w-80 p-3 z-30 text-sm shadow-xl" style={{ background: 'var(--bg)' }} role="menu" aria-label={t('nav.notifications')}>
              {!notes.items?.length && <div style={{ color: 'var(--muted)' }}>{t('nav.noNotes')}</div>}
              {notes.items?.slice(0, 8).map((n: any) => (
                <div key={n.id} className="py-1.5 border-b" style={{ borderColor: 'var(--border)', opacity: n.is_read ? .6 : 1 }}>
                  <div>{n.message}</div>
                  <div className="flex gap-2 text-xs mt-0.5">
                    {n.link && <Link to={n.link} onClick={() => setShowNotes(false)}>{t('nav.open')}</Link>}
                    {!n.is_read && <button onClick={() => api(`/api/notifications/${n.id}/read`, { method: 'POST' }).then(loadNotes)}>{t('nav.read')}</button>}
                  </div>
                </div>
              ))}
            </div>
          )}
          <button onClick={toggle} className="card p-2" aria-label={t('nav.theme')}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
        </div>
      </div>
      {menu && (
        <nav className="md:hidden border-t px-4 py-2 flex flex-col" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }} aria-label="Mobile">
          {[...NAV, ['/verify', t('nav.verify')] as [string, string]].map(([to, label]) => (
            <Link key={to} to={to} onClick={() => { setMenu(false); if (to === '/live') nav(to); }} className="py-2.5 font-bold text-sm border-b" style={{ borderColor: 'var(--border)' }}>{label}</Link>
          ))}
        </nav>
      )}
    </header>
  );
}
