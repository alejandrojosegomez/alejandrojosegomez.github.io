import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { logout } from "./actions";
import { getHealth, getUpdates, getVisitors, type Bar, type Check, type Result, type Updates, type Visitors } from "./data";
import { LoginForm } from "./login-form";
import { RefreshButton } from "./refresh-button";
import { isAdmin, isConfigured } from "./session";

export const metadata: Metadata = {
  title: "Admin · alejandrogomez.me",
  robots: { index: false, follow: false, nocache: true },
};

const RANGES = [7, 30, 90] as const;

export default function AdminPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  return (
    <div className="flex-1 min-h-screen bg-slate-950 text-slate-200 [background-image:radial-gradient(ellipse_at_top,rgba(37,99,235,0.18),transparent_60%)]">
      <Suspense fallback={<Loading />}>
        <AdminGate searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function AdminGate({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  if (!(await isAdmin())) {
    if (!isConfigured()) {
      return (
        <div className="min-h-[70vh] flex items-center justify-center px-4 text-center">
          <p className="max-w-sm text-sm text-slate-400">
            The admin panel is not set up yet. Add <code className="text-slate-200">ADMIN_PASSWORD</code> and{" "}
            <code className="text-slate-200">ADMIN_SESSION_SECRET</code> in Vercel → Settings → Environment Variables.
          </p>
        </div>
      );
    }
    return <LoginForm />;
  }

  const { range } = await searchParams;
  const days = RANGES.includes(Number(range) as (typeof RANGES)[number]) ? Number(range) : 30;
  return <Dashboard days={days} />;
}

async function Dashboard({ days }: { days: number }) {
  const now = new Date();
  const [visitors, updates, health] = await Promise.all([getVisitors(days, now), getUpdates(days, now), getHealth()]);
  const allUp = health.every((c) => c.ok);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-bold tracking-widest uppercase text-blue-400">
            <span className={`w-2 h-2 rounded-full ${allUp ? "bg-emerald-400" : "bg-amber-400"} animate-pulse`} />
            {allUp ? "All systems operational" : "Attention needed"}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">Welcome back, Alejandro</h1>
          <p className="text-xs text-slate-400 mt-1">
            Private panel · updated {now.toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" })} ET
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <nav className="flex bg-slate-900 border border-slate-800 rounded-lg p-1">
            {RANGES.map((r) => (
              <Link
                key={r}
                href={`/admin?range=${r}`}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                  r === days ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                {r}d
              </Link>
            ))}
          </nav>
          <RefreshButton />
          <Link href="/" className="px-3 py-2 rounded-lg border border-slate-700 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition">
            View site
          </Link>
          <form action={logout}>
            <button type="submit" className="px-3 py-2 rounded-lg border border-red-500/40 text-xs font-semibold text-red-300 hover:bg-red-500/10 transition cursor-pointer">
              Log out
            </button>
          </form>
        </div>
      </header>

      {/* KPI row */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi label={`Page views (${days}d)`} value={visitors.ok ? visitors.data.total : "—"} hint={visitors.ok ? `${visitors.data.today} today` : "Analytics unavailable"} accent="blue" />
        <Kpi label={`Updates (${days}d)`} value={updates.ok ? updates.data.total : "—"} hint={updates.ok ? `${updates.data.production} went live` : "Vercel API unavailable"} accent="violet" />
        <Kpi label="Avg build time" value={updates.ok ? `${updates.data.avgBuildSeconds}s` : "—"} hint={updates.ok ? `${updates.data.failed} failed builds` : ""} accent="amber" />
        <Kpi
          label="Homepage response"
          value={health[0].ms !== null ? `${health[0].ms} ms` : "Down"}
          hint={health[0].detail}
          accent={health[0].ok ? "emerald" : "red"}
        />
      </section>

      {/* Visitors */}
      <Panel title="Visitors" subtitle="Vercel Web Analytics · page views per day">
        {visitors.ok ? <VisitorsView v={visitors.data} /> : <Unavailable r={visitors} kind="analytics" />}
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Updates */}
        <div className="lg:col-span-3">
          <Panel title="Update activity" subtitle="Every change pushed to the site (Vercel deployments)">
            {updates.ok ? <UpdatesView u={updates.data} /> : <Unavailable r={updates} kind="vercel" />}
          </Panel>
        </div>

        {/* Health + Claude */}
        <div className="lg:col-span-2 space-y-6">
          <Panel title="Server health" subtitle="Checked live on every refresh">
            <HealthView checks={health} last={updates.ok ? updates.data.lastProduction : null} />
          </Panel>
          <Panel title="Claude usage" subtitle="Tokens spent on updates">
            <p className="text-sm text-slate-400 leading-relaxed">
              Claude&apos;s token usage isn&apos;t available to websites. Your live session and weekly limits are in Claude.
            </p>
            <a
              href="https://claude.ai/settings/usage"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-orange-500/15 border border-orange-400/40 text-orange-200 text-xs font-semibold hover:bg-orange-500/25 transition"
            >
              Open Settings → Usage ↗
            </a>
          </Panel>
        </div>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */

function VisitorsView({ v }: { v: Visitors }) {
  return (
    <div className="space-y-6">
      <VBars bars={v.perDay} color="bg-blue-500" />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <HBars title="Top pages" bars={v.pages} color="bg-blue-500" />
        <HBars title="Countries" bars={v.countries} color="bg-emerald-500" />
        <HBars title="Devices" bars={v.devices} color="bg-violet-500" />
        <HBars title="Came from" bars={v.referrers} color="bg-amber-500" />
      </div>
    </div>
  );
}

function UpdatesView({ u }: { u: Updates }) {
  const max = Math.max(1, ...u.perDay.map((d) => d.production + d.preview));
  const maxBuild = Math.max(1, ...u.recent.map((r) => r.buildSeconds ?? 0));
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-end gap-[3px] h-32">
          {u.perDay.map((d) => (
            <div key={d.label} className="flex-1 h-full flex flex-col justify-end group relative" title={`${d.label}: ${d.production} live, ${d.preview} preview`}>
              <div className="bg-slate-500/70 rounded-t-sm" style={{ height: `${(d.preview / max) * 100}%` }} />
              <div className="bg-violet-500" style={{ height: `${(d.production / max) * 100}%` }} />
              {d.production + d.preview === 0 && <div className="h-[2px] bg-slate-800 rounded" />}
            </div>
          ))}
        </div>
        <AxisLabels labels={u.perDay.map((d) => d.label)} />
        <div className="flex gap-4 mt-2 text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-violet-500" /> Went live</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-slate-500/70" /> Preview</span>
        </div>
      </div>

      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Latest updates · build time</h4>
        <ul className="space-y-2.5">
          {u.recent.length === 0 && <li className="text-sm text-slate-500">No updates in this period.</li>}
          {u.recent.map((r) => (
            <li key={r.id} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 items-center">
              <div className="min-w-0 flex items-center gap-2">
                <StateDot state={r.state} />
                {r.inspectorUrl ? (
                  <a href={r.inspectorUrl} target="_blank" rel="noopener noreferrer" className="truncate text-sm text-slate-200 hover:text-white hover:underline">
                    {r.title}
                  </a>
                ) : (
                  <span className="truncate text-sm text-slate-200">{r.title}</span>
                )}
                {r.production && <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-500/20 text-violet-300">LIVE</span>}
              </div>
              <span className="text-[11px] text-slate-500 text-right whitespace-nowrap">{timeAgo(r.created)}</span>
              <div className="col-span-2 flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-violet-400/80 rounded-full" style={{ width: `${((r.buildSeconds ?? 0) / maxBuild) * 100}%` }} />
                </div>
                <span className="text-[11px] text-slate-500 w-10 text-right">{r.buildSeconds !== null ? `${r.buildSeconds}s` : "—"}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function HealthView({ checks, last }: { checks: Check[]; last: Updates["lastProduction"] }) {
  return (
    <div className="space-y-4">
      {checks.map((c) => {
        const pct = c.ms === null ? (c.ok ? 100 : 0) : Math.min(100, (c.ms / 2000) * 100);
        const color = !c.ok ? "bg-red-500" : c.ms === null ? "bg-emerald-500" : c.ms < 500 ? "bg-emerald-500" : c.ms < 1500 ? "bg-amber-500" : "bg-red-500";
        return (
          <div key={c.name}>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-slate-200">
                <span className={`w-2 h-2 rounded-full ${c.ok ? "bg-emerald-400" : "bg-red-400"}`} />
                {c.name}
              </span>
              <span className={`text-xs ${c.ok ? "text-slate-400" : "text-red-300"}`}>{c.ms !== null ? `${c.ms} ms · ${c.detail}` : c.detail}</span>
            </div>
            <div className="mt-1.5 h-2 bg-slate-800 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(pct, c.ok ? 4 : 0)}%` }} />
            </div>
          </div>
        );
      })}
      <div className="pt-3 border-t border-slate-800 text-xs text-slate-400">
        {last ? (
          <>
            Live version: <span className="text-slate-200">{last.title}</span>
            <br />
            deployed {timeAgo(last.created)}
          </>
        ) : (
          "Live version info unavailable."
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Building blocks                                                     */
/* ------------------------------------------------------------------ */

const ACCENTS = {
  blue: "from-blue-500/20 border-blue-500/30 text-blue-300",
  violet: "from-violet-500/20 border-violet-500/30 text-violet-300",
  amber: "from-amber-500/20 border-amber-500/30 text-amber-300",
  emerald: "from-emerald-500/20 border-emerald-500/30 text-emerald-300",
  red: "from-red-500/20 border-red-500/30 text-red-300",
} as const;

function Kpi({ label, value, hint, accent }: { label: string; value: number | string; hint: string; accent: keyof typeof ACCENTS }) {
  return (
    <div className={`rounded-2xl border bg-gradient-to-br to-slate-900/60 p-4 sm:p-5 ${ACCENTS[accent]}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wider opacity-90">{label}</div>
      <div className="text-2xl sm:text-3xl font-extrabold text-white mt-1">{typeof value === "number" ? value.toLocaleString("en-US") : value}</div>
      <div className="text-[11px] text-slate-400 mt-1 truncate">{hint}</div>
    </div>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6 shadow-xl">
      <div className="mb-5">
        <h2 className="text-base font-bold text-white">{title}</h2>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function VBars({ bars, color }: { bars: Bar[]; color: string }) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <div>
      <div className="flex items-end gap-[3px] h-40">
        {bars.map((b) => (
          <div key={b.label} className="flex-1 h-full flex flex-col justify-end" title={`${b.label}: ${b.value} views`}>
            {b.value > 0 ? (
              <div className={`${color} rounded-t-sm hover:brightness-125 transition`} style={{ height: `${(b.value / max) * 100}%` }} />
            ) : (
              <div className="h-[2px] bg-slate-800 rounded" />
            )}
          </div>
        ))}
      </div>
      <AxisLabels labels={bars.map((b) => b.label)} />
    </div>
  );
}

function AxisLabels({ labels }: { labels: string[] }) {
  const step = Math.max(1, Math.ceil(labels.length / 6));
  return (
    <div className="flex gap-[3px] mt-1.5">
      {labels.map((l, i) => (
        <div key={l} className="flex-1 text-[10px] text-slate-500 text-center overflow-visible whitespace-nowrap">
          {i % step === 0 || i === labels.length - 1 ? shortDate(l) : ""}
        </div>
      ))}
    </div>
  );
}

function HBars({ title, bars, color }: { title: string; bars: Bar[]; color: string }) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <div>
      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">{title}</h4>
      {bars.length === 0 ? (
        <p className="text-xs text-slate-600">No data yet</p>
      ) : (
        <ul className="space-y-2">
          {bars.map((b) => (
            <li key={b.label}>
              <div className="flex justify-between text-xs mb-1">
                <span className="truncate text-slate-300 pr-2">{b.label}</span>
                <span className="text-slate-500">{b.value.toLocaleString("en-US")}</span>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div className={`h-full ${color} rounded-full`} style={{ width: `${(b.value / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StateDot({ state }: { state: string }) {
  const c = state === "READY" ? "bg-emerald-400" : state === "ERROR" ? "bg-red-400" : state === "CANCELED" ? "bg-slate-500" : "bg-amber-400 animate-pulse";
  return <span className={`shrink-0 w-2 h-2 rounded-full ${c}`} title={state} />;
}

function Unavailable({ r, kind }: { r: Result<unknown>; kind: "analytics" | "vercel" }) {
  const error = r.ok ? "" : r.error;
  const notEnabled = /web_analytics_not_enabled/i.test(error);
  return (
    <div className="rounded-xl border border-dashed border-slate-700 p-5 text-sm text-slate-400">
      {notEnabled ? (
        <>Web Analytics is not enabled yet. Turn it on in Vercel → your project → <b className="text-slate-200">Analytics</b> → Enable.</>
      ) : /VERCEL_API_TOKEN/.test(error) ? (
        <>Add a <b className="text-slate-200">VERCEL_API_TOKEN</b> in Vercel → Settings → Environment Variables to see {kind === "analytics" ? "visitors" : "updates"}.</>
      ) : (
        <>Couldn&apos;t load {kind === "analytics" ? "visitor data" : "deployments"}: <code className="text-slate-300">{error}</code></>
      )}
    </div>
  );
}

function Loading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-6 animate-pulse">
      <div className="h-10 w-72 bg-slate-800 rounded-lg" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 bg-slate-900 rounded-2xl border border-slate-800" />)}
      </div>
      <div className="h-72 bg-slate-900 rounded-2xl border border-slate-800" />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function shortDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function timeAgo(ms: number): string {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
