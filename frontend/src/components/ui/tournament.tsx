export const fmtDay = (iso: string) => { const d = new Date((iso || '') + 'T00:00'); return isNaN(+d) ? '—' : d.getDate(); };
export const fmtMon = (iso: string) => {
  const d = new Date((iso || '') + 'T00:00');
  return isNaN(+d) ? '' : d.toLocaleDateString('ru-RU', { month: 'short' }).replace('.', '');
};
export const STATUS_TONE: Record<string, 'gold' | 'live' | 'navy' | 'gray'> =
  { live: 'live', registration: 'navy', upcoming: 'gold', finished: 'gray' };
export const FLOW = ['upcoming', 'registration', 'live', 'finished'] as const;
export const FLOW_RU: Record<string, string> = { upcoming: 'Анонс', registration: 'Регистрация', live: 'Идёт', finished: 'Финиш' };
