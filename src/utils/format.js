/** Display formatting helpers (Indian conventions, DD-MM-YYYY dates, kg weights). */

export const num = (value, decimals = 2) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

export const kg = (value, decimals = 2) => `${num(value, decimals)} kg`;

/** 12,345 kg → "12.3 t" style short form for dashboard tiles. */
export const kgShort = (value) => {
  const n = Number(value) || 0;
  if (Math.abs(n) >= 100000) return `${num(n / 1000, 1)} t`;
  if (Math.abs(n) >= 1000) return num(n, 0);
  return num(n, n % 1 === 0 ? 0 : 1);
};

export const pct = (value, decimals = 1) => `${num(value, decimals)}%`;

/** Accepts YYYY-MM-DD or DD-MM-YYYY and renders DD-MM-YYYY. */
export const date = (value) => {
  const d = parseDate(value);
  if (!d) return "—";
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}`;
};

export const dateTime = (value) => {
  const d = parseDate(value);
  if (!d) return "—";
  const p = (n) => String(n).padStart(2, "0");
  return `${date(d)} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

export function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const str = String(value).trim();

  const ddmmyyyy = str.match(/^(\d{2})[-/](\d{2})[-/](\d{4})/);
  if (ddmmyyyy) {
    const [, d, m, y] = ddmmyyyy;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }

  const parsed = new Date(str);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** For <input type="date"> values. */
export const toInputDate = (value) => {
  const d = parseDate(value) || new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export const today = () => toInputDate(new Date());

export const daysBetween = (a, b) => {
  const d1 = parseDate(a);
  const d2 = parseDate(b);
  if (!d1 || !d2) return null;
  return Math.round((d2 - d1) / 86400000);
};

/** Indian financial year label for a date, e.g. "2026-27". */
export const financialYear = (value) => {
  const d = parseDate(value) || new Date();
  const start = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
};

export const initials = (name = "") =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || "?";
