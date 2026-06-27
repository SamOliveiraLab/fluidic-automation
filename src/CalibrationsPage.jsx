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
import { apiGet, apiMutate, apiErrorMessage } from "./pioreactorApi";
import { calToYaml } from "./calibrationYaml";
import CalibrationSessionWizard from "./CalibrationSessionWizard";
import { protocolForDevice } from "./calibrationProtocols";
import { generateCurveData, formatCurveLabel } from "./curveUtils";

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

/** Build scatter + fit line from Pioreactor calibration object. */
const calibrationChartData = (cal) => {
  const xs = cal?.recorded_data?.x || [];
  const ys = cal?.recorded_data?.y || [];
  const points = xs.map((x, i) => ({
    x: Number(x),
    y: Number(ys[i]),
    kind: "measured",
  }));
  const fit = generateCurveData(cal, 50).map((p) => ({ ...p, kind: "fit" }));
  return { points, fit };
};

const CalChart = ({ cal, th }) => {
  const { points, fit } = useMemo(() => calibrationChartData(cal), [cal]);
  if (!points.length) {
    return (
      <div
        style={{
          padding: 24,
          textAlign: "center",
          color: th.textMuted,
          fontSize: 16,
        }}
      >
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
          tick={{ fontSize: 12, fill: th.textMuted }}
          label={{
            value: cal.x || "x",
            position: "insideBottom",
            offset: -2,
            fontSize: 12,
            fill: th.textMuted,
          }}
        />
        <YAxis
          dataKey="y"
          type="number"
          tick={{ fontSize: 12, fill: th.textMuted }}
          width={48}
          label={{
            value: cal.y || "y",
            angle: -90,
            position: "insideLeft",
            fontSize: 12,
            fill: th.textMuted,
          }}
        />
        <Tooltip
          contentStyle={{
            background: th.surface,
            border: `1px solid ${th.border}`,
            borderRadius: 8,
            fontSize: 14,
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
  onCalibrationsChanged,
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
  const [wizardOpen, setWizardOpen] = useState(false);

  const activeProtocol = protocolForDevice(device);

  useEffect(() => {
    if (!unitId && units[0]) setUnitId(units[0].id);
    if (unitId && !units.find((u) => u.id === unitId) && units[0])
      setUnitId(units[0].id);
  }, [units, unitId]);

  useEffect(() => {
    const list = DEVICES[tab] || DEVICES.pumps;
    if (!list.find((d) => d.id === device)) setDevice(list[0].id);
  }, [tab, device]);

  useEffect(() => {
    setSelectedName(null);
    setSelectedDetail(null);
  }, [device, unitId]);

  const load = useCallback(async () => {
    if (!unitId || !connected) return;
    setLoading(true);
    const enc = encodeURIComponent(unitId);
    const [all, active] = await Promise.all([
      apiGet(`/api/workers/${enc}/calibrations`, { unitId }),
      apiGet(`/api/workers/${enc}/active_calibrations`, { unitId }),
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
      { unitId },
    );
    setSelectedDetail(detail || null);
  };

  useEffect(() => {
    if (!activeName || selectedName) return;
    openDetail(activeName);
  }, [activeName, unitId, device, selectedName]); // eslint-disable-line react-hooks/exhaustive-deps

  const setActive = async (name) => {
    if (!unitId || !name) return;
    setBusy(true);
    const res = await apiMutate(
      `/api/workers/${encodeURIComponent(unitId)}/active_calibrations/${device}/${encodeURIComponent(name)}`,
      "PATCH",
    );
    setBusy(false);
    if (res.ok) {
      showFeedback(
        "Calibration activated",
        `${deviceLabel(device)}: ${name}`,
        "success",
      );
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
      showFeedback(
        "Calibration cleared",
        `${deviceLabel(device)} is no longer active.`,
        "success",
      );
      load();
    } else {
      showFeedback("Could not clear", `HTTP ${res.status}`, "error");
    }
  };

  const copyToUnit = async () => {
    if (!selectedDetail || !copyTarget || copyTarget === unitId) return;
    setBusy(true);
    const yaml = calToYaml(selectedDetail, copyTarget);
    const post = await apiMutate(
      `/api/workers/${encodeURIComponent(copyTarget)}/calibrations/${device}`,
      "POST",
      { calibration_data: yaml, set_as_active: true },
    );
    if (!post.ok) {
      setBusy(false);
      showFeedback(
        "Copy failed",
        apiErrorMessage(post.data, post.status) ||
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
        `${name} copied to ${copyTarget} (${deviceLabel(device)})`,
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

  const handleWizardComplete = async (result) => {
    await load();
    onCalibrationsChanged?.();
    const links = result?.calibrations?.length
      ? result.calibrations
      : result?.calibration
        ? [result.calibration]
        : [];
    const hit = links.find(
      (c) => c.calibration_name && (c.device === device || !c.device),
    );
    if (hit?.calibration_name) {
      setBusy(true);
      const res = await apiMutate(
        `/api/workers/${encodeURIComponent(unitId)}/active_calibrations/${device}/${encodeURIComponent(hit.calibration_name)}`,
        "PATCH",
      );
      setBusy(false);
      if (res.ok) {
        showFeedback(
          "Calibration saved & activated",
          `${deviceLabel(device)}: ${hit.calibration_name}`,
          "success",
        );
        load();
        onCalibrationsChanged?.();
      }
    } else if (links.length) {
      showFeedback(
        "Calibration saved",
        "Set it active from the list if needed.",
        "success",
      );
    }
  };

  const btn = (primary) => ({
    padding: primary ? "8px 14px" : "6px 14px",
    borderRadius: primary ? 8 : 7,
    border: primary ? "none" : `1px solid ${th.border}`,
    background: primary ? th.accent : th.bgAlt,
    color: primary ? "#fff" : th.textSecondary,
    fontSize: 15,
    fontWeight: primary ? 700 : 600,
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
          justifyContent: "space-between",
          marginBottom: 20,
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 700,
              color: th.text,
            }}
          >
            Calibrations
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 16, color: th.textMuted }}>
            Run calibrations here, then set active or copy between reactors.
          </p>
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
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
          <button
            onClick={load}
            disabled={loading || !connected}
            style={btn(false)}
          >
            {loading ? "Loading…" : "↻ Refresh"}
          </button>
          {!connected && (
            <span style={{ fontSize: 15, color: th.danger }}>
              Pioreactor offline
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: "10px 20px",
              borderRadius: 10,
              border: `1.5px solid ${tab === t.id ? th.accent : th.border}`,
              background: tab === t.id ? th.accentLight : th.surface,
              color: tab === t.id ? th.accent : th.textSecondary,
              fontWeight: 700,
              fontSize: 15,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Device picker */}
      <div
        style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}
      >
        {deviceList.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => setDevice(d.id)}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: `1.5px solid ${device === d.id ? th.accent : th.border}`,
              background: device === d.id ? th.accentLight : "transparent",
              color: device === d.id ? th.accent : th.textSecondary,
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {d.label}
          </button>
        ))}
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
            boxShadow: th.shadow,
          }}
        >
          <div
            style={{
              padding: "18px 22px",
              borderBottom: `1px solid ${th.borderLight}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: th.text }}>
                Saved curves
              </div>
              <div style={{ fontSize: 15, color: th.textMuted, marginTop: 2 }}>
                {activeName
                  ? `Active: ${activeName}`
                  : `No active curve for ${deviceLabel(device).toLowerCase()}`}
              </div>
            </div>
            <button
              type="button"
              disabled={!connected || !activeProtocol || busy}
              onClick={() => setWizardOpen(true)}
              style={btn(true)}
            >
              Run calibration
            </button>
          </div>
          {calsForDevice.length === 0 ? (
            <div style={{ padding: 20, fontSize: 16, color: th.textMuted }}>
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
                  <div
                    style={{ fontWeight: 600, fontSize: 15, color: th.text }}
                  >
                    {name}
                    {isActive && (
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: 11,
                          color: th.textMuted,
                          fontWeight: 600,
                          letterSpacing: "0.06em",
                        }}
                      >
                        active
                      </span>
                    )}
                  </div>
                  <div
                    style={{ fontSize: 13, color: th.textMuted, marginTop: 2 }}
                  >
                    {c.created_at
                      ? new Date(c.created_at).toLocaleDateString()
                      : ""}
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
            padding: "22px 24px",
            minHeight: 280,
            boxShadow: th.shadow,
          }}
        >
          {!selectedDetail ? (
            <div
              style={{
                padding: 40,
                textAlign: "center",
                color: th.textMuted,
                fontSize: 16,
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
                  <div
                    style={{ fontSize: 19, fontWeight: 700, color: th.text }}
                  >
                    {selectedDetail.calibration_name}
                    {(activeName === selectedDetail.calibration_name ||
                      selectedDetail.is_active) && (
                      <span
                        style={{
                          marginLeft: 10,
                          fontSize: 12,
                          fontWeight: 600,
                          color: th.success || "#2d8a4e",
                          letterSpacing: "0.04em",
                        }}
                      >
                        active
                      </span>
                    )}
                  </div>
                  <div
                    style={{ fontSize: 15, color: th.textMuted, marginTop: 2 }}
                  >
                    {unitLabel(unitId)} / {deviceLabel(device)}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {activeName === selectedDetail.calibration_name ||
                  selectedDetail.is_active ? (
                    <button
                      style={btn(false)}
                      disabled={busy}
                      onClick={clearActive}
                    >
                      Set inactive
                    </button>
                  ) : (
                    <button
                      style={btn(true)}
                      disabled={busy}
                      onClick={() => setActive(selectedDetail.calibration_name)}
                    >
                      Set active
                    </button>
                  )}
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                  gap: "10px 16px",
                  marginBottom: 16,
                  fontSize: 14,
                }}
              >
                {selectedDetail.created_at && (
                  <div>
                    <div style={{ color: th.textMuted, marginBottom: 2 }}>
                      Created
                    </div>
                    <div style={{ color: th.textSecondary, fontWeight: 600 }}>
                      {new Date(selectedDetail.created_at).toLocaleString()}
                    </div>
                  </div>
                )}
                {selectedDetail.calibration_type && (
                  <div>
                    <div style={{ color: th.textMuted, marginBottom: 2 }}>
                      Type
                    </div>
                    <div style={{ color: th.textSecondary, fontWeight: 600 }}>
                      {selectedDetail.calibration_type}
                    </div>
                  </div>
                )}
                <div>
                  <div style={{ color: th.textMuted, marginBottom: 2 }}>
                    Axes
                  </div>
                  <div style={{ color: th.textSecondary, fontWeight: 600 }}>
                    {selectedDetail.x || "x"} / {selectedDetail.y || "y"}
                  </div>
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <div style={{ color: th.textMuted, marginBottom: 2 }}>
                    Fit curve
                  </div>
                  <div
                    style={{
                      color: th.textSecondary,
                      fontWeight: 600,
                      fontFamily: "ui-monospace, monospace",
                      fontSize: 13,
                    }}
                  >
                    {formatCurveLabel(selectedDetail)}
                  </div>
                </div>
              </div>

              <CalChart cal={selectedDetail} th={th} />

              {selectedDetail.recorded_data?.x?.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: th.textSecondary,
                      marginBottom: 8,
                    }}
                  >
                    Recorded data
                  </div>
                  <div
                    style={{
                      maxHeight: 180,
                      overflowY: "auto",
                      border: `1px solid ${th.borderLight}`,
                      borderRadius: 8,
                    }}
                  >
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: 14,
                      }}
                    >
                      <thead>
                        <tr style={{ background: th.bgAlt }}>
                          <th
                            style={{
                              textAlign: "left",
                              padding: "8px 12px",
                              color: th.textMuted,
                              fontWeight: 600,
                            }}
                          >
                            {selectedDetail.x || "x"}
                          </th>
                          <th
                            style={{
                              textAlign: "left",
                              padding: "8px 12px",
                              color: th.textMuted,
                              fontWeight: 600,
                            }}
                          >
                            {selectedDetail.y || "y"}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedDetail.recorded_data.x.map((xVal, idx) => (
                          <tr
                            key={idx}
                            style={{ borderTop: `1px solid ${th.borderLight}` }}
                          >
                            <td style={{ padding: "6px 12px", color: th.text }}>
                              {xVal}
                            </td>
                            <td style={{ padding: "6px 12px", color: th.text }}>
                              {selectedDetail.recorded_data.y?.[idx] ?? ""}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

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
                      fontSize: 14,
                      fontWeight: 600,
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
                      fontSize: 15,
                      color: th.textMuted,
                      lineHeight: 1.6,
                    }}
                  >
                    Uploads this YAML to the target Pi and sets it active. Best
                    when hardware matches.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <CalibrationSessionWizard
        th={th}
        open={wizardOpen}
        unitId={unitId}
        protocol={activeProtocol}
        onClose={() => setWizardOpen(false)}
        onComplete={handleWizardComplete}
      />
    </div>
  );
}
