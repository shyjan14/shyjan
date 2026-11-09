'use client';

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000') + '/api/v1';

type Session = { accessToken: string; refreshToken: string };
let session: Session | null = null;
const KEY = 'hrms.session';

function load(): Session | null {
  if (session) return session;
  try {
    const raw = sessionStorage.getItem(KEY);
    session = raw ? JSON.parse(raw) : null;
  } catch {
    session = null;
  }
  return session;
}

export function setSession(s: Session | null) {
  session = s;
  try {
    if (s) sessionStorage.setItem(KEY, JSON.stringify(s));
    else sessionStorage.removeItem(KEY);
  } catch {}
}

export function hasSession() {
  return !!load();
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

let refreshing: Promise<boolean> | null = null;
async function refresh(): Promise<boolean> {
  const s = load();
  if (!s) return false;
  refreshing ??= fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: s.refreshToken }),
  })
    .then(async (r) => {
      if (!r.ok) {
        setSession(null);
        return false;
      }
      setSession(await r.json());
      return true;
    })
    .finally(() => (refreshing = null));
  return refreshing;
}

export async function api<T = any>(path: string, init: RequestInit & { json?: unknown; raw?: boolean } = {}, retry = true): Promise<T> {
  const s = load();
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (s) headers.Authorization = `Bearer ${s.accessToken}`;
  let body = init.body;
  if (init.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(init.json);
  }
  const res = await fetch(`${API_URL}${path}`, { ...init, headers, body });
  if (res.status === 401 && retry && s && !path.startsWith('/auth/login')) {
    if (await refresh()) return api<T>(path, init, false);
    if (typeof window !== 'undefined') window.location.href = '/login';
  }
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j = await res.json();
      msg = Array.isArray(j.message) ? j.message.join(', ') : j.message ?? msg;
    } catch {}
    throw new ApiError(res.status, msg);
  }
  if (init.raw) return res as unknown as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

/** Download an authenticated file (CSV export etc.). */
export async function download(path: string, filename: string) {
  const res = await api<Response>(path, { raw: true });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function logout() {
  const s = load();
  if (s) await fetch(`${API_URL}/auth/logout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: s.refreshToken }) }).catch(() => {});
  setSession(null);
  window.location.href = '/login';
}
