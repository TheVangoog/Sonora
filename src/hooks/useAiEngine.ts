import { useCallback, useEffect, useState } from "react";
import type { ChordEngine } from "../audio/engines/chordEngine.ts";
import { createBrowserBasicPitchEngine } from "../audio/engines/basicPitchBrowser.ts";

export type AiStatus = "off" | "preparing" | "ready" | "error";

// Module-level: the model loads and warms up only once per page.
let sharedEngine: ChordEngine | null = null;
function getAiEngine(): ChordEngine {
  return (sharedEngine ??= createBrowserBasicPitchEngine());
}

// `engine` is non-null only after the warm-up; until then, and after an error,
// the page uses the algorithm. fail() is called when an analysis throws; retry()
// prepares the model again.
export function useAiEngine(enabled: boolean) {
  const [status, setStatus] = useState<AiStatus>("off");
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setStatus("off");
      return;
    }
    let cancelled = false;
    setStatus("preparing");
    setError(null);
    getAiEngine()
      .prepare?.()
      .then(() => {
        if (!cancelled) setStatus("ready");
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setStatus("error");
        setError(`it could not start (${messageOf(reason)})`);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, attempt]);

  const fail = useCallback((reason: unknown) => {
    setStatus("error");
    setError(`the analysis failed (${messageOf(reason)})`);
  }, []);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return {
    status,
    error,
    fail,
    retry,
    engine: enabled && status === "ready" ? getAiEngine() : null,
  };
}

function messageOf(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}
