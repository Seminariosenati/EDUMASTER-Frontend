const BASE = "/api/v1";
const TOKEN_KEY = "edumaster.token";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
    public correlationId?: string,
  ) {
    super(message);
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* almacenamiento no disponible: la sesión dura solo esta pestaña */
  }
}

let onUnauthorized: () => void = () => {};
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

export async function api<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let body = init.body;
  if (init.json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(init.json);
  }
  const res = await fetch(BASE + path, { ...init, headers, body });
  if (res.status === 401 && !path.startsWith("/auth/login")) onUnauthorized();
  if (!res.ok) {
    let data: { message?: string; details?: unknown; correlation_id?: string } = {};
    try {
      data = await res.json();
    } catch {
      /* respuesta sin cuerpo JSON */
    }
    throw new ApiError(res.status, data.message ?? `Error ${res.status}`, data.details, data.correlation_id);
  }
  const type = res.headers.get("content-type") ?? "";
  return (type.includes("application/json") ? res.json() : res.text()) as Promise<T>;
}

export async function download(path: string, filename: string) {
  const res = await fetch(BASE + path, { headers: { Authorization: `Bearer ${getToken()}` } });
  if (!res.ok) throw new ApiError(res.status, "No se pudo exportar");
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function streamUrl() {
  return `${BASE}/events/stream?token=${encodeURIComponent(getToken() ?? "")}`;
}
