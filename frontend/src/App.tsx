import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LangProvider, useLang } from './i18n';
import { Header } from './components/ui/Header';
import { CommandMenu } from './components/ui/CommandMenu';
import { Home } from './pages/Home';
import { Tournaments } from './pages/Tournaments';
import { TournamentDetail } from './pages/TournamentDetail';
import { Athletes, AthleteDetail, Rankings, Clubs, ClubDetail, LiveAll } from './pages/Lists';
import { TvBoard, Referee } from './pages/TvReferee';
import { Organizer, Auth } from './pages/Organizer';
import { Verify, News, NewsDetail, NewsEditor } from './pages/Documents';

const qc = new QueryClient();

function Footer() {
  const { t } = useLang();
  return (
    <footer className="border-t mt-10" style={{ borderColor: 'var(--border)' }}>
      <div className="max-w-6xl mx-auto px-4 py-10 grid gap-8 md:grid-cols-4 text-sm">
        <div>
          <div className="display text-lg font-semibold">KWF</div>
          <div className="text-[11px] font-bold tracking-[.18em] mt-0.5" style={{ color: 'var(--accent)' }}>KYOKUSHIN</div>
          <p className="mt-3 text-[13px] leading-relaxed" style={{ color: 'var(--muted)' }}>{t('foot.tag')}</p>
        </div>
        <nav aria-label={t('foot.platform')}>
          <div className="font-extrabold text-xs uppercase tracking-[.12em] mb-3" style={{ color: 'var(--muted)' }}>{t('foot.platform')}</div>
          <div className="flex flex-col gap-2"><Link to="/tournaments">{t('nav.tournaments')}</Link><Link to="/live">{t('nav.live')}</Link><Link to="/rankings">{t('nav.rankings')}</Link><Link to="/news">{t('nav.news')}</Link></div>
        </nav>
        <nav aria-label={t('foot.athletes')}>
          <div className="font-extrabold text-xs uppercase tracking-[.12em] mb-3" style={{ color: 'var(--muted)' }}>{t('foot.athletes')}</div>
          <div className="flex flex-col gap-2"><Link to="/athletes">{t('nav.athletes')}</Link><Link to="/clubs">{t('nav.clubs')}</Link><Link to="/verify">{t('nav.verify')}</Link></div>
        </nav>
        <nav aria-label={t('foot.org')}>
          <div className="font-extrabold text-xs uppercase tracking-[.12em] mb-3" style={{ color: 'var(--muted)' }}>{t('foot.org')}</div>
          <div className="flex flex-col gap-2"><Link to="/organizer">{t('org.create')}</Link><Link to="/referee">{t('cmdk.referee')}</Link><Link to="/me">{t('nav.cabinet')}</Link></div>
        </nav>
      </div>
      <div className="border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-6xl mx-auto px-4 py-4 text-xs flex gap-4" style={{ color: 'var(--muted)' }}>
          <span>KWF</span><span className="ml-auto">{t('foot.rights')}</span>
        </div>
      </div>
    </footer>
  );
}

export default function App() {
  const [cmdk, setCmdk] = useState(false);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setCmdk(v => !v); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);
  return (
    <QueryClientProvider client={qc}>
      <LangProvider>
        <BrowserRouter>
          <Header onCmdk={() => setCmdk(true)} />
          <main className="max-w-6xl mx-auto px-4 py-6">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/tournaments" element={<Tournaments />} />
              <Route path="/tournaments/:id" element={<TournamentDetail />} />
              <Route path="/athletes" element={<Athletes />} />
              <Route path="/athletes/:id" element={<AthleteDetail />} />
              <Route path="/rankings" element={<Rankings />} />
              <Route path="/clubs" element={<Clubs />} />
              <Route path="/clubs/:id" element={<ClubDetail />} />
              <Route path="/live" element={<LiveAll />} />
              <Route path="/tv/:id" element={<TvBoard />} />
              <Route path="/referee" element={<Referee />} />
              <Route path="/organizer" element={<Organizer />} />
              <Route path="/me" element={<Auth />} />
              <Route path="/verify" element={<Verify />} />
              <Route path="/verify/:code" element={<Verify />} />
              <Route path="/news" element={<News />} />
              <Route path="/news/new" element={<NewsEditor />} />
              <Route path="/news/:slug" element={<NewsDetail />} />
            </Routes>
          </main>
          <Footer />
          <CommandMenu open={cmdk} onClose={() => setCmdk(false)} />
        </BrowserRouter>
      </LangProvider>
    </QueryClientProvider>
  );
}
