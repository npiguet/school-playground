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
} from './types';

export class ApiError extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
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

export const api = {
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
  },
  sessions: {
    create: (body: SessionCreate) => request<SessionCreated>('POST', '/api/sessions', body),
  },
};
