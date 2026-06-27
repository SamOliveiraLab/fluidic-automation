/** Merge OD / temperature / growth time series into one exportable table per experiment. */

export const mergeExperimentDatasets = (odData, tempData, growthData) => {
  const allKeys =
    odData?.keys?.length > 0
      ? odData.keys
      : tempData?.keys?.length > 0
        ? tempData.keys
        : growthData?.keys || [];

  const map = new Map();

  const ingest = (ds, suffix) => {
    if (!ds?.data?.length) return;
    for (const row of ds.data) {
      const ts = Number(row._ts);
      if (!Number.isFinite(ts) || ts <= 0) continue;
      if (!map.has(ts)) {
        map.set(ts, {
          _ts: ts,
          timestamp: new Date(ts).toISOString(),
          displayTime: row.t,
        });
      }
      const out = map.get(ts);
      for (const k of ds.keys || []) {
        const v = row[k.key];
        if (v != null && Number.isFinite(Number(v))) {
          out[`${k.key}_${suffix}`] = Number(v);
        }
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
  ];
  for (const k of allKeys) {
    columns.push({ key: `${k.key}_od`, label: `${k.label}_OD` });
    columns.push({ key: `${k.key}_temp`, label: `${k.label}_temp_C` });
    columns.push({ key: `${k.key}_gr`, label: `${k.label}_growth_rate` });
  }

  return { rows, columns, keys: allKeys };
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
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  return true;
};
