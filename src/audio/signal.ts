export const FRAME_SIZE = 2048;

export function measureSignal(samples: Float32Array) {
  let sumSquares = 0;
  let peak = 0;
  for (const sample of samples) {
    sumSquares += sample * sample;
    peak = Math.max(peak, Math.abs(sample));
  }
  const rms = samples.length ? Math.sqrt(sumSquares / samples.length) : 0;
  // Digital level relative to amplitude 1, not acoustic dB SPL.
  return { rms, peak, dbfs: rms > 0 ? 20 * Math.log10(rms) : -Infinity };
}

export function audioErrorMessage(error: unknown): string {
  if (!(error instanceof Error))
    return "Could not start audio. Please try again.";
  const messages: Record<string, string> = {
    NotAllowedError:
      "Microphone access was not granted. Check the site permission or use the test signal.",
    NotFoundError:
      "No microphone found. Connect one or use the test signal.",
    NotReadableError:
      "The microphone is unavailable. Check the device and whether another app is using it.",
    OverconstrainedError: "The device does not support the requested audio settings.",
    SecurityError: "The browser blocked microphone access for this site.",
  };
  return messages[error.name] ?? error.message;
}
