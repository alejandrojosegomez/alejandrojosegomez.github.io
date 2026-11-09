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
    <div className="flex-1 min-h-screen bg-slate-50 text-slate-800">
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
          <p className="max-w-sm text-sm text-slate-500">
            The admin panel is not set up yet. Add <code className="text-slate-800">ADMIN_PASSWORD</code> and{" "}
            <code className="text-slate-800">ADMIN_SESSION_SECRET</code> in Vercel → Settings → Environment Variables.
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

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

type Connection = {
  name: string;
  detail: string;
  status: "up" | "down" | "warn";
  label: string;
  ms: number | null;
  icon: keyof typeof ICONS;
};

async function Dashboard({ days }: { days: number }) {
  const now = new Date();
  const [visitors, updates, health] = await Promise.all([getVisitors(days, now), getUpdates(days, now), getHealth()]);

  const find = (n: string) => health.find((h) => h.name === n);
  const connections: Connection[] = [
    fromPing(find("Homepage"), "Website", "alejandrogomez.me", "globe"),
    fromPing(find("CV (PDF)"), "CV download", "/CV_Alejandro_Gomez.pdf", "file"),
    fromConfig(find("Contact form → Drive"), "Contact form", "Google Drive + email", "mail"),
    {
      name: "Vercel",
      detail: "Deployments API",
      status: updates.ok ? "up" : "down",
      label: updates.ok ? "Connected" : "Error",
      ms: null,
      icon: "bolt",
    },
    {
      name: "Analytics",
      detail: "Vercel Web Analytics",
      status: visitors.ok ? "up" : "warn",
      label: visitors.ok ? "Collecting" : "Not available",
      ms: null,
      icon: "chart",
    },
  ];
  const down = connections.filter((c) => c.status === "down").length;
  const warn = connections.filter((c) => c.status === "warn").length;
  const overall = down ? "down" : warn ? "warn" : "up";

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-slate-500">
            {now.toLocaleString("en-US", { timeZone: "America/New_York", weekday: "long", month: "long", day: "numeric" })}
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-0.5">Welcome back, Alejandro</h1>
          <div className="mt-2">
            <StatusPill status={overall}>
              {overall === "up" ? "All systems operational" : overall === "warn" ? "Partially operational" : "Something is down"}
            </StatusPill>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <nav className="flex bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
            {RANGES.map((r) => (
              <Link
                key={r}
                href={`/admin?range=${r}`}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  r === days ? "bg-[#3443c7] text-white shadow-sm" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {r} days
              </Link>
            ))}
          </nav>
          <RefreshButton />
          <Link href="/" className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition">
            View site
          </Link>
          <form action={logout}>
            <button type="submit" className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-red-600 hover:bg-red-50 shadow-sm transition cursor-pointer">
              Log out
            </button>
          </form>
        </div>
      </header>

      {/* KPIs */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi
          icon="users"
          tint="blue"
          label="Visitors"
          value={visitors.ok ? visitors.data.total : "—"}
          hint={visitors.ok ? `${visitors.data.today} today` : "No data yet"}
          spark={visitors.ok ? visitors.data.perDay.map((b) => b.value) : undefined}
        />
        <Kpi
          icon="rocket"
          tint="violet"
          label="Updates"
          value={updates.ok ? updates.data.total : "—"}
          hint={updates.ok ? `${updates.data.production} went live` : "Unavailable"}
          spark={updates.ok ? updates.data.perDay.map((d) => d.production + d.preview) : undefined}
        />
        <Kpi
          icon="clock"
          tint="amber"
          label="Avg. build time"
          value={updates.ok ? `${updates.data.avgBuildSeconds}s` : "—"}
          hint={updates.ok ? (updates.data.failed ? `${updates.data.failed} failed` : "No failed builds") : "Unavailable"}
        />
        <Kpi
          icon="bolt"
          tint={connections[0].status === "up" ? "emerald" : "red"}
          label="Response time"
          value={connections[0].ms !== null ? `${connections[0].ms} ms` : "Down"}
          hint={speedLabel(connections[0].ms)}
        />
      </section>

      {/* Connections + update status bars */}
      <section className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-2" title="Connections" subtitle="Checked live every minute">
          <ul className="divide-y divide-slate-100">
            {connections.map((c) => (
              <li key={c.name} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <IconBox icon={c.icon} status={c.status} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-900">{c.name}</div>
                    <div className="text-xs text-slate-500 truncate">{c.detail}</div>
                  </div>
                  <StatusPill status={c.status} small>
                    {c.label}
                  </StatusPill>
                </div>
                {c.ms !== null && (
                  <div className="mt-2 ml-11 flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className={`h-full rounded-full ${speedColor(c.ms)}`} style={{ width: `${Math.max(4, Math.min(100, (c.ms / 1500) * 100))}%` }} />
                    </div>
                    <span className="text-[11px] text-slate-500 w-14 text-right">{c.ms} ms</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="lg:col-span-3" title="Update status" subtitle={`Every change pushed to the site · last ${days} days`}>
          {updates.ok ? <UpdateStatus u={updates.data} /> : <Unavailable r={updates} kind="vercel" />}
        </Card>
      </section>

      {/* Visitors */}
      <Card title="Visitors" subtitle={`Page views per day · last ${days} days`}>
        {visitors.ok ? <VisitorsView v={visitors.data} /> : <Unavailable r={visitors} kind="analytics" />}
      </Card>

      {/* Latest updates + Claude */}
      <section className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-3" title="Latest updates" subtitle="Newest first · build time on the right">
          {updates.ok ? <LatestUpdates u={updates.data} /> : <Unavailable r={updates} kind="vercel" />}
        </Card>
        <Card className="lg:col-span-2" title="Claude usage" subtitle="Tokens spent on updates">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 shrink-0 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
              <Icon name="spark" className="w-5 h-5" />
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Claude&apos;s token usage can&apos;t be read by websites. Your 5-hour session and weekly limits are in Claude settings.
            </p>
          </div>
          <a
            href="https://claude.ai/settings/usage"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition"
          >
            Open Settings → Usage ↗
          </a>
        </Card>
      </section>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */

function UpdateStatus({ u }: { u: Updates }) {
  const active = u.perDay.filter((d) => d.production + d.preview > 0);
  const ok = active.filter((d) => d.failed === 0).length;
  const pct = active.length ? Math.round((ok / active.length) * 100) : 100;
  return (
    <div>
      <div className="flex items-end justify-between mb-3">
        <div>
          <div className="text-3xl font-extrabold text-slate-900">{pct}%</div>
          <div className="text-xs text-slate-500">of update days with no failed builds</div>
        </div>
        <div className="text-right text-xs text-slate-500">
          <div><b className="text-slate-900">{u.total}</b> updates</div>
          <div><b className="text-slate-900">{u.production}</b> went live</div>
        </div>
      </div>

      <div className="flex gap-[3px] h-10">
        {u.perDay.map((d) => {
          const total = d.production + d.preview;
          const color =
            total === 0 ? "bg-slate-200" : d.failed === 0 ? "bg-emerald-500" : d.failed < total ? "bg-amber-400" : "bg-red-500";
          return (
            <div
              key={d.label}
              title={`${shortDate(d.label)}: ${total} update${total === 1 ? "" : "s"}${d.failed ? `, ${d.failed} failed` : ""}`}
              className={`flex-1 rounded-[3px] ${color} hover:opacity-75 transition`}
            />
          );
        })}
      </div>
      <div className="flex justify-between mt-1.5 text-[10px] text-slate-400">
        <span>{shortDate(u.perDay[0]?.label ?? "")}</span>
        <span>Today</span>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-4 text-[11px] text-slate-500">
        <Legend color="bg-emerald-500">All builds OK</Legend>
        <Legend color="bg-amber-400">Some failed</Legend>
        <Legend color="bg-red-500">Failed</Legend>
        <Legend color="bg-slate-200">No updates</Legend>
      </div>

      {u.lastProduction && (
        <div className="mt-5 p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
          <div className="min-w-0 text-xs">
            <div className="text-slate-500">Live version</div>
            <div className="font-semibold text-slate-900 truncate">{u.lastProduction.title}</div>
          </div>
          <span className="ml-auto text-[11px] text-slate-400 whitespace-nowrap">{timeAgo(u.lastProduction.created)}</span>
        </div>
      )}
    </div>
  );
}

function VisitorsView({ v }: { v: Visitors }) {
  const max = Math.max(1, ...v.perDay.map((b) => b.value));
  const step = Math.max(1, Math.ceil(v.perDay.length / 6));
  return (
    <div className="space-y-6">
      {v.total === 0 ? (
        <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-800">
          No visits counted yet. Tracking starts once this version is live on alejandrogomez.me.
        </div>
      ) : null}
      <div>
        <div className="flex items-end gap-[3px] h-40">
          {v.perDay.map((b) => (
            <div key={b.label} className="flex-1 h-full flex flex-col justify-end" title={`${shortDate(b.label)}: ${b.value} views`}>
              <div
                className={`rounded-t-md transition ${b.value ? "bg-gradient-to-t from-[#3443c7] to-blue-400 hover:opacity-80" : "bg-slate-100"}`}
                style={{ height: b.value ? `${Math.max(4, (b.value / max) * 100)}%` : "3px" }}
              />
            </div>
          ))}
        </div>
        <div className="flex gap-[3px] mt-1.5">
          {v.perDay.map((b, i) => (
            <div key={b.label} className="flex-1 text-[10px] text-slate-400 text-center whitespace-nowrap">
              {i % step === 0 || i === v.perDay.length - 1 ? shortDate(b.label) : ""}
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <HBars title="Top pages" bars={v.pages} color="bg-[#3443c7]" />
        <HBars title="Countries" bars={v.countries} color="bg-emerald-500" />
        <HBars title="Devices" bars={v.devices} color="bg-violet-500" />
        <HBars title="Came from" bars={v.referrers} color="bg-amber-500" />
      </div>
    </div>
  );
}

function LatestUpdates({ u }: { u: Updates }) {
  const recent = u.recent.slice(0, 6);
  const maxBuild = Math.max(1, ...recent.map((r) => r.buildSeconds ?? 0));
  if (recent.length === 0) return <p className="text-sm text-slate-500">No updates in this period.</p>;
  return (
    <ul className="space-y-3">
      {recent.map((r) => (
        <li key={r.id} className="flex items-center gap-3">
          <StateBadge state={r.state} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {r.inspectorUrl ? (
                <a href={r.inspectorUrl} target="_blank" rel="noopener noreferrer" className="truncate text-sm font-medium text-slate-900 hover:text-[#3443c7]">
                  {r.title}
                </a>
              ) : (
                <span className="truncate text-sm font-medium text-slate-900">{r.title}</span>
              )}
              {r.production && <span className="shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-violet-100 text-violet-700">LIVE</span>}
            </div>
            <div className="mt-1 flex items-center gap-2">
              <div className="flex-1 h-1 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full bg-violet-400" style={{ width: `${((r.buildSeconds ?? 0) / maxBuild) * 100}%` }} />
              </div>
              <span className="text-[11px] text-slate-400 w-24 text-right whitespace-nowrap">
                {r.buildSeconds !== null ? `${r.buildSeconds}s · ` : ""}
                {timeAgo(r.created)}
              </span>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Building blocks                                                     */
/* ------------------------------------------------------------------ */

function Card({ title, subtitle, children, className = "" }: { title: string; subtitle: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.08)] p-5 sm:p-6 ${className}`}>
      <div className="mb-5">
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

const TINTS = {
  blue: "bg-blue-50 text-[#3443c7]",
  violet: "bg-violet-50 text-violet-600",
  amber: "bg-amber-50 text-amber-600",
  emerald: "bg-emerald-50 text-emerald-600",
  red: "bg-red-50 text-red-600",
} as const;

const SPARK = {
  blue: "bg-[#3443c7]/70",
  violet: "bg-violet-400",
  amber: "bg-amber-400",
  emerald: "bg-emerald-400",
  red: "bg-red-400",
} as const;

function Kpi({
  icon,
  tint,
  label,
  value,
  hint,
  spark,
}: {
  icon: keyof typeof ICONS;
  tint: keyof typeof TINTS;
  label: string;
  value: number | string;
  hint: string;
  spark?: number[];
}) {
  const max = spark ? Math.max(1, ...spark) : 1;
  return (
    <div className="rounded-2xl bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-4 sm:p-5">
      <div className="flex items-center gap-2.5">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${TINTS[tint]}`}>
          <Icon name={icon} className="w-4 h-4" />
        </div>
        <span className="text-xs font-semibold text-slate-500">{label}</span>
      </div>
      <div className="mt-3 text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
        {typeof value === "number" ? value.toLocaleString("en-US") : value}
      </div>
      <div className="flex items-end justify-between gap-2 mt-1">
        <span className="text-[11px] text-slate-500 truncate">{hint}</span>
        {spark && spark.some((n) => n > 0) && (
          <div className="flex items-end gap-px h-6 w-20 shrink-0">
            {spark.slice(-14).map((n, i) => (
              <div key={i} className={`flex-1 rounded-sm ${n ? SPARK[tint] : "bg-slate-100"}`} style={{ height: `${n ? Math.max(15, (n / max) * 100) : 12}%` }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status, small, children }: { status: "up" | "down" | "warn"; small?: boolean; children: React.ReactNode }) {
  const styles = {
    up: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warn: "bg-amber-50 text-amber-700 border-amber-200",
    down: "bg-red-50 text-red-700 border-red-200",
  }[status];
  const dot = { up: "bg-emerald-500", warn: "bg-amber-500", down: "bg-red-500" }[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-semibold whitespace-nowrap ${styles} ${small ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-xs"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot} ${status === "up" ? "animate-pulse" : ""}`} />
      {children}
    </span>
  );
}

function IconBox({ icon, status }: { icon: keyof typeof ICONS; status: Connection["status"] }) {
  const tone = status === "up" ? "bg-slate-50 text-slate-600" : status === "warn" ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600";
  return (
    <div className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center ${tone}`}>
      <Icon name={icon} className="w-4 h-4" />
    </div>
  );
}

function StateBadge({ state }: { state: string }) {
  const map: Record<string, string> = {
    READY: "bg-emerald-50 text-emerald-600",
    ERROR: "bg-red-50 text-red-600",
    CANCELED: "bg-slate-100 text-slate-500",
  };
  const cls = map[state] ?? "bg-amber-50 text-amber-600";
  const icon = state === "READY" ? "check" : state === "ERROR" ? "x" : "clock";
  return (
    <div className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center ${cls}`} title={state}>
      <Icon name={icon} className="w-3.5 h-3.5" />
    </div>
  );
}

function HBars({ title, bars, color }: { title: string; bars: Bar[]; color: string }) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <div>
      <h4 className="text-xs font-bold text-slate-500 mb-3">{title}</h4>
      {bars.length === 0 ? (
        <p className="text-xs text-slate-400">No data yet</p>
      ) : (
        <ul className="space-y-2.5">
          {bars.map((b) => (
            <li key={b.label}>
              <div className="flex justify-between text-xs mb-1">
                <span className="truncate text-slate-700 pr-2">{b.label}</span>
                <span className="font-semibold text-slate-900">{b.value.toLocaleString("en-US")}</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full ${color} rounded-full`} style={{ width: `${(b.value / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Legend({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-2.5 h-2.5 rounded-sm ${color}`} />
      {children}
    </span>
  );
}

function Unavailable({ r, kind }: { r: Result<unknown>; kind: "analytics" | "vercel" }) {
  const error = r.ok ? "" : r.error;
  const notEnabled = /web_analytics_not_enabled/i.test(error);
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
      {notEnabled ? (
        <>Web Analytics is not enabled yet. Turn it on in Vercel → your project → <b className="text-slate-900">Analytics</b> → Enable.</>
      ) : /VERCEL_API_TOKEN/.test(error) ? (
        <>Add a <b className="text-slate-900">VERCEL_API_TOKEN</b> in Vercel → Settings → Environment Variables to see {kind === "analytics" ? "visitors" : "updates"}.</>
      ) : (
        <>Couldn&apos;t load {kind === "analytics" ? "visitor data" : "deployments"}: <code className="text-slate-900">{error}</code></>
      )}
    </div>
  );
}

function Loading() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-6 animate-pulse">
      <div className="h-10 w-72 bg-slate-200 rounded-lg" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-28 bg-white rounded-2xl border border-slate-200" />)}
      </div>
      <div className="h-72 bg-white rounded-2xl border border-slate-200" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */

const ICONS = {
  globe: "M12 21a9 9 0 100-18 9 9 0 000 18zm0 0c2.5-2.5 3.5-5.5 3.5-9S14.5 5.5 12 3m0 18c-2.5-2.5-3.5-5.5-3.5-9S9.5 5.5 12 3M3.5 9h17M3.5 15h17",
  file: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  mail: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
  bolt: "M13 10V3L4 14h7v7l9-11h-7z",
  chart: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  users: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
  rocket: "M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.63 8.41m5.96 5.96a14.93 14.93 0 01-5.84 2.58m0 0a6 6 0 01-7.38-5.84h4.8m2.58-5.84a14.93 14.93 0 00-2.58 5.84",
  clock: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  check: "M5 13l4 4L19 7",
  x: "M6 18L18 6M6 6l12 12",
  spark: "M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z",
} as const;

function Icon({ name, className }: { name: keyof typeof ICONS; className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={ICONS[name]} />
    </svg>
  );
}

/* ------------------------------------------------------------------ */

function fromPing(c: Check | undefined, name: string, detail: string, icon: Connection["icon"]): Connection {
  if (!c) return { name, detail, status: "warn", label: "Unknown", ms: null, icon };
  return { name, detail, status: c.ok ? "up" : "down", label: c.ok ? "Online" : "Down", ms: c.ms, icon };
}

function fromConfig(c: Check | undefined, name: string, detail: string, icon: Connection["icon"]): Connection {
  const ok = Boolean(c?.ok);
  return { name, detail, status: ok ? "up" : "warn", label: ok ? "Connected" : "Not set up", ms: null, icon };
}

function speedColor(ms: number): string {
  return ms < 500 ? "bg-emerald-500" : ms < 1200 ? "bg-amber-400" : "bg-red-500";
}

function speedLabel(ms: number | null): string {
  if (ms === null) return "Not responding";
  return ms < 500 ? "Fast" : ms < 1200 ? "OK" : "Slow";
}

function shortDate(iso: string): string {
  if (!iso) return "";
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
