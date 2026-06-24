/** Build Pioreactor-compatible calibration YAML for POST /calibrations/{device}. */

const yamlScalar = (value) => {
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "0";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value === "") return '""';
  return JSON.stringify(String(value));
};

const yamlLines = (value, indent = 0) => {
  const pad = "  ".repeat(indent);
  if (value == null) return [];

  if (Array.isArray(value)) {
    const lines = [];
    value.forEach((item) => {
      if (item != null && typeof item === "object" && !Array.isArray(item)) {
        const nested = yamlLines(item, indent + 1);
        lines.push(`${pad}-`);
        nested.forEach((line) => lines.push(line));
      } else {
        lines.push(`${pad}- ${yamlScalar(item)}`);
      }
    });
    return lines;
  }

  if (typeof value === "object") {
    const lines = [];
    for (const [key, child] of Object.entries(value)) {
      if (child == null) continue;
      if (typeof child === "object") {
        lines.push(`${pad}${key}:`);
        lines.push(...yamlLines(child, indent + 1));
      } else {
        lines.push(`${pad}${key}: ${yamlScalar(child)}`);
      }
    }
    return lines;
  }

  return [`${pad}${yamlScalar(value)}`];
};

const normalizeForExport = (cal, targetUnit) => {
  const out = { ...cal };
  delete out.is_active;
  delete out.pioreactor_unit;
  delete out.ok;
  delete out.unit;
  delete out.value;

  if (targetUnit) out.calibrated_on_pioreactor_unit = targetUnit;

  if (Array.isArray(out.curve_data_)) {
    out.curve_data_ = {
      type: out.curve_type || "poly",
      coefficients: out.curve_data_,
    };
    delete out.curve_type;
  }

  return out;
};

export const calToYaml = (cal, targetUnit) => {
  const payload = normalizeForExport(cal, targetUnit);
  const order = [
    "calibration_type",
    "calibration_name",
    "calibrated_on_pioreactor_unit",
    "created_at",
    "curve_data_",
    "x",
    "y",
    "recorded_data",
    "hz",
    "dc",
    "voltage",
  ];
  const lines = [];
  const seen = new Set();

  for (const key of order) {
    if (!(key in payload)) continue;
    lines.push(`${key}:`);
    lines.push(...yamlLines(payload[key], 1));
    seen.add(key);
  }

  for (const [key, value] of Object.entries(payload)) {
    if (seen.has(key) || value == null) continue;
    lines.push(`${key}:`);
    lines.push(...yamlLines(value, 1));
  }

  return `${lines.join("\n")}\n`;
};
