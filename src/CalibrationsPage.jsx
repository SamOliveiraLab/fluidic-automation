import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Scatter,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
} from "recharts";
import { apiGet, apiMutate } from "./pioreactorApi";

const TABS = [
  { id: "pumps", label: "Pumps" },
  { id: "stirring", label: "Stirring" },
  { id: "od", label: "OD" },
];

const DEVICES = {
  pumps: [
    { id: "media_pump", label: "Media pump" },
    { id: "waste_pump", label: "Waste pump" },
    { id: "alt_media_pump", label: "Alt-media pump" },
  ],
  stirring: [{ id: "stirring", label: "Stirring" }],
  od: [
    { id: "od90", label: "OD90" },
    { id: "od", label: "OD (all angles)" },
  ],
};

const deviceLabel = (id) => {
  for (const group of Object.values(DEVICES)) {
    const hit = group.find((d) => d.id === id);
    if (hit) return hit.label;
  }
  return id;
};

/** Build scatter + optional polynomial fit from Pioreactor calibration object. */
const calibrationChartData = (cal) => {
  const xs = cal?.recorded_data?.x || [];
  const ys = cal?.recorded_data?.y || [];
  const points = xs.map((x, i) => ({
    x: Number(x),
    y: Number(ys[i]),
    kind: "measured",
  }));
  const coeffs = cal?.curve_data_;
  if (!coeffs?.length || !points.length) return { points, fit: [] };

  const xsNum = points.map((p) => p.x);
  const minX = Math.min(...xsNum);
  const maxX = Math.max(...xsNum);
  const pad = (maxX - minX) * 0.05 || 0.1;
  const steps = 40;
  const fit = [];
  for (let i = 0; i <= steps; i++) {
    const x = minX - pad + ((maxX + pad - (minX - pad)) * i) / steps;
    let y = 0;
    for (let c = 0; c < coeffs.length; c++) {
      y += Number(coeffs[c]) * x ** c;
    }
    fit.push({ x, y, kind: "fit" });
  }
  return { points, fit };
};

/** Minimal YAML for POST /calibrations/{device} (copy between reactors). */
const calToYaml = (cal) => {
  const strip = { ...cal };
  delete strip.is_active;
  delete strip.pioreactor_unit;
  const lines = [];
  const walk = (obj, indent = 0) => {
    const pad = "  ".repeat(indent);
    for (const [k, v] of Object.entries(obj)) {
      if (v == null) continue;
      if (Array.isArray(v)) {
        lines.push(`${pad}${k}:`);
        v.forEach((item) => {
          if (typeof item === "object") {
            lines.push(`${pad}  -`);
            walk(item, indent + 2);
          } else {
            lines.push(`${pad}  - ${item}`);
          }
        });
      } else if (typeof v === "object") {
        lines.push(`${pad}${k}:`);
        walk(v, indent + 1);
      } else if (typeof v === "string") {
        lines.push(`${pad}${k}: ${JSON.stringify(v)}`);
      } else {
        lines.push(`${pad}${k}: ${v}`);
      }
    }
  };
  walk(strip);
  return lines.join("\n");
};

const CalChart = ({ cal, th }) => {
  const { points, fit } = useMemo(() => calibrationChartData(cal), [cal]);
  if (!points.length) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: th.textMuted }}>
        No recorded data for this curve.
      </div>
    );
  }
  const merged = [...fit, ...points];
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={th.borderLight} />
        <XAxis
          dataKey="x"
          type="number"
          tick={{ fontSize: 11, fill: th.textMuted }}
          label={{
            value: cal.x || "x",
            position: "insideBottom",
            offset: -2,
            fontSize: 11,
            fill: th.textMuted,
          }}
        />
        <YAxis
          dataKey="y"
          type="number"
          tick={{ fontSize: 11, fill: th.textMuted }}
          width={48}
          label={{
            value: cal.y || "y",
            angle: -90,
            position: "insideLeft",
            fontSize: 11,
            fill: th.textMuted,
          }}
        />
        <Tooltip
          contentStyle={{
            background: th.surface,
            border: `1px solid ${th.border}`,
            borderRadius: 8,
            fontSize: 13,
          }}
        />
        {fit.length > 0 && (
          <Line
            data={fit}
            dataKey="y"
            stroke={th.accent}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        )}
        <Scatter data={points} fill={th.chartLine2 || "#e06060"} />
      </ComposedChart>
    </ResponsiveContainer>
  );
};

