// src/services/integrations/http.ts
// One fetch wrapper for every provider: timeout, JSON, and a typed error for
// "the credential is no good any more" so the caller can ask for a reconnect
// instead of retrying forever.
export class IntegrationAuthError extends Error {
  constructor(message: string) { super(message); this.name = 'IntegrationAuthError'; }
}

export class IntegrationHttpError extends Error {
  constructor(message: string, readonly status: number) { super(message); this.name = 'IntegrationHttpError'; }
}

const TIMEOUT_MS = Number(process.env.JIKO_INTEGRATION_TIMEOUT_MS || 15_000);

export interface JsonResponse<T> { status: number; body: T; headers: Headers }

export async function fetchJson<T = unknown>(url: string, init: RequestInit = {}, what = 'request'): Promise<JsonResponse<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal, headers: { accept: 'application/json', ...(init.headers ?? {}) } });
    const text = await res.text();
    let body: unknown = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = text; }
    if (res.status === 401) throw new IntegrationAuthError(`${what}: the connection was rejected (401)`);
    if (!res.ok) {
      const detail = typeof body === 'object' && body !== null
        ? JSON.stringify((body as Record<string, unknown>).error ?? (body as Record<string, unknown>).errors ?? body).slice(0, 200)
        : String(body).slice(0, 200);
      throw new IntegrationHttpError(`${what} failed (${res.status}): ${detail}`, res.status);
    }
    return { status: res.status, body: body as T, headers: res.headers };
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw new Error(`${what} timed out`, { cause: err });
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
