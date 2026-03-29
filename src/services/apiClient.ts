/**
 * SOY-BIS - API Client (frontend)
 * - JSON istekleri standartlaştırır
 * - Cookie/session tabanlı auth için `credentials: 'include'` kullanır
 * - 401/403 durumlarında session temizleyip sayfayı yeniler
 */

export type ApiErrorResponse = {
  error?: string;
  detail?: string;
};

const SESSION_KEY = 'soybis_oturum';
const CURRENT_USER_KEY = 'soybis_aktifKullanici';
const ACTIVE_VIEW_KEY = 'soybis_aktifView';

function apiBaseUrl(): string {
  // Vite build sırasında gömülür; set edilmezse /api. import.meta.env doğrudan kullanılmalı (Vite gömme).
  const envBase = import.meta.env.VITE_SOYBIS_API_BASE;
  const base = typeof envBase === 'string' ? envBase : '';
  return base.trim().length > 0 ? base.trim() : '/api';
}

export function withApiBase(path: string): string {
  const base = apiBaseUrl();
  if (!base || base === '/') return path;
  if (path.startsWith('/')) return base + path;
  return base + '/' + path;
}

function clearSessionAndReload(): void {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(SESSION_KEY);
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(CURRENT_USER_KEY);
      localStorage.removeItem(ACTIVE_VIEW_KEY);
    }
  } catch {
    // Sessizce devam et
  }
  if (typeof location !== 'undefined') {
    location.reload();
  }
}

async function parseJsonOrText(res: Response): Promise<any> {
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    return res.json();
  }
  return res.text();
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = withApiBase(path);

  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
  };

  let body = init.body;
  const hasBody = body !== undefined && body !== null;

  // body string değilse ve Content-Type yoksa JSON varsay.
  if (hasBody && typeof body !== 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }

  const res = await fetch(url, {
    ...init,
    credentials: 'include',
    headers,
    body,
  });

  if (res.status === 401 || res.status === 403) {
    // Kullanıcı login değilse (sessionStorage yoksa) gereksiz reload döngüsünü engelle.
    const hasClientSession =
      (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(SESSION_KEY)) ||
      (typeof localStorage !== 'undefined' && localStorage.getItem(CURRENT_USER_KEY));

    if (hasClientSession) {
      clearSessionAndReload();
    }
    throw new Error('Unauthorized');
  }

  const payload = await parseJsonOrText(res);
  if (!res.ok) {
    const msg =
      typeof payload === 'object' && payload !== null
        ? (payload as ApiErrorResponse).error || (payload as any).detail || 'API error'
        : String(payload);
    throw new Error(msg);
  }

  return payload as T;
}

export function apiGet<T>(path: string): Promise<T> {
  return apiFetch<T>(path, { method: 'GET' });
}

export function apiPost<T, B = unknown>(path: string, body?: B): Promise<T> {
  return apiFetch<T>(path, { method: 'POST', body: body as any });
}

export function apiDelete<T>(path: string): Promise<T> {
  return apiFetch<T>(path, { method: 'DELETE' });
}
