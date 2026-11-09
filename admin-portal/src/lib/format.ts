export const fmtTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai' }) : '—';
export const fmtDateTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai' }) : '—';
export const fmtDate = (s?: string | null) =>
  s ? new Date(s.length === 10 ? `${s}T00:00:00Z` : s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—';
export const fmtMins = (m: number) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
export const todayDubai = () => new Date(Date.now() + 4 * 3600_000).toISOString().slice(0, 10);
export const label = (s: string) =>
  s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()).replace(/\b(id|hr|mfa|wifi)\b/gi, (w) => (w.toLowerCase() === 'wifi' ? 'Wi-Fi' : w.toUpperCase()));
