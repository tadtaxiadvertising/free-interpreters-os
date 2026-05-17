/**
 * API CLIENT — Resilient Fetch Wrapper
 * ============================================================
 * 
 * UBICACIÓN: Frontend (free-interpreters-os)
 * PROPÓSITO: Comunicación segura con interpreters-api (Backend)
 * 
 * CARACTERÍSTICAS:
 *   ✅ Manejo automático de errores HTTP 401/403
 *   ✅ Reintento con refresh de sesión en 401
 *   ✅ Timeout configurable por request
 *   ✅ Inyección automática de credentials y headers
 *   ✅ Tipado genérico para respuestas
 *   ✅ Logging estructurado para diagnóstico
 *   ✅ Webhook-friendly (no asume estructura de respuesta)
 * 
 * USO:
 *   // Desde un Server Component o Server Action:
 *   const { data, error } = await apiClient.get<Interpreter[]>('/api/interpreters');
 *   
 *   // Desde un Client Component:
 *   const { data, error } = await apiClient.post('/api/calls', { interpreterId: 1 });
 * 
 * ============================================================
 */

// ── Types ────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  data: T | null;
  error: string | null;
  status: number;
  /** true si el request fue exitoso (2xx) */
  ok: boolean;
}

export interface ApiClientOptions {
  /** Timeout en milisegundos. Default: 10000 (10s) */
  timeout?: number;
  /** Headers adicionales por request */
  headers?: Record<string, string>;
  /** Override del base URL (default: NEXT_PUBLIC_API_URL o relativo) */
  baseUrl?: string;
  /** Si se debe reintentar en 401 con refresh. Default: true */
  retryOnAuth?: boolean;
}

// ── Config ───────────────────────────────────────────────────

const DEFAULT_TIMEOUT = 10_000; // 10 segundos
const MAX_RETRIES = 1; // Solo 1 reintento en 401

/**
 * Resuelve la URL base del API.
 * - En Server Components: usa NEXT_PUBLIC_API_URL (URL interna de Docker)
 * - En Client Components: usa ruta relativa (mismo dominio vía proxy)
 */
function getBaseUrl(override?: string): string {
  if (override) return override;

  // Variable de entorno para comunicación interna Docker
  // Ejemplo: http://interpreters-api:3000
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl) return envUrl;

  // Fallback: ruta relativa (funciona cuando frontend proxea al backend)
  return '';
}

// ── Core Fetch ───────────────────────────────────────────────

async function coreFetch<T>(
  method: string,
  path: string,
  body?: unknown,
  options: ApiClientOptions = {},
): Promise<ApiResponse<T>> {
  const baseUrl = getBaseUrl(options.baseUrl);
  const url = `${baseUrl}${path}`;
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;

  // AbortController para timeout — previene requests colgados
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, {
      method,
      signal: controller.signal,
      // credentials: 'include' envía cookies de sesión cross-origin
      // Requiere que el backend tenga Access-Control-Allow-Credentials: true
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'FreeInterpreters', // Anti-CSRF básico
        ...options.headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    clearTimeout(timeoutId);

    // ── 401 Unauthorized → Intento de refresh ────────────
    if (res.status === 401 && options.retryOnAuth !== false) {
      console.warn(`[API-CLIENT] 401 on ${method} ${path} — attempting session refresh`);
      
      const refreshed = await attemptSessionRefresh(baseUrl);
      if (refreshed) {
        // Reintento con la sesión renovada (sin loop recursivo infinito)
        return coreFetch<T>(method, path, body, {
          ...options,
          retryOnAuth: false, // Previene loop infinito
        });
      }

      // Refresh falló → la sesión expiró definitivamente
      return {
        data: null,
        error: 'Session expired. Please log in again.',
        status: 401,
        ok: false,
      };
    }

    // ── 403 Forbidden → Error de permisos ────────────────
    if (res.status === 403) {
      console.warn(`[API-CLIENT] 403 Forbidden on ${method} ${path}`);
      return {
        data: null,
        error: 'You do not have permission to perform this action.',
        status: 403,
        ok: false,
      };
    }

    // ── Parse Response ───────────────────────────────────
    // Manejar respuestas vacías (204 No Content, etc.)
    let data: T | null = null;
    const contentType = res.headers.get('content-type');
    if (contentType?.includes('application/json') && res.status !== 204) {
      try {
        data = await res.json() as T;
      } catch {
        // Body no es JSON válido — no crashear
        console.warn(`[API-CLIENT] Non-JSON response body on ${method} ${path}`);
      }
    }

    if (!res.ok) {
      // Extraer mensaje de error del body si existe
      const errorMsg = (data && typeof data === 'object' && 'error' in data)
        ? String((data as { error: string }).error)
        : `HTTP ${res.status}: ${res.statusText}`;

      return {
        data: null,
        error: errorMsg,
        status: res.status,
        ok: false,
      };
    }

    return { data, error: null, status: res.status, ok: true };

  } catch (err) {
    clearTimeout(timeoutId);

    // ── Timeout ──────────────────────────────────────────
    if (err instanceof DOMException && err.name === 'AbortError') {
      console.error(`[API-CLIENT] Timeout after ${timeout}ms on ${method} ${path}`);
      return {
        data: null,
        error: `Request timeout (${timeout / 1000}s). The server may be overloaded.`,
        status: 408,
        ok: false,
      };
    }

    // ── Network Error (DNS, refused, etc.) ───────────────
    console.error(`[API-CLIENT] Network error on ${method} ${path}:`, err);
    return {
      data: null,
      error: 'Network error. Please check your connection.',
      status: 0,
      ok: false,
    };
  }
}

