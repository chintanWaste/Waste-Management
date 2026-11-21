import { useEffect, useRef, useState } from "react";
import { isCompletePin, lookupPincode, matchState } from "../services/pincodeService";

/**
 * Fills in the district and state as soon as a complete pin code is typed.
 *
 * A value the user has already typed is never overwritten — the lookup only
 * fills blanks, unless the user asks for it with `apply()`.
 */
export function usePincodeLookup({ pin, stateOptions, onResolve }) {
  const [status, setStatus] = useState("idle"); // idle | loading | found | missing | error
  const [result, setResult] = useState(null);
  const lastPin = useRef("");

  useEffect(() => {
    const code = String(pin || "").trim();

    if (!isCompletePin(code)) {
      setStatus("idle");
      setResult(null);
      lastPin.current = "";
      return undefined;
    }

    if (code === lastPin.current) return undefined;
    lastPin.current = code;

    const controller = new AbortController();
    let cancelled = false;

    // A short pause so a quick correction does not fire two lookups.
    const timer = setTimeout(async () => {
      setStatus("loading");
      try {
        const found = await lookupPincode(code, { signal: controller.signal });
        if (cancelled) return;

        if (!found) {
          setResult(null);
          setStatus("missing");
          return;
        }

        const payload = {
          district: found.district,
          state: matchState(found.state, stateOptions),
          rawState: found.state,
          offices: found.offices,
        };
        setResult(payload);
        setStatus("found");
        onResolve?.(payload);
      } catch (err) {
        if (cancelled || err.name === "AbortError") return;
        setResult(null);
        setStatus("error");
      }
    }, 350);

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
    // stateOptions is a fresh array each render, so it is deliberately not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  return { status, result };
}
