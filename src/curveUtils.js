/** Curve evaluation aligned with Pioreactor's frontend (poly / spline / akima). */

const findIntervalIndex = (knots, x) => {
  if (!Array.isArray(knots) || knots.length < 2) return 0;
  if (x <= knots[0]) return 0;
  if (x >= knots[knots.length - 1]) return knots.length - 2;
  for (let i = 0; i < knots.length - 1; i++) {
    if (x >= knots[i] && x <= knots[i + 1]) return i;
  }
  return knots.length - 2;
};

const evaluatePolynomial = (x, coeffs) => {
  if (!Array.isArray(coeffs) || coeffs.length === 0) return null;
  return coeffs.reduce(
    (acc, coefficient, i) => acc + coefficient * x ** (coeffs.length - 1 - i),
    0,
  );
};

const evaluateSpline = (x, splineData) => {
  const { knots, coefficients } = splineData || {};
  if (!Array.isArray(knots) || !Array.isArray(coefficients) || knots.length < 2) {
    return null;
  }
  const index = findIntervalIndex(knots, x);
  const segment = coefficients[index];
  if (!Array.isArray(segment) || segment.length !== 4) return null;
  const [a, b, c, d] = segment;
  const u = x - knots[index];
  return a + b * u + c * u * u + d * u * u * u;
};

/** Normalize legacy array + curve_type vs newer typed curve_data_ objects. */
export const normalizeCurveData = (cal) => {
  const raw = cal?.curve_data_;
  if (!raw) return null;
  if (Array.isArray(raw)) {
    const type = cal.curve_type || "poly";
    if (type === "poly") return { type: "poly", coefficients: raw };
    return null;
  }
  if (raw.type) return raw;
  return null;
};

export const evaluateCurve = (x, curveData) => {
  if (!curveData || Array.isArray(curveData)) return null;
  if (curveData.type === "spline" || curveData.type === "akima") {
    return evaluateSpline(x, curveData);
  }
  if (curveData.type === "poly") {
    return evaluatePolynomial(x, curveData.coefficients);
  }
  return null;
};

export const generateCurveData = (calibration, stepCount = 50) => {
  const xValues = calibration?.recorded_data?.x;
  const curveData = normalizeCurveData(calibration);

  if (!Array.isArray(xValues) || xValues.length === 0) {
    const xMin = 0;
    const xMax = 1;
    const stepSize = (xMax - xMin) / (stepCount - 1);
    return Array.from({ length: stepCount }, (_, i) => {
      const x = xMin + i * stepSize;
      return { x, y: evaluateCurve(x, curveData) };
    }).filter((p) => p.y != null && Number.isFinite(p.y));
  }

  const xMin = Math.min(...xValues);
  const xMax = Math.max(...xValues);
  if (xMin === xMax) {
    const y = evaluateCurve(xMin, curveData);
    return y == null ? [] : [{ x: xMin, y }];
  }

  const stepSize = (xMax - xMin) / (stepCount - 1);
  const points = [];
  for (let i = 0; i < stepCount; i++) {
    const x = xMin + i * stepSize;
    const y = evaluateCurve(x, curveData);
    if (y != null && Number.isFinite(y)) points.push({ x, y });
  }
  return points;
};

const formatPolynomial = (coefficients) => {
  const superscripts = "⁰¹²³⁴⁵⁶⁷⁸⁹";
  const toSup = (num) =>
    String(num)
      .split("")
      .map((d) => superscripts[Number(d)] || "")
      .join("");

  let result = "";
  coefficients.forEach((coef, i) => {
    if (coef === 0) return;
    const power = coefficients.length - i - 1;
    const absCoef = Math.abs(coef);
    if (result) result += coef > 0 ? " + " : " - ";
    else if (coef < 0) result += "-";
    if (absCoef !== 1 || power === 0) {
      result += absCoef < 1e-3 || absCoef >= 1e5 ? absCoef.toExponential(3) : absCoef.toFixed(3);
    }
    if (power > 0) {
      result += "x";
      if (power > 1) result += toSup(power);
    }
  });
  return result || "0";
};

export const formatCurveLabel = (cal) => {
  const curveData = normalizeCurveData(cal);
  if (!curveData) return "No fit curve";
  if (curveData.type === "spline") {
    const n = curveData.knots?.length ?? 0;
    return `Natural cubic spline (${n} knots)`;
  }
  if (curveData.type === "akima") {
    const n = curveData.knots?.length ?? 0;
    return `Akima interpolator (${n} knots)`;
  }
  if (curveData.type === "poly" && Array.isArray(curveData.coefficients)) {
    return `y = ${formatPolynomial(curveData.coefficients)}`;
  }
  return "Invalid curve data";
};
