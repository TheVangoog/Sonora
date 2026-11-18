// User settings shared by all pages. They live above the router, so switching
// between Tuner, Notes and Chords keeps them, and a SettingsPersistence keeps
// them between visits (localStorage now; the user profile on the server later).

export type Settings = {
  instrument: "chromatic" | "guitar"; // tuner type
  referenceHz: number; // A4
  chordEngine: "dsp" | "ai";
  chordVocabulary: "basic" | "extended";
  analysisPath: "analyser" | "worklet"; // how the tuner gets its frames
};

export const REFERENCE_CHOICES = [432, 440, 442];

export const DEFAULT_SETTINGS: Settings = {
  instrument: "chromatic",
  referenceHz: 440,
  chordEngine: "dsp",
  chordVocabulary: "extended",
  analysisPath: "analyser",
};

/** Keeps every valid field of `raw` and uses the default for the rest. */
export function parseSettings(raw: unknown): Settings {
  const value = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const pick = <T>(key: keyof Settings, allowed: readonly T[]): T =>
    allowed.includes(value[key] as T) ? (value[key] as T) : (DEFAULT_SETTINGS[key] as T);
  return {
    instrument: pick("instrument", ["chromatic", "guitar"] as const),
    referenceHz: pick("referenceHz", REFERENCE_CHOICES),
    chordEngine: pick("chordEngine", ["dsp", "ai"] as const),
    chordVocabulary: pick("chordVocabulary", ["basic", "extended"] as const),
    analysisPath: pick("analysisPath", ["analyser", "worklet"] as const),
  };
}

/** Where settings are kept between visits. The server profile will be another one. */
export type SettingsPersistence = {
  load(): unknown;
  save(settings: Settings): void;
};

export const memoryPersistence = (): SettingsPersistence => {
  let saved: unknown = null;
  return { load: () => saved, save: (settings) => void (saved = { ...settings }) };
};

// Private windows and blocked storage throw: then settings last only for the session.
export function localStoragePersistence(key = "sonora.settings.v1"): SettingsPersistence {
  return {
    load() {
      try {
        const text = globalThis.localStorage?.getItem(key);
        return text ? JSON.parse(text) : null;
      } catch {
        return null;
      }
    },
    save(settings) {
      try {
        globalThis.localStorage?.setItem(key, JSON.stringify(settings));
      } catch {
        // Not saved; the session still keeps them.
      }
    },
  };
}

export class SettingsStore {
  private settings: Settings;
  private listeners = new Set<() => void>();
  private readonly persistence: SettingsPersistence;

  constructor(persistence: SettingsPersistence = memoryPersistence()) {
    this.persistence = persistence;
    this.settings = parseSettings(persistence.load());
  }

  get = (): Settings => this.settings;

  update(patch: Partial<Settings>): void {
    this.replace({ ...this.settings, ...patch });
    this.persistence.save(this.settings);
  }

  /** Takes settings from elsewhere (e.g. the profile after sign-in) without saving them back. */
  replace(raw: unknown): void {
    this.settings = parseSettings(raw);
    this.listeners.forEach((listener) => listener());
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
}
