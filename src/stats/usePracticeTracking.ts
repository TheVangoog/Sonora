import { useEffect, useMemo, useRef } from "react";
import { api } from "../api/client.ts";
import { useAccount } from "../account/AccountContext.tsx";
import { PracticeTracker } from "./practiceTracker.ts";
import type { PracticePage } from "./practice.ts";

/**
 * While the microphone is on and the user is signed in, counts the practice on
 * this page and sends it when the microphone stops or the page is left.
 * Without an account nothing is counted or sent.
 */
export function usePracticeTracking(page: PracticePage, active: boolean, engine: "dsp" | "ai" | null = null) {
  const { email } = useAccount();
  const tracker = useRef<PracticeTracker | null>(null);
  const engineRef = useRef(engine);
  engineRef.current = engine;

  useEffect(() => {
    if (!active || !email) return;
    tracker.current = new PracticeTracker(page, Date.now());
    const send = () => {
      const session = tracker.current?.finish(Date.now(), engineRef.current);
      tracker.current = null;
      if (session) void api("POST", "/stats/sessions", session, { keepalive: true }).catch(() => undefined);
    };
    // Closing the tab does not unmount React, so listen for that too.
    window.addEventListener("pagehide", send);
    return () => {
      window.removeEventListener("pagehide", send);
      send();
    };
  }, [page, active, email]);

  return useMemo(
    () => ({
      hearNote: (name: string | null, cents: number) => tracker.current?.hearNote(name, cents, Date.now()),
      showChord: (name: string | null) => tracker.current?.showChord(name),
    }),
    [],
  );
}
