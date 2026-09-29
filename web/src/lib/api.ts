// Thin fetch wrappers around /api/*. All requests/responses are JSON; every
// non-2xx response throws ApiError with a flattened, human-readable detail.
import type {
  Profile,
  ProfileCreateBody,
  ProfilePatchBody,
  TextSummary,
  TextFull,
  TextCreateBody,
  SessionCreate,
  SessionCreated,
  StatsResponse,
  TrapWord,
  ScanResult,
  CorruptResult,
  AlexandriaWork,
  AlexandriaChunk,
  RefreshResult,
} from './types';
import type { BuildStamp } from './version';

export class ApiError extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const d = (data as { detail?: unknown }).detail;
    const detail =
      typeof d === 'string'
        ? d
        : Array.isArray(d)
          ? d.map((e: { msg?: string }) => e.msg ?? '').join('; ')
          : res.statusText;
    throw new ApiError(res.status, detail);
  }
  return data as T;
}

/** How long the client waits for an Alexandria refresh (the server fetches up to 40 pages and
 *  annotates up to 40 chunks). On expiry `fetch` rejects with a `TimeoutError` DOMException,
 *  which the screen turns into its graceful "hors d'atteinte" banner. */
export const REFRESH_TIMEOUT_MS = 120_000;

export function isTimeout(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'TimeoutError';
}

export async function request<T>(method: string, url: string, body?: unknown, timeoutMs?: number): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: timeoutMs !== undefined ? AbortSignal.timeout(timeoutMs) : undefined,
  });
  return handleResponse<T>(res);
}

export const api = {
  /** The server is up, and which build it runs (the lyre's credits). */
  health: () => request<{ status: string; build?: BuildStamp }>('GET', '/api/health'),
  profiles: {
    list: () => request<Profile[]>('GET', '/api/profiles'),
    create: (body: ProfileCreateBody) => request<Profile>('POST', '/api/profiles', body),
    get: (id: number) => request<Profile>('GET', `/api/profiles/${id}`),
    patch: (id: number, body: ProfilePatchBody) =>
      request<Profile>('PATCH', `/api/profiles/${id}`, body),
    verifyPin: (id: number, pin: string) =>
      request<{ ok: boolean }>('POST', `/api/profiles/${id}/verify-pin`, { pin }),
    stats: (id: number) => request<StatsResponse>('GET', `/api/profiles/${id}/stats`),
    trapWords: (id: number) => request<TrapWord[]>('GET', `/api/profiles/${id}/trap-words`),
  },
  texts: {
    list: (profileId?: number) =>
      request<TextSummary[]>(
        'GET',
        profileId !== undefined ? `/api/texts?profile_id=${profileId}` : '/api/texts',
      ),
    create: (body: TextCreateBody) => request<TextFull>('POST', '/api/texts', body),
    get: (id: number) => request<TextFull>('GET', `/api/texts/${id}`),
    corrupt: (id: number, body: { profile_id: number; seed?: number; focus?: string }) =>
      request<CorruptResult>('POST', `/api/texts/${id}/corrupt`, body),
  },
  sessions: {
    create: (body: SessionCreate) => request<SessionCreated>('POST', '/api/sessions', body),
  },
  scan: {
    upload: async (files: File[]) => {
      const fd = new FormData();
      for (const f of files) fd.append('photos', f, f.name);
      const res = await fetch('/api/scan', { method: 'POST', body: fd });
      return handleResponse<ScanResult>(res);
    },
    pageUrl: (scanId: string, n: number) => `/api/scan/${scanId}/page/${n}`,
  },
  alexandria: {
    works: () => request<AlexandriaWork[]>('GET', '/api/alexandria/works'),
    refresh: (id: string) =>
      request<RefreshResult>('POST', `/api/alexandria/works/${id}/refresh`, undefined, REFRESH_TIMEOUT_MS),
    chunks: (id: string, level?: string) =>
      request<AlexandriaChunk[]>(
        'GET',
        `/api/alexandria/works/${id}/chunks${level ? `?level=${encodeURIComponent(level)}` : ''}`,
      ),
    adopt: (chunkId: number, body: { profile_id: number; title?: string }) =>
      request<TextFull>('POST', `/api/alexandria/chunks/${chunkId}/adopt`, body),
  },
};
