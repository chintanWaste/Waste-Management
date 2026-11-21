/**
 * Look up an Indian pin code to fill in the district and state.
 *
 * Uses India Post's public PIN API. Only the six-digit pin code is sent —
 * never a name, address or anything else from the form. The lookup is a
 * convenience: if it is unavailable the fields stay editable by hand, and
 * nothing in the form depends on it succeeding.
 */

const ENDPOINT = "https://api.postalpincode.in/pincode";

/** Results are cached for the session — the same pin is never fetched twice. */
const cache = new Map();

export function isCompletePin(value) {
  return /^\d{6}$/.test(String(value || "").trim());
}

/**
 * Returns { district, state, offices } or null when the pin is not found.
 * Throws only when the network itself fails, which the caller shows as a hint.
 */
export async function lookupPincode(pin, { signal } = {}) {
  const code = String(pin).trim();
  if (!isCompletePin(code)) return null;
  if (cache.has(code)) return cache.get(code);

  const response = await fetch(`${ENDPOINT}/${code}`, { signal });
  if (!response.ok) throw new Error(`Lookup failed (HTTP ${response.status})`);

  const payload = await response.json();
  const first = Array.isArray(payload) ? payload[0] : null;

  if (!first || first.Status !== "Success" || !first.PostOffice?.length) {
    cache.set(code, null);
    return null;
  }

  const offices = first.PostOffice;
  const result = {
    district: offices[0].District || "",
    state: offices[0].State || "",
    // Several localities can share a pin code; the first is the usual answer.
    offices: [...new Set(offices.map((o) => o.Name))],
  };

  cache.set(code, result);
  return result;
}

/**
 * Match the state India Post returns to the exact option in the Settings list,
 * so the dropdown ends up on a real value rather than a near-miss.
 */
export function matchState(stateName, options = []) {
  if (!stateName) return "";
  const wanted = stateName.trim().toLowerCase();

  const exact = options.find((o) => o.toLowerCase() === wanted);
  if (exact) return exact;

  // India Post says "Delhi" where a list may say "NCT of Delhi", and so on.
  const loose = options.find(
    (o) => o.toLowerCase().includes(wanted) || wanted.includes(o.toLowerCase())
  );
  return loose || "";
}
