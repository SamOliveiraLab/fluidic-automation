/** Normalize Pioreactor time_series JSON (series + data arrays). */

const parseMaybeJson = (value) => {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

export const normalizeTimeSeriesRaw = (raw) => {
  if (!raw || typeof raw !== "object") return null;
  const series = raw.series;
  if (!Array.isArray(series) || !series.length) return null;

  let data = parseMaybeJson(raw.data);
  if (!Array.isArray(data)) return null;

  data = data.map((item) => {
    const parsed = parseMaybeJson(item);
    return Array.isArray(parsed) ? parsed : [];
  });

  return { series, data };
};

const unitFromSeries = (seriesName) =>
  String(seriesName || "").replace(/-\d+$/, "");

const labelForUnit = (unitId, workers) => {
  const w = workers?.find((x) => x.id === unitId);
  return w?.label || unitId;
};

/**
 * Merge raw Pioreactor time_series payloads into one exportable table.
 * Works directly on API shape: { series: [...], data: [[{x,y},...], ...] }
 */
export const mergeRawTimeSeries = (seriesList, workers = []) => {
  const map = new Map();
  const columnMeta = new Map();

  for (const { raw, suffix } of seriesList) {
    const norm = normalizeTimeSeriesRaw(raw);
    if (!norm) continue;

    norm.series.forEach((seriesName, i) => {
      const unitId = unitFromSeries(seriesName);
      const label = labelForUnit(unitId, workers);
      const colKey = `${unitId}_${suffix}`;
      columnMeta.set(colKey, {
        key: colKey,
        label: `${label}_${suffix}`,
      });

      const points = norm.data[i] || [];
      for (const point of points) {
        if (!point || point.x == null || point.y == null) continue;
        const ts = new Date(point.x).getTime();
        if (!Number.isFinite(ts)) continue;
        if (!map.has(ts)) {
          const d = new Date(ts);
          map.set(ts, {
            _ts: ts,
            timestamp: d.toISOString(),
            displayTime: d.toLocaleString(),
          });
        }
        const row = map.get(ts);
        const v = Number(point.y);
        if (Number.isFinite(v)) row[colKey] = v;
      }
    });
  }

  const rows = [...map.values()].sort((a, b) => a._ts - b._ts);
  const valueCols = [...columnMeta.values()].sort((a, b) =>
    a.key.localeCompare(b.key),
  );

  const columns = [
    { key: "timestamp", label: "timestamp_utc" },
    { key: "displayTime", label: "time_display" },
    ...valueCols,
  ];

  return { rows, columns };
};

/** Merge chart-transformed datasets (fallback when raw unavailable). */
export const mergeChartDatasets = (odData, tempData, growthData) => {
  const map = new Map();
  const columnMeta = new Map();

  const labelForKey = (ds, key) => {
    const hit = ds?.keys?.find((k) => k.key === key);
    return hit?.label || key;
  };

  const ingest = (ds, suffix) => {
    if (!ds?.data?.length) return;
    for (const row of ds.data) {
      const ts = Number(row._ts);
      if (!Number.isFinite(ts) || ts <= 0) continue;
      if (!map.has(ts)) {
        map.set(ts, {
          _ts: ts,
          timestamp: new Date(ts).toISOString(),
          displayTime: row.t || new Date(ts).toLocaleString(),
        });
      }
      const out = map.get(ts);
      for (const key of Object.keys(row)) {
        if (key === "t" || key === "_ts") continue;
        const v = row[key];
        if (v == null || !Number.isFinite(Number(v))) continue;
        const colKey = `${key}_${suffix}`;
        columnMeta.set(colKey, {
          key: colKey,
          label: `${labelForKey(ds, key)}_${suffix}`,
        });
        out[colKey] = Number(v);
      }
    }
  };

  ingest(odData, "od");
  ingest(tempData, "temp");
  ingest(growthData, "gr");

  const rows = [...map.values()].sort((a, b) => a._ts - b._ts);
  const columns = [
    { key: "timestamp", label: "timestamp_utc" },
    { key: "displayTime", label: "time_display" },
    ...[...columnMeta.values()].sort((a, b) => a.key.localeCompare(b.key)),
  ];

  return { rows, columns };
};

export const downloadCsv = (rows, columns, filename) => {
  if (!rows?.length || !columns?.length) return false;
  const escape = (v) => {
    const s = v == null ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const csv = [
    columns.map((c) => escape(c.label)).join(","),
    ...rows.map((row) =>
      columns.map((c) => escape(row[c.key] ?? "")).join(","),
    ),
  ].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  return true;
};
