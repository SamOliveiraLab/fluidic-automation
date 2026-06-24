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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const taskResultDone = (status) =>
  status === "complete" || status === "succeeded";

/** Unwrap per-unit payload from async task fanout results. */
export const unwrapUnitTaskValue = (taskPayload, unitId) => {
  if (!taskPayload || typeof taskPayload !== "object" || !unitId) return null;
  const unitResult = taskPayload.result?.[unitId] ?? taskPayload[unitId];
  if (!unitResult) return null;
  if (Array.isArray(unitResult)) return unitResult;
  if (unitResult.ok === true && unitResult.value != null) return unitResult.value;
  if (unitResult.ok === false) return null;
  return unitResult;
};

/** Unwrap fanout result: { unitId: payload } → payload */
const unwrapWorkerResult = (payload, unitId) => {
  if (!payload || typeof payload !== "object" || !unitId) return payload;
  const unwrapped = unwrapUnitTaskValue({ result: payload }, unitId);
  if (unwrapped != null) return unwrapped;
  if (unitId in payload && Object.keys(payload).length <= 2) {
    return payload[unitId];
  }
  return payload;
};

/**
 * Poll GET /unit_api/task_results/{id} until complete.
 * Many worker endpoints return 202 + result_url_path instead of data inline.
 */
export const pollTaskResult = async (resultPath, { attempts = 12, delayMs = 400 } = {}) => {
  if (!resultPath) return null;
  for (let i = 0; i < attempts; i++) {
    const res = await pioFetch(buildApiUrl(resultPath));
    if (!res.ok) return null;
    const data = await res.json();
    if (taskResultDone(data?.status)) return data.result ?? null;
    if (data?.status === "failed") return null;
    await sleep(delayMs);
  }
  return null;
};

/** GET JSON; follows async task dispatch when present. */
export const apiGet = async (path, { unitId } = {}) => {
  try {
    const res = await pioFetch(buildApiUrl(path));
    if (!res.ok) throw new Error(res.statusText);
    const data = await res.json();

    if (data?.result_url_path) {
      const result = await pollTaskResult(data.result_url_path);
      return unwrapWorkerResult(result, unitId);
    }

    return unwrapWorkerResult(data, unitId);
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

/** Extract a human-readable error from Pioreactor JSON or HTML error bodies. */
export const apiErrorMessage = (data, status) => {
  if (!data) return `Request failed (HTTP ${status})`;
  if (typeof data === "string") {
    if (data.includes("internal error")) {
      return "Pioreactor returned a server error. Try updating software on that unit (pio update), or run calibration from the Pi UI.";
    }
    return data.slice(0, 240);
  }
  return (
    data.error ||
    data.description ||
    data.cause ||
    data.remediation ||
    `Request failed (HTTP ${status})`
  );
};
