import { useEffect } from 'react';
import { getLang } from '../i18n';

export async function api(path: string, opts: RequestInit = {}) {
  const headers = { 'Content-Type': 'application/json', 'Accept-Language': getLang(), ...((opts.headers as any) || {}) };
  const res = await fetch(path, { credentials: 'include', ...opts, headers });
  if (!res.ok) {
    const text = await res.text();
    let msg = text.slice(0, 200) || `Error ${res.status}`;
    try {
      const j = JSON.parse(text);
      if (typeof j.detail === 'string') msg = j.detail;
    } catch { /* keep raw text */ }
    throw new Error(msg);
  }
  return res.json();
}
export function useLiveSSE(tid: number | null, onEvent: (e: any) => void) {
  useEffect(() => {
    if (!tid) return;
    const es = new EventSource(`/api/tournaments/${tid}/live/stream`);
    es.onmessage = (ev) => onEvent(JSON.parse(ev.data));
    return () => es.close();
  }, [tid]);
}
