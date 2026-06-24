import { useState, useEffect, useCallback, useRef } from "react";
import { apiGet, apiMutate, apiErrorMessage } from "./pioreactorApi";

const buildInitialValues = (step) => {
  const nextValues = {};
  if (!step?.fields?.length) return nextValues;
  step.fields.forEach((field) => {
    if (field.field_type === "float_list") {
      nextValues[field.name] = Array.isArray(field.default)
        ? field.default.join(", ")
        : "";
      return;
    }
    if (field.field_type === "bool") {
      if (typeof field.default === "string") {
        nextValues[field.name] = field.default.toLowerCase() === "yes" ? "yes" : "no";
        return;
      }
      nextValues[field.name] = field.default ? "yes" : "no";
      return;
    }
    if (field.default != null) {
      nextValues[field.name] = field.default;
    } else {
      nextValues[field.name] = "";
    }
  });
  return nextValues;
};

const formatInputs = (step, values) => {
  if (!step?.fields?.length) return {};
  const output = {};
  step.fields.forEach((field) => {
    const rawValue = values[field.name];
    if (field.field_type === "bool") {
      if (field.name === "confirmed") {
        output[field.name] = true;
        return;
      }
      if (typeof rawValue === "string") {
        output[field.name] = rawValue.toLowerCase() === "yes";
        return;
      }
      output[field.name] = Boolean(rawValue);
      return;
    }
    if (field.field_type === "float_list") {
      if (typeof rawValue === "string") {
        output[field.name] = rawValue
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean)
          .map(Number);
        return;
      }
      output[field.name] = Array.isArray(rawValue) ? rawValue : [];
      return;
    }
    if (field.field_type === "float") {
      output[field.name] = rawValue === "" ? rawValue : Number(rawValue);
      return;
    }
    if (field.field_type === "int") {
      output[field.name] =
        rawValue === "" ? rawValue : Number.parseInt(rawValue, 10);
      return;
    }
    output[field.name] = rawValue;
  });
  if (step.step_type === "action") {
    output.confirm = true;
  }
  return output;
};

const sessionResultFrom = (session, step) =>
  session?.result ||
  step?.result ||
  step?.metadata?.result ||
  null;

