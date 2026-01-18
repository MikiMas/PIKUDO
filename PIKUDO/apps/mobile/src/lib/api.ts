import AsyncStorage from "@react-native-async-storage/async-storage";

const SESSION_KEY = "pikudo:st";
const DEVICE_KEY = "pikudo:deviceId";

function createDeviceId(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const ts = Date.now().toString(36);
  return `dev_${ts}_${rand}`;
}

export async function getDeviceId(): Promise<string> {
  try {
    const existing = await AsyncStorage.getItem(DEVICE_KEY);
    if (existing && existing.trim()) return existing;
  } catch {
    // ignore
  }
  const next = createDeviceId();
  try {
    await AsyncStorage.setItem(DEVICE_KEY, next);
  } catch {
    // ignore
  }
  return next;
}

export async function getSessionToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export async function setSessionToken(token: string): Promise<void> {
  try {
    await AsyncStorage.setItem(SESSION_KEY, token);
  } catch {
    // ignore
  }
}

export async function clearSessionToken(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

export type ApiOk<T> = { ok: true } & T;
export type ApiErr = { ok: false; error: string };

export async function apiFetchJson<T>(
  baseUrl: string,
  path: string,
  init?: RequestInit & { auth?: boolean }
): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  const base = baseUrl.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  const url = `${base}${p}`;
  try {
    const headers: Record<string, string> = { ...(init?.headers as any) };
    const deviceId = await getDeviceId();
    headers["x-device-id"] = deviceId;
    if (init?.auth !== false) {
      const st = await getSessionToken();
      if (st) headers["x-session-token"] = st;
    }
    const res = await fetch(url, { ...init, headers });
    const json = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, status: res.status, error: (json as any)?.error ?? "REQUEST_FAILED" };
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, status: 0, error: "NETWORK_ERROR" };
  }
}

export async function apiFetchForm<T>(
  baseUrl: string,
  path: string,
  form: FormData,
  init?: Omit<RequestInit, "body" | "headers"> & { auth?: boolean }
): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  const base = baseUrl.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  const url = `${base}${p}`;

  try {
    const headers: Record<string, string> = {};
    const deviceId = await getDeviceId();
    headers["x-device-id"] = deviceId;
    if (init?.auth !== false) {
      const st = await getSessionToken();
      if (st) headers["x-session-token"] = st;
    }
    const res = await fetch(url, { ...init, method: init?.method ?? "POST", headers, body: form } as any);
    const json = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, status: res.status, error: (json as any)?.error ?? "REQUEST_FAILED" };
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, status: 0, error: "NETWORK_ERROR" };
  }
}
