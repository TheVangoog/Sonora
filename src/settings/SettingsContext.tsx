import { createContext, useContext, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { localStoragePersistence, SettingsStore } from "./settingsStore.ts";
import type { Settings } from "./settingsStore.ts";

const SettingsContext = createContext<SettingsStore | null>(null);

export function SettingsProvider({
  children,
  store,
}: {
  children: ReactNode;
  store?: SettingsStore;
}) {
  const [own] = useState(() => store ?? new SettingsStore(localStoragePersistence()));
  return <SettingsContext.Provider value={own}>{children}</SettingsContext.Provider>;
}

export function useSettings(): [Settings, (patch: Partial<Settings>) => void] {
  const store = useContext(SettingsContext);
  if (!store) throw new Error("useSettings() needs a <SettingsProvider> above it.");
  const settings = useSyncExternalStore(store.subscribe, store.get);
  return [settings, (patch) => store.update(patch)];
}

/** The store itself, for code that syncs it (the account). */
export function useSettingsStore(): SettingsStore {
  const store = useContext(SettingsContext);
  if (!store) throw new Error("useSettingsStore() needs a <SettingsProvider> above it.");
  return store;
}
