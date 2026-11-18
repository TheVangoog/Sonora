import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import PageHeading from "../components/PageHeading.jsx";
import AppIcon from "../components/AppIcon.jsx";
import { useAccount } from "../account/AccountContext.tsx";
import { api } from "../api/client.ts";
import type { PracticeSummary } from "../stats/practice.ts";

export default function AccountView() {
  const account = useAccount();
  return (
    <>
      <PageHeading
        eyebrow="YOUR PRACTICE"
        title={account.email ? "Your progress." : "Keep your progress."}
        description="Sonora works without an account. Sign in to keep your settings on every device and see your practice statistics. Sound never leaves your browser."
      />
      <section className="audio-workspace account-panel" aria-label="Account">
        {!account.checked ? (
          <p className="engine-note">Checking whether you are signed in…</p>
        ) : account.email ? (
          <SignedIn email={account.email} onLogout={account.logout} />
        ) : (
          <SignInForm />
        )}
      </section>
    </>
  );
}

function SignInForm() {
  const { login, register } = useAccount();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await (mode === "login" ? login : register)(email, password);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="account-form" onSubmit={submit}>
      <div className="instrument-switch" role="group" aria-label="Sign in or create an account">
        <button type="button" aria-pressed={mode === "login"} className={mode === "login" ? "selected" : undefined} onClick={() => setMode("login")}>
          Sign in
        </button>
        <button type="button" aria-pressed={mode === "register"} className={mode === "register" ? "selected" : undefined} onClick={() => setMode("register")}>
          Create account
        </button>
      </div>
      <label>
        Email
        <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label>
        Password {mode === "register" && <small>(at least 8 characters)</small>}
        <input
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
          minLength={mode === "register" ? 8 : undefined}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {error && (
        <p className="audio-error" role="alert">
          {error}
        </p>
      )}
      <button className="microphone-button" type="submit" disabled={busy}>
        <AppIcon name="user" size={18} />
        {busy ? "One moment…" : mode === "login" ? "Sign in" : "Create account"}
      </button>
    </form>
  );
}

function SignedIn({ email, onLogout }: { email: string; onLogout: () => Promise<void> }) {
  const [days, setDays] = useState(7);
  const [summary, setSummary] = useState<PracticeSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    api<PracticeSummary>("GET", `/stats/summary?days=${days}`)
      .then((s) => current && setSummary(s))
      .catch((reason) => current && setError(reason.message));
    return () => void (current = false);
  }, [days]);

  return (
    <div className="account-signed-in">
      <p>
        Signed in as <strong>{email}</strong>. Your settings are saved to your account.{" "}
        <button className="demo-button" onClick={() => void onLogout()}>
          Sign out
        </button>
      </p>
      <div className="instrument-switch" role="group" aria-label="Period">
        {[7, 30].map((d) => (
          <button key={d} aria-pressed={days === d} className={days === d ? "selected" : undefined} onClick={() => setDays(d)}>
            {d} days
          </button>
        ))}
      </div>
      {error && <p className="audio-error" role="alert">{error}</p>}
      {summary && <Summary summary={summary} />}
    </div>
  );
}

function Summary({ summary }: { summary: PracticeSummary }) {
  const total = summary.minutes.tuner + summary.minutes.notes + summary.minutes.chords;
  const busiest = Math.max(1, ...summary.minutesPerDay.map((d) => d.minutes));
  const pct = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)} %`);
  if (!summary.sessions) {
    return <p className="engine-note">No practice yet in the last {summary.days} days. Turn on the microphone on the Tuner, Notes or Chords page.</p>;
  }
  return (
    <>
      <dl className="signal-stats">
        <div><dt>Practice</dt><dd>{Math.round(total)} min</dd></div>
        <div><dt>Sessions</dt><dd>{summary.sessions}</dd></div>
        <div><dt>Notes in tune (±5 c)</dt><dd>{pct(summary.inTuneShare)}</dd></div>
        <div><dt>Mean distance</dt><dd>{summary.meanAbsCents === null ? "—" : `${summary.meanAbsCents} cents`}</dd></div>
        <div><dt>Chords</dt><dd>{summary.chordsShown.dsp} algorithm · {summary.chordsShown.ai} AI</dd></div>
      </dl>
      <p className="record-step">Minutes per day</p>
      <ol className="practice-days" aria-label="Minutes of practice per day">
        {summary.minutesPerDay.map((d) => (
          <li key={d.day} title={`${d.day}: ${d.minutes} min`}>
            <span className="practice-bar" style={{ height: `${(100 * d.minutes) / busiest}%` }} />
            <small>{summary.days <= 7 ? new Date(d.day).toLocaleDateString(undefined, { weekday: "short" }) : d.day.slice(8)}</small>
          </li>
        ))}
      </ol>
      <p className="engine-note">
        Tuner {Math.round(summary.minutes.tuner)} min · Notes {Math.round(summary.minutes.notes)} min · Chords {Math.round(summary.minutes.chords)} min. {summary.notesHeard} notes held.
      </p>
    </>
  );
}
