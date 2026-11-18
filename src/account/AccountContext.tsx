import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { api } from "../api/client.ts";
import { useSettingsStore } from "../settings/SettingsContext.tsx";
import type { Settings } from "../settings/settingsStore.ts";

// The signed-in user, if any. Sonora works without an account; signing in only
// keeps settings and practice statistics on the server.
type Account = {
  email: string | null;
  checked: boolean; // false until the first /api/me answer
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AccountContext = createContext<Account | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const store = useSettingsStore();
  const [email, setEmail] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const synced = useRef<string>(""); // the settings the server has, as JSON

  // After sign-in: the profile's settings win; a new profile gets the local ones.
  const syncSettings = useCallback(async () => {
    const { settings } = await api<{ settings: Settings | null }>("GET", "/settings");
    if (settings) {
      synced.current = JSON.stringify(settings);
      store.update(settings); // also keeps them locally for the next visit
    } else {
      const saved = await api<{ settings: Settings }>("PUT", "/settings", { settings: store.get() });
      synced.current = JSON.stringify(saved.settings);
    }
  }, [store]);

  const signedIn = useCallback(
    async (address: string) => {
      setEmail(address);
      await syncSettings().catch(() => undefined); // settings stay local if this fails
    },
    [syncSettings],
  );

  useEffect(() => {
    api<{ email: string | null }>("GET", "/me")
      .then(({ email: address }) => (address ? signedIn(address) : undefined))
      .catch(() => undefined)
      .finally(() => setChecked(true));
  }, [signedIn]);

  // While signed in, every change of a setting goes to the profile too.
  useEffect(() => {
    if (!email) return;
    return store.subscribe(() => {
      const json = JSON.stringify(store.get());
      if (json === synced.current) return;
      synced.current = json;
      void api("PUT", "/settings", { settings: store.get() }).catch(() => (synced.current = ""));
    });
  }, [email, store]);

  const value: Account = {
    email,
    checked,
    login: async (address, password) => {
      const res = await api<{ email: string }>("POST", "/auth/login", { email: address, password });
      await signedIn(res.email);
    },
    register: async (address, password) => {
      const res = await api<{ email: string }>("POST", "/auth/register", { email: address, password });
      await signedIn(res.email);
    },
    logout: async () => {
      await api("POST", "/auth/logout", {}).catch(() => undefined);
      synced.current = "";
      setEmail(null);
    },
  };
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount(): Account {
  const account = useContext(AccountContext);
  if (!account) throw new Error("useAccount() needs an <AccountProvider> above it.");
  return account;
}
