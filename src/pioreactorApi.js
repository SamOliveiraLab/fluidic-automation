/** Shared Pioreactor HTTP helpers (used by Dashboard + CalibrationsPage). */

const DEFAULT_PIOREACTOR_URL =
  import.meta.env.VITE_PIOREACTOR_URL ||
  "https://controlling-adds-speak-stop.trycloudflare.com";

export const getApiBase = () => {
  try {
    return localStorage.getItem("pioreactor_url") || DEFAULT_PIOREACTOR_URL;
  } catch {
    return DEFAULT_PIOREACTOR_URL;
  }
};

export const buildApiUrl = (path) => {
  if (typeof import.meta !== "undefined" && import.meta.env?.DEV) {
    return path;
  }
  const base = getApiBase();
  return `/api/proxy?base=${encodeURIComponent(base)}&path=${encodeURIComponent(path)}`;
};

const NGROK_HEADERS = { "ngrok-skip-browser-warning": "1" };

export const pioFetch = (url, opts = {}) =>
  fetch(url, {
    ...opts,
    headers: { ...NGROK_HEADERS, ...opts.headers },
  });

/** GET JSON; returns null on failure. */
export const apiGet = async (path) => {
  try {
    const res = await pioFetch(buildApiUrl(path));
    if (!res.ok) throw new Error(res.statusText);
    return await res.json();
  } catch (e) {
    console.warn(`API GET failed: ${path}`, e.message);
    return null;
  }
};

/** Mutating request; returns { ok, status, data }. */
export const apiMutate = async (path, method, body) => {
  try {
    const res = await pioFetch(buildApiUrl(path), {
      method,
      headers: { "Content-Type": "application/json" },
      body: body != null ? JSON.stringify(body) : undefined,
    });
    let data = null;
    const text = await res.text();
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    return { ok: res.ok, status: res.status, data };
  } catch (e) {
    return { ok: false, status: 0, data: { error: e.message } };
  }
};
