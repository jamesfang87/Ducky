"use client";

import { useCallback, useEffect, useState } from "react";

interface Turn { student: string; outcome: string; reply: string; ms: number; tokens: number }
interface Persona { id: string; name: string; tries: string; passed: boolean; checks: { label: string; pass: boolean }[]; turns: Turn[] }
interface Report { ranAt: number; passed: number; total: number; personas: Persona[] }
interface Monitor { turns: number; blocked: number; errors: number; p50Ms: number; p95Ms: number; promptTokens: number; replyTokens: number }
interface Tool { id: string; name: string; provider: string; usedFor: string; needs: string[]; gatedBy?: string; connected: boolean }
interface Payload { blueprint: { hash: string } & Record<string, unknown>; monitor: Monitor; report: Report | null; tools?: Tool[] }

export default function AgentCi() {
  const [data, setData] = useState<Payload | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  const call = useCallback(async (method: "GET" | "POST") => {
    setError("");
    if (method === "POST") setRunning(true);
    try {
      const r = await fetch("/api/teacher/agent-ci", { method, cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Request failed.");
      setData(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setRunning(false);
    }
  }, []);

  useEffect(() => {
    void call("GET");
  }, [call]);

  const download = () => {
    if (!data) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(data.blueprint, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "ducky-agent-blueprint.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const m = data?.monitor;
  const report = data?.report;

  return (
    <>
      <div>
        <h1 className="font-display text-2xl font-semibold">Agent CI</h1>
        <p className="mt-1 max-w-[62ch] text-sm text-sub">
          Before students use a tutor, three simulated students try to break it. Run this after changing a policy and keep the receipt.
        </p>
      </div>
      {error && <p className="text-sm text-warn">{error}</p>}

      <section className="card flex flex-col gap-3 p-5" aria-label="Run">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn-primary h-10 px-4 text-sm" onClick={() => void call("POST")} disabled={running}>
            {running ? "Running three students…" : "Run Agent CI"}
          </button>
          {report && (
            <span className={`chip ${report.passed === report.total ? "" : "text-warn"}`}>
              {report.passed} of {report.total} passed · {new Date(report.ranAt).toLocaleTimeString()}
            </span>
          )}
        </div>
        {report?.personas.map((p) => (
          <div key={p.id} className="rounded-[10px] border border-line p-4">
            <div className="flex flex-wrap items-baseline gap-2">
              <h3 className="font-semibold">{p.name}</h3>
              <span className={`text-sm font-semibold ${p.passed ? "text-accent-dark" : "text-warn"}`}>{p.passed ? "Pass" : "Fail"}</span>
              <span className="text-sm text-muted">{p.tries}</span>
            </div>
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              {p.checks.map((c) => (
                <li key={c.label}>
                  <span className={c.pass ? "text-accent-dark" : "text-warn"}>{c.pass ? "✓" : "✗"}</span> {c.label}
                </li>
              ))}
            </ul>
            <details className="mt-2 text-sm">
              <summary className="cursor-pointer text-sub">Transcript</summary>
              <ul className="mt-2 flex flex-col gap-2">
                {p.turns.map((t, i) => (
                  <li key={i}>
                    <p><span className="font-semibold">Student:</span> {t.student}</p>
                    <p>
                      <span className="font-semibold">Ducky:</span> {t.reply}{" "}
                      <span className="text-muted">({t.outcome === "blocked_by_guard" ? "stopped by the input guard" : `${t.ms} ms, ~${t.tokens} tokens`})</span>
                    </p>
                  </li>
                ))}
              </ul>
            </details>
          </div>
        ))}
      </section>

      <section className="card flex flex-col gap-3 p-5" aria-label="Monitoring">
        <h2 className="font-semibold">Live monitoring</h2>
        {m && m.turns > 0 ? (
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            {[
              ["Turns", m.turns],
              ["Median latency", `${m.p50Ms} ms`],
              ["Slowest 5%", `${m.p95Ms} ms`],
              ["Held by guard", m.blocked],
              ["Prompt tokens", m.promptTokens.toLocaleString()],
              ["Reply tokens", m.replyTokens.toLocaleString()],
              ["Errors", m.errors],
            ].map(([k, v]) => (
              <div key={String(k)}>
                <dt className="text-muted">{k}</dt>
                <dd className="font-display text-lg font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-sub">Nothing yet. Numbers appear as students talk to Ducky, and when you run CI.</p>
        )}
      </section>

      {data?.tools && (
        <section className="card flex flex-col gap-3 p-5" aria-label="Connected tools">
          <h2 className="font-semibold">Connected tools</h2>
          <p className="text-sm text-sub">Set up once for the whole deployment. Every agent reuses these; a policy only switches them on or off.</p>
          <ul className="divide-y divide-line">
            {data.tools.map((t) => (
              <li key={t.id} className="flex flex-wrap items-start gap-3 py-2.5 text-sm">
                <span className={`mt-1.5 h-2 w-2 flex-none rounded-full ${t.connected ? "bg-accent" : "bg-warn"}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {t.name} <span className="font-normal text-muted">· {t.provider}</span>
                  </p>
                  <p className="text-sub">{t.usedFor}</p>
                  {t.gatedBy && <p className="text-[12px] text-muted">Teachers can turn this off per assignment ({t.gatedBy}).</p>}
                </div>
                <span className={`text-[13px] font-semibold ${t.connected ? "text-accent-dark" : "text-warn"}`}>
                  {t.connected ? "Connected" : `Missing ${t.needs.filter(Boolean).join(", ")}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card flex flex-col gap-2 p-5" aria-label="Blueprint">
        <h2 className="font-semibold">Agent blueprint</h2>
        <p className="text-sm text-sub">
          The tutor's policy, guards and evals as one file you can version and share. Fingerprint {data ? data.blueprint.hash.slice(0, 12) : "…"}.
        </p>
        <div>
          <button type="button" className="btn h-9 px-3 text-sm" onClick={download} disabled={!data}>
            Download blueprint (JSON)
          </button>
        </div>
      </section>
    </>
  );
}