export default function CalibrationSessionWizard({
  th,
  open,
  unitId,
  protocol,
  onClose,
  onComplete,
}) {
  const [sessionId, setSessionId] = useState(null);
  const [session, setSession] = useState(null);
  const [step, setStep] = useState(null);
  const [values, setValues] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const startInFlight = useRef(false);

  const encUnit = encodeURIComponent(unitId || "");
  const sessionPath = (id) =>
    `/api/workers/${encUnit}/calibrations/sessions/${encodeURIComponent(id)}`;

  const applyPayload = (payload) => {
    if (payload?.session) setSession(payload.session);
    if (payload?.step) {
      setStep(payload.step);
      setValues(buildInitialValues(payload.step));
    } else {
      setStep(null);
      setValues({});
    }
  };

  const reset = useCallback(() => {
    setSessionId(null);
    setSession(null);
    setStep(null);
    setValues({});
    setError("");
    setLoading(false);
    startInFlight.current = false;
  }, []);

  const startSession = useCallback(async () => {
    if (!open || !unitId || !protocol || startInFlight.current || sessionId) return;
    startInFlight.current = true;
    setLoading(true);
    setError("");
    try {
      const res = await apiMutate(
        `/api/workers/${encUnit}/calibrations/sessions`,
        "POST",
        {
          protocol_name: protocol.protocol_name,
          target_device: protocol.target_device,
        },
      );
      if (!res.ok) {
        throw new Error(apiErrorMessage(res.data, res.status));
      }
      const id = res.data?.session?.session_id;
      if (!id) throw new Error("Session started without an id.");
      setSessionId(id);
      if (res.data?.step) {
        applyPayload(res.data);
      } else {
        const follow = await apiGet(sessionPath(id));
        if (!follow?.step) throw new Error("Session started without a step.");
        applyPayload(follow);
      }
    } catch (e) {
      setError(e.message || "Failed to start calibration.");
    } finally {
      setLoading(false);
      startInFlight.current = false;
    }
  }, [open, unitId, protocol, sessionId, encUnit]);

  useEffect(() => {
    if (!open) {
      reset();
      return;
    }
    startSession();
  }, [open, unitId, protocol?.target_device]); // eslint-disable-line react-hooks/exhaustive-deps

  const advance = async (overrideInputs) => {
    if (!sessionId || !unitId) return;
    setLoading(true);
    setError("");
    try {
      const inputs = overrideInputs ?? formatInputs(step, values);
      const res = await apiMutate(
        `/api/workers/${encUnit}/calibrations/sessions/${encodeURIComponent(sessionId)}/inputs`,
        "POST",
        { inputs },
      );
      if (!res.ok) {
        throw new Error(apiErrorMessage(res.data, res.status));
      }
      applyPayload(res.data);
      if (res.data?.session) setSession(res.data.session);
    } catch (e) {
      setError(e.message || "Failed to advance calibration.");
    } finally {
      setLoading(false);
    }
  };

  const abort = async () => {
    if (sessionId && unitId) {
      try {
        await apiMutate(
          `/api/workers/${encUnit}/calibrations/sessions/${encodeURIComponent(sessionId)}/abort`,
          "POST",
        );
      } catch {
        /* best effort */
      }
    }
    reset();
    onClose?.();
  };

  const finish = () => {
    const result = sessionResultFrom(session, step);
    reset();
    onComplete?.(result);
    onClose?.();
  };

  if (!open) return null;

  const result = sessionResultFrom(session, step);
  const isDone =
    !!result ||
    session?.status === "complete" ||
    session?.status === "failed";
  const stepImage = step?.metadata?.image;
  const inlineActions = step?.metadata?.actions || [];

  const inputStyle = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: `1px solid ${th.border}`,
    background: th.bgAlt,
    color: th.text,
    fontSize: 15,
    fontFamily: "inherit",
    boxSizing: "border-box",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: th.modalOverlay,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) abort();
      }}
    >
      <div
        style={{
          background: th.surface,
          border: `1px solid ${th.border}`,
          borderRadius: 14,
          boxShadow: th.shadowHover,
          width: "100%",
          maxWidth: 520,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "18px 22px",
            borderBottom: `1px solid ${th.borderLight}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 19, fontWeight: 700, color: th.text }}>
              {protocol?.title || "Calibration"}
            </div>
            <div style={{ fontSize: 15, color: th.textMuted, marginTop: 2 }}>
              {unitId}
            </div>
          </div>
          <button
            type="button"
            onClick={() => !loading && (isDone ? finish() : abort())}
            style={{
              background: th.bgAlt,
              border: `1px solid ${th.border}`,
              borderRadius: 8,
              width: 32,
              height: 32,
              cursor: "pointer",
              fontSize: 18,
              color: th.textSecondary,
              fontFamily: "inherit",
            }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: "20px 22px", overflowY: "auto", flex: 1 }}>
          {error && (
            <div
              style={{
                marginBottom: 14,
                padding: "10px 12px",
                borderRadius: 8,
                background: th.dangerBg,
                color: th.danger,
                fontSize: 15,
              }}
            >
              {error}
            </div>
          )}

          {session?.status === "failed" && session?.error && (
            <div
              style={{
                marginBottom: 14,
                padding: "10px 12px",
                borderRadius: 8,
                background: th.dangerBg,
                color: th.danger,
                fontSize: 15,
              }}
            >
              {session.error}
            </div>
          )}

          {loading && (
            <div
              style={{
                marginBottom: 14,
                fontSize: 15,
                color: th.textMuted,
              }}
            >
              Working… this can take up to a minute for pump or stirring steps.
            </div>
          )}

          {step?.title && (
            <div
              style={{
                fontSize: 17,
                fontWeight: 600,
                color: th.text,
                marginBottom: 8,
              }}
            >
              {step.title}
            </div>
          )}

          {stepImage?.src && (
            <img
              src={stepImage.src}
              alt={stepImage.alt || ""}
              style={{
                width: "100%",
                maxHeight: 200,
                objectFit: "contain",
                borderRadius: 8,
                marginBottom: 12,
                background: th.bgAlt,
              }}
            />
          )}

          {step?.body && (
            <p
              style={{
                margin: "0 0 16px",
                fontSize: 15,
                color: th.textSecondary,
                lineHeight: 1.65,
                whiteSpace: "pre-wrap",
              }}
            >
              {step.body}
            </p>
          )}

          {step?.fields?.map((field) => {
            if (
              step.step_type === "action" &&
              field.field_type === "bool" &&
              field.name === "confirm"
            ) {
              return null;
            }
            if (field.field_type === "bool" && field.name === "confirmed") {
              return null;
            }
            if (field.field_type === "bool" || field.field_type === "choice") {
              const options =
                field.field_type === "choice"
                  ? field.options || []
                  : field.options?.length
                    ? field.options
                    : ["yes", "no"];
              return (
                <label
                  key={field.name}
                  style={{
                    display: "block",
                    marginBottom: 14,
                    fontSize: 14,
                    fontWeight: 600,
                    color: th.textSecondary,
                  }}
                >
                  {field.label}
                  <select
                    value={values[field.name] ?? ""}
                    onChange={(e) =>
                      setValues((prev) => ({
                        ...prev,
                        [field.name]: e.target.value,
                      }))
                    }
                    style={{ ...inputStyle, marginTop: 6 }}
                  >
                    {options.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </label>
              );
            }
            const inputType =
              field.field_type === "float" || field.field_type === "int"
                ? "number"
                : "text";
            return (
              <label
                key={field.name}
                style={{
                  display: "block",
                  marginBottom: 14,
                  fontSize: 14,
                  fontWeight: 600,
                  color: th.textSecondary,
                }}
              >
                {field.label}
                <input
                  type={inputType}
                  step={field.field_type === "int" ? 1 : "any"}
                  min={field.minimum ?? undefined}
                  max={field.maximum ?? undefined}
                  value={values[field.name] ?? ""}
                  onChange={(e) =>
                    setValues((prev) => ({
                      ...prev,
                      [field.name]: e.target.value,
                    }))
                  }
                  style={{ ...inputStyle, marginTop: 6 }}
                />
                {field.help_text && (
                  <span
                    style={{
                      display: "block",
                      marginTop: 4,
                      fontSize: 13,
                      fontWeight: 400,
                      color: th.textMuted,
                    }}
                  >
                    {field.help_text}
                  </span>
                )}
              </label>
            );
          })}

          {result?.calibrations?.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: th.text,
                  marginBottom: 6,
                }}
              >
                Saved:
              </div>
              {result.calibrations.map((c) => (
                <div
                  key={`${c.device}-${c.calibration_name}`}
                  style={{ fontSize: 15, color: th.textSecondary }}
                >
                  {c.calibration_name}
                </div>
              ))}
            </div>
          )}

          {result?.calibration?.calibration_name && (
            <div style={{ marginTop: 8, fontSize: 15, color: th.textSecondary }}>
              Saved: {result.calibration.calibration_name}
            </div>
          )}
        </div>

        <div
          style={{
            padding: "14px 22px",
            borderTop: `1px solid ${th.borderLight}`,
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          {!isDone && (
            <button
              type="button"
              onClick={abort}
              disabled={loading}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: `1px solid ${th.border}`,
                background: th.bgAlt,
                color: th.textSecondary,
                fontSize: 15,
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                fontFamily: "inherit",
              }}
            >
              Abort
            </button>
          )}
          {inlineActions.map((action, i) => (
            <button
              key={i}
              type="button"
              disabled={loading}
              onClick={() => advance(action.inputs)}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: `1px solid ${th.border}`,
                background: th.bgAlt,
                color: th.textSecondary,
                fontSize: 15,
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                fontFamily: "inherit",
              }}
            >
              {action.label}
            </button>
          ))}
          <button
            type="button"
            disabled={!isDone && (!step || loading)}
            onClick={() => (isDone ? finish() : advance())}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              background: th.accent,
              color: "#fff",
              fontSize: 15,
              fontWeight: 700,
              cursor: !isDone && (!step || loading) ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              opacity: !isDone && (!step || loading) ? 0.6 : 1,
            }}
          >
            {isDone ? "Done" : step?.step_type === "action" ? "Run step" : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