export default function CalibrationsPage({
  th,
  reactors,
  connected,
  getCultureLabel,
  showFeedback,
  onNavigatePumps,
}) {
  const units = useMemo(
    () => reactors.filter((r) => r.status !== "disconnected"),
    [reactors],
  );
  const [unitId, setUnitId] = useState(units[0]?.id || "");
  const [tab, setTab] = useState("pumps");
  const [device, setDevice] = useState("media_pump");
  const [allCals, setAllCals] = useState({});
  const [activeCals, setActiveCals] = useState({});
  const [loading, setLoading] = useState(false);
  const [selectedName, setSelectedName] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [busy, setBusy] = useState(false);
  const [copyTarget, setCopyTarget] = useState("");

  useEffect(() => {
    if (!unitId && units[0]) setUnitId(units[0].id);
    if (unitId && !units.find((u) => u.id === unitId) && units[0])
      setUnitId(units[0].id);
  }, [units, unitId]);

  useEffect(() => {
    const list = DEVICES[tab] || DEVICES.pumps;
    if (!list.find((d) => d.id === device)) setDevice(list[0].id);
  }, [tab, device]);

  const load = useCallback(async () => {
    if (!unitId || !connected) return;
    setLoading(true);
    const enc = encodeURIComponent(unitId);
    const [all, active] = await Promise.all([
      apiGet(`/api/workers/${enc}/calibrations`),
      apiGet(`/api/workers/${enc}/active_calibrations`),
    ]);
    setAllCals(all && typeof all === "object" ? all : {});
    setActiveCals(active && typeof active === "object" ? active : {});
    setLoading(false);
  }, [unitId, connected]);

  useEffect(() => {
    load();
  }, [load]);

  const deviceList = DEVICES[tab] || [];
  const calsForDevice = allCals[device] || [];
  const activeForDevice = activeCals[device];
  const activeName =
    activeForDevice?.calibration_name ||
    calsForDevice.find((c) => c.is_active)?.calibration_name;

  const openDetail = async (name) => {
    if (!name || !unitId) return;
    setSelectedName(name);
    const enc = encodeURIComponent(unitId);
    const detail = await apiGet(
      `/api/workers/${enc}/calibrations/${device}/${encodeURIComponent(name)}`,
    );
    setSelectedDetail(detail || null);
  };

  const setActive = async (name) => {
    if (!unitId || !name) return;
    setBusy(true);
    const res = await apiMutate(
      `/api/workers/${encodeURIComponent(unitId)}/active_calibrations/${device}/${encodeURIComponent(name)}`,
      "PATCH",
    );
    setBusy(false);
    if (res.ok) {
      showFeedback("Calibration activated", `${deviceLabel(device)}: ${name}`, "success");
      load();
      if (selectedName === name) openDetail(name);
    } else {
      showFeedback("Could not activate", `HTTP ${res.status}`, "error");
    }
  };

  const clearActive = async () => {
    if (!unitId) return;
    setBusy(true);
    const res = await apiMutate(
      `/api/workers/${encodeURIComponent(unitId)}/active_calibrations/${device}`,
      "DELETE",
    );
    setBusy(false);
    if (res.ok) {
      showFeedback("Calibration cleared", `${deviceLabel(device)} is no longer active.`, "success");
      load();
    } else {
      showFeedback("Could not clear", `HTTP ${res.status}`, "error");
    }
  };

  const copyToUnit = async () => {
    if (!selectedDetail || !copyTarget || copyTarget === unitId) return;
    setBusy(true);
    const yaml = calToYaml(selectedDetail);
    const post = await apiMutate(
      `/api/workers/${encodeURIComponent(copyTarget)}/calibrations/${device}`,
      "POST",
      { calibration_data: yaml },
    );
    if (!post.ok) {
      setBusy(false);
      showFeedback(
        "Copy failed",
        `Could not upload to ${copyTarget} (HTTP ${post.status}).`,
        "error",
      );
      return;
    }
    const name = selectedDetail.calibration_name;
    const patch = await apiMutate(
      `/api/workers/${encodeURIComponent(copyTarget)}/active_calibrations/${device}/${encodeURIComponent(name)}`,
      "PATCH",
    );
    setBusy(false);
    if (patch.ok) {
      showFeedback(
        "Copied & activated",
        `${name} → ${copyTarget} (${deviceLabel(device)})`,
        "success",
      );
      setCopyTarget("");
    } else {
      showFeedback(
        "Uploaded but not activated",
        `Curve copied to ${copyTarget}. Set active manually.`,
        "info",
      );
    }
  };

  const unitLabel = (id) => {
    const r = reactors.find((x) => x.id === id);
    return (r && getCultureLabel?.(r.id)) || r?.label || id;
  };

  const btn = (primary) => ({
    padding: "6px 12px",
    borderRadius: 7,
    border: primary ? "none" : `1px solid ${th.border}`,
    background: primary ? th.accent : th.bgAlt,
    color: primary ? "#fff" : th.textSecondary,
    fontSize: 13,
    fontWeight: 700,
    cursor: busy ? "not-allowed" : "pointer",
    fontFamily: "inherit",
    opacity: busy ? 0.6 : 1,
  });

  return (
    <div style={{ padding: "24px" }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: th.text }}>
          Calibrations
        </h2>
        <select
          value={unitId}
          onChange={(e) => {
            setUnitId(e.target.value);
            setSelectedName(null);
            setSelectedDetail(null);
          }}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: `1px solid ${th.border}`,
            background: th.bgAlt,
            color: th.text,
            fontSize: 15,
            fontWeight: 600,
            fontFamily: "inherit",
          }}
        >
          {units.map((r) => (
            <option key={r.id} value={r.id}>
              {unitLabel(r.id)}
            </option>
          ))}
        </select>
        <button onClick={load} disabled={loading || !connected} style={btn(false)}>
          {loading ? "Loading…" : "Refresh"}
        </button>
        {!connected && (
          <span style={{ fontSize: 14, color: th.danger }}>Pioreactor offline</span>
        )}
      </div>

      <p style={{ margin: "0 0 16px", fontSize: 14, color: th.textMuted, lineHeight: 1.6 }}>
        One active calibration per device per reactor. Pumps need calibration before
        accurate dosing. Create new curves on the Pi (Protocols or{" "}
        <code style={{ fontSize: 12 }}>pio calibrations run</code>); manage and share
        them here.
      </p>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: `1.5px solid ${tab === t.id ? th.accent : th.border}`,
              background: tab === t.id ? th.accentLight : th.surface,
              color: tab === t.id ? th.accent : th.textSecondary,
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Status cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: 10,
          marginBottom: 20,
        }}
      >
        {deviceList.map((d) => {
          const active =
            activeCals[d.id]?.calibration_name ||
            (allCals[d.id] || []).find((c) => c.is_active)?.calibration_name;
          const ok = !!active;
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => setDevice(d.id)}
              style={{
                textAlign: "left",
                padding: "12px 14px",
                borderRadius: 10,
                border: `1.5px solid ${device === d.id ? th.accent : th.border}`,
                background: device === d.id ? th.accentLight : th.surface,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: th.text }}>
                {d.label}
              </div>
              <div
                style={{
                  fontSize: 12,
                  marginTop: 4,
                  color: ok ? th.success : th.warning,
                  fontWeight: 600,
                }}
              >
                {ok ? `Active: ${active}` : "No active calibration"}
              </div>
            </button>
          );
        })}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(240px, 1fr) minmax(280px, 1.2fr)",
          gap: 16,
          alignItems: "start",
        }}
      >
        {/* List */}
        <div
          style={{
            background: th.surface,
            border: `1px solid ${th.border}`,
            borderRadius: 14,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "14px 16px",
              borderBottom: `1px solid ${th.borderLight}`,
              fontWeight: 700,
              fontSize: 15,
              color: th.text,
            }}
          >
            {deviceLabel(device)} — saved curves
          </div>
          {calsForDevice.length === 0 ? (
            <div style={{ padding: 20, fontSize: 14, color: th.textMuted }}>
              No calibrations saved for this device on {unitLabel(unitId)}.
            </div>
          ) : (
            calsForDevice.map((c) => {
              const name = c.calibration_name;
              const isActive = name === activeName || c.is_active;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => openDetail(name)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "12px 16px",
                    border: "none",
                    borderBottom: `1px solid ${th.borderLight}`,
                    background:
                      selectedName === name ? th.bgAlt : "transparent",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 14, color: th.text }}>
                    {name}
                    {isActive && (
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: 11,
                          color: th.success,
                          fontWeight: 700,
                        }}
                      >
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: th.textMuted, marginTop: 2 }}>
                    {c.created_at
                      ? new Date(c.created_at).toLocaleDateString()
                      : "—"}
                    {c.calibrated_on_pioreactor_unit
                      ? ` · ${c.calibrated_on_pioreactor_unit}`
                      : ""}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Detail */}
        <div
          style={{
            background: th.surface,
            border: `1px solid ${th.border}`,
            borderRadius: 14,
            padding: "16px 18px",
            minHeight: 280,
          }}
        >
          {!selectedDetail ? (
            <div
              style={{
                padding: 40,
                textAlign: "center",
                color: th.textMuted,
                fontSize: 14,
              }}
            >
              Select a calibration to view its curve.
            </div>
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 8,
                  flexWrap: "wrap",
                  marginBottom: 12,
                }}
              >
                <div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: th.text }}>
                    {selectedDetail.calibration_name}
                  </div>
                  <div style={{ fontSize: 13, color: th.textMuted }}>
                    {selectedDetail.x} → {selectedDetail.y}
                    {selectedDetail.curve_type
                      ? ` · ${selectedDetail.curve_type}`
                      : ""}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button
                    style={btn(true)}
                    disabled={busy}
                    onClick={() => setActive(selectedDetail.calibration_name)}
                  >
                    Set active
                  </button>
                  {activeName === selectedDetail.calibration_name && (
                    <button style={btn(false)} disabled={busy} onClick={clearActive}>
                      Clear active
                    </button>
                  )}
                </div>
              </div>

              <CalChart cal={selectedDetail} th={th} />

              {/* Copy to another reactor */}
              {units.length > 1 && (
                <div
                  style={{
                    marginTop: 16,
                    paddingTop: 14,
                    borderTop: `1px solid ${th.borderLight}`,
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: th.textSecondary,
                      marginBottom: 8,
                    }}
                  >
                    Copy to another reactor
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <select
                      value={copyTarget}
                      onChange={(e) => setCopyTarget(e.target.value)}
                      style={{
                        flex: 1,
                        minWidth: 140,
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: `1px solid ${th.border}`,
                        background: th.bgAlt,
                        fontFamily: "inherit",
                      }}
                    >
                      <option value="">Select reactor…</option>
                      {units
                        .filter((u) => u.id !== unitId)
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {unitLabel(u.id)}
                          </option>
                        ))}
                    </select>
                    <button
                      style={btn(true)}
                      disabled={busy || !copyTarget}
                      onClick={copyToUnit}
                    >
                      Copy & activate
                    </button>
                  </div>
                  <p
                    style={{
                      margin: "8px 0 0",
                      fontSize: 12,
                      color: th.textMuted,
                    }}
                  >
                    Uploads this YAML to the target Pi and sets it active. Best when
                    hardware matches.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Pump dosing link */}
      {tab === "pumps" && !activeCals.media_pump && (
        <div
          style={{
            marginTop: 20,
            padding: "14px 16px",
            borderRadius: 10,
            background: th.warningBg,
            border: `1px solid ${th.warning}40`,
            fontSize: 14,
            color: th.textSecondary,
          }}
        >
          <strong style={{ color: th.warning }}>Media pump not calibrated</strong> on{" "}
          {unitLabel(unitId)}. Manual dosing on{" "}
          <button
            type="button"
            onClick={onNavigatePumps}
            style={{
              background: "none",
              border: "none",
              color: th.accent,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
              textDecoration: "underline",
              padding: 0,
            }}
          >
            Pump Control
          </button>{" "}
          may be inaccurate until you calibrate or copy a curve from another reactor.
        </div>
      )}
    </div>
  );
}