// ── Session Refresh ──────────────────────────────────────────

/**
 * Intenta refrescar la sesión del usuario.
 * Soporta tanto NextAuth como Supabase Auth.
 */
async function attemptSessionRefresh(baseUrl: string): Promise<boolean> {
  try {
    // Intento 1: NextAuth session refresh (GET /api/auth/session)
    const sessionRes = await fetch(`${baseUrl}/api/auth/session`, {
      credentials: 'include',
      headers: { 'X-Requested-With': 'FreeInterpreters' },
    });

    if (sessionRes.ok) {
      const session = await sessionRes.json();
      // Si hay usuario en la sesión, el refresh funcionó
      if (session?.user) {
        console.log('[API-CLIENT] Session refreshed via NextAuth');
        return true;
      }
    }

    // Intento 2: Supabase token refresh (si el frontend usa Supabase Auth)
    // Esto se maneja automáticamente por @supabase/ssr con autoRefreshToken: true
    // No necesitamos hacer nada explícito aquí.

    return false;
  } catch {
    console.warn('[API-CLIENT] Session refresh failed');
    return false;
  }
}

// ── Public API ───────────────────────────────────────────────

export const apiClient = {
  /**
   * GET request tipado.
   * @example const { data } = await apiClient.get<User[]>('/api/users');
   */
  get: <T = unknown>(path: string, options?: ApiClientOptions) =>
    coreFetch<T>('GET', path, undefined, options),

  /**
   * POST request tipado.
   * @example const { data } = await apiClient.post<User>('/api/users', { name: 'Test' });
   */
  post: <T = unknown>(path: string, body?: unknown, options?: ApiClientOptions) =>
    coreFetch<T>('POST', path, body, options),

  /**
   * PUT request tipado.
   * @example const { data } = await apiClient.put<User>('/api/users/1', { name: 'Updated' });
   */
  put: <T = unknown>(path: string, body?: unknown, options?: ApiClientOptions) =>
    coreFetch<T>('PUT', path, body, options),

  /**
   * DELETE request tipado.
   * @example const { ok } = await apiClient.del('/api/users/1');
   */
  del: <T = unknown>(path: string, options?: ApiClientOptions) =>
    coreFetch<T>('DELETE', path, undefined, options),

  /**
   * PATCH request tipado.
   * @example const { data } = await apiClient.patch('/api/users/1', { role: 'admin' });
   */
  patch: <T = unknown>(path: string, body?: unknown, options?: ApiClientOptions) =>
    coreFetch<T>('PATCH', path, body, options),
};

// ── React Hook-Friendly Error Type ──────────────────────────

/**
 * Helper para usar en Client Components con useState.
 * Convierte ApiResponse en un formato amigable para la UI.
 * 
 * @example
 * const [users, setUsers] = useState<User[]>([]);
 * const [error, setError] = useState<string | null>(null);
 * 
 * useEffect(() => {
 *   apiClient.get<User[]>('/api/users').then(res => {
 *     if (res.ok) setUsers(res.data!);
 *     else setError(res.error);
 *   });
 * }, []);
 */
export function isApiError<T>(response: ApiResponse<T>): response is ApiResponse<T> & { error: string } {
  return !response.ok;
}
