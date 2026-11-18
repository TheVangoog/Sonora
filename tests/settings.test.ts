import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SETTINGS,
  localStoragePersistence,
  memoryPersistence,
  parseSettings,
  SettingsStore,
} from "../src/settings/settingsStore.ts";

// Supervisor's case (16. 11. 2026): Guitar + A4 = 432 Hz → Notes → Tuner gave
// Chromatic and 440 again, because the state lived inside the Tuner page.
test("settings survive leaving the page and coming back", () => {
  const persistence = memoryPersistence();
  const store = new SettingsStore(persistence);
  store.update({ instrument: "guitar", referenceHz: 432 });
  // The pages are unmounted and mounted again; the store above the router stays.
  assert.deepEqual(
    { instrument: store.get().instrument, referenceHz: store.get().referenceHz },
    { instrument: "guitar", referenceHz: 432 },
  );
  // A new visit (page reload) loads them from the persistence.
  const reloaded = new SettingsStore(persistence);
  assert.equal(reloaded.get().instrument, "guitar");
  assert.equal(reloaded.get().referenceHz, 432);
});

test("invalid or old saved values fall back field by field", () => {
  const parsed = parseSettings({ instrument: "banjo", referenceHz: 431, chordEngine: "ai", extra: 1 });
  assert.deepEqual(parsed, { ...DEFAULT_SETTINGS, chordEngine: "ai" });
  assert.deepEqual(parseSettings(null), DEFAULT_SETTINGS);
  assert.deepEqual(parseSettings("garbage"), DEFAULT_SETTINGS);
});

test("subscribers hear about changes; settings from the profile are not saved back", () => {
  let saves = 0;
  const store = new SettingsStore({ load: () => null, save: () => void saves++ });
  let heard = 0;
  const unsubscribe = store.subscribe(() => heard++);
  store.update({ chordVocabulary: "basic" });
  store.replace({ ...store.get(), analysisPath: "worklet" });
  unsubscribe();
  store.update({ chordEngine: "ai" });
  assert.equal(heard, 2);
  assert.equal(saves, 2);
  assert.equal(store.get().analysisPath, "worklet");
});

test("blocked localStorage does not break the app", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() {
      throw new Error("SecurityError");
    },
  });
  try {
    const store = new SettingsStore(localStoragePersistence());
    store.update({ instrument: "guitar" });
    assert.equal(store.get().instrument, "guitar", "still kept for this session");
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else delete (globalThis as Record<string, unknown>).localStorage;
  }
});

test("localStorage round trip", () => {
  const data = new Map<string, string>();
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v) },
  });
  try {
    new SettingsStore(localStoragePersistence()).update({ referenceHz: 442 });
    assert.equal(new SettingsStore(localStoragePersistence()).get().referenceHz, 442);
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else delete (globalThis as Record<string, unknown>).localStorage;
  }
});
