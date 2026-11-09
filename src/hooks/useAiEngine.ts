import { useEffect, useState } from "react";
import type { ChordEngine } from "../audio/engines/chordEngine.ts";
import { createBrowserBasicPitchEngine } from "../audio/engines/basicPitchBrowser.ts";

export type AiStatus = "off" | "preparing" | "ready" | "error";

// Module-level: the model loads and warms up only once per page.
let sharedEngine: ChordEngine | null = null;
function getAiEngine(): ChordEngine {
  return (sharedEngine ??= createBrowserBasicPitchEngine());
}

// `engine` is non-null only after the warm-up; until then the page uses the algorithm.
export function useAiEngine(enabled: boolean) {
  const [status, setStatus] = useState<AiStatus>("off");
  const [error, setError] = useState<string | null>(null);

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
        setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return {
    status,
    error,
    engine: enabled && status === "ready" ? getAiEngine() : null,
  };
}
