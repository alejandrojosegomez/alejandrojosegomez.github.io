// Datos del panel /admin. Todo corre en el servidor: el token de Vercel nunca llega al navegador.
//
// Variables de entorno:
//   VERCEL_API_TOKEN   token de Vercel con acceso de lectura (Account Settings → Tokens)
//   VERCEL_PROJECT_ID  (opcional) id del proyecto
//   VERCEL_TEAM_ID     (opcional) id del equipo

const API = "https://api.vercel.com";
const PROJECT_ID = process.env.VERCEL_PROJECT_ID || "prj_jdPWMDqA7nTdGGf8QgiSEw1TZDMU";
const TEAM_ID = process.env.VERCEL_TEAM_ID || "team_mqZqcYRQt0cQ3VmpXxvCsMio";
const SITE_URL = "https://www.alejandrogomez.me";

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };
export type Bar = { label: string; value: number };

function token(): string | null {
  return process.env.VERCEL_API_TOKEN || null;
}

async function vercel<T>(path: string, params: Record<string, string | string[]>): Promise<Result<T>> {
  const t = token();
  if (!t) return { ok: false, error: "VERCEL_API_TOKEN is not set." };
  const qs = new URLSearchParams({ teamId: TEAM_ID });
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) v.forEach((x) => qs.append(k, x));
    else qs.set(k, v);
  }
  try {
    const res = await fetch(`${API}${path}?${qs}`, {
      headers: { Authorization: `Bearer ${t}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const code = body?.error?.code || body?.error?.message || `HTTP ${res.status}`;
      return { ok: false, error: String(code) };
    }
    return { ok: true, data: body as T };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Request failed" };
  }
}

/* ------------------------------------------------------------------ */
/* Visitors (Vercel Web Analytics)                                     */
/* ------------------------------------------------------------------ */

type AnalyticsRow = Record<string, unknown>;

// El número de visitas viene en un campo numérico; lo buscamos sin depender del nombre exacto.
const COUNT_KEYS = ["count", "total", "pageViews", "pageviews", "visits", "value", "views"];
function countOf(row: AnalyticsRow): number {
  for (const k of COUNT_KEYS) {
    const v = row[k];
    if (typeof v === "number") return v;
    if (typeof v === "string" && /^\d+(\.\d+)?$/.test(v)) return Number(v);
  }
  for (const v of Object.values(row)) if (typeof v === "number") return v;
  return 0;
}

async function analytics(by: string[], since: Date, until: Date, limit = 10): Promise<Result<AnalyticsRow[]>> {
  const r = await vercel<{ data?: AnalyticsRow[] }>("/v1/query/web-analytics/visits/aggregate", {
    projectId: PROJECT_ID,
    by,
    since: since.toISOString(),
    until: until.toISOString(),
    limit: String(limit),
  });
  if (!r.ok) return r;
  return { ok: true, data: Array.isArray(r.data.data) ? r.data.data : [] };
}

export type Visitors = {
  total: number;
  today: number;
  perDay: Bar[];
  pages: Bar[];
  countries: Bar[];
  devices: Bar[];
  referrers: Bar[];
};

export async function getVisitors(days: number, now: Date): Promise<Result<Visitors>> {
  const until = now;
  const since = new Date(now.getTime() - days * 86_400_000);
  const [perDay, pages, countries, devices, referrers] = await Promise.all([
    analytics(["day"], since, until, 100),
    analytics(["requestPath"], since, until, 8),
    analytics(["country"], since, until, 8),
    analytics(["deviceType"], since, until, 5),
    analytics(["referrerHostname"], since, until, 6),
  ]);
  if (!perDay.ok) return perDay;

  // Rellena los días sin visitas con 0 para que las barras queden continuas.
  const byDay = new Map<string, number>();
  for (const row of perDay.data) {
    const ts = String(row.timestamp ?? row.day ?? "").slice(0, 10);
    if (ts) byDay.set(ts, (byDay.get(ts) ?? 0) + countOf(row));
  }
  const dayBars: Bar[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86_400_000).toISOString().slice(0, 10);
    dayBars.push({ label: d, value: byDay.get(d) ?? 0 });
  }

  const toBars = (r: Result<AnalyticsRow[]>, key: string, fallback: string): Bar[] =>
    r.ok
      ? r.data
          .map((row) => ({ label: String(row[key] || fallback), value: countOf(row) }))
          .filter((b) => b.value > 0)
          .sort((a, b) => b.value - a.value)
      : [];

  return {
    ok: true,
    data: {
      total: dayBars.reduce((s, b) => s + b.value, 0),
      today: dayBars.at(-1)?.value ?? 0,
      perDay: dayBars,
      pages: toBars(pages, "requestPath", "/"),
      countries: toBars(countries, "country", "Unknown"),
      devices: toBars(devices, "deviceType", "Unknown"),
      referrers: toBars(referrers, "referrerHostname", "Direct"),
    },
  };
}

/* ------------------------------------------------------------------ */
/* Update activity (deployments)                                       */
/* ------------------------------------------------------------------ */

type Deployment = {
  uid: string;
  url?: string;
  created?: number;
  createdAt?: number;
  buildingAt?: number;
  ready?: number;
  state?: string;
  readyState?: string;
  target?: string | null;
  inspectorUrl?: string;
  meta?: { githubCommitMessage?: string; githubCommitRef?: string; githubPrId?: string };
};

export type UpdateItem = {
  id: string;
  title: string;
  branch: string;
  state: string;
  production: boolean;
  created: number;
  buildSeconds: number | null;
  inspectorUrl: string | null;
};

export type Updates = {
  total: number;
  production: number;
  failed: number;
  avgBuildSeconds: number;
  perDay: { label: string; production: number; preview: number }[];
  recent: UpdateItem[];
  lastProduction: UpdateItem | null;
};

export async function getUpdates(days: number, now: Date): Promise<Result<Updates>> {
  const since = now.getTime() - days * 86_400_000;
  const r = await vercel<{ deployments?: Deployment[] }>("/v6/deployments", {
    projectId: PROJECT_ID,
    limit: "100",
    since: String(since),
  });
  if (!r.ok) return r;

  const items: UpdateItem[] = (r.data.deployments ?? []).map((d) => {
    const created = d.created ?? d.createdAt ?? 0;
    const start = d.buildingAt ?? created;
    const state = (d.state ?? d.readyState ?? "UNKNOWN").toUpperCase();
    const title = (d.meta?.githubCommitMessage ?? "Manual deployment").split("\n")[0];
    return {
      id: d.uid,
      title,
      branch: d.meta?.githubCommitRef ?? "—",
      state,
      production: d.target === "production",
      created,
      buildSeconds: d.ready && start ? Math.max(0, Math.round((d.ready - start) / 1000)) : null,
      inspectorUrl: d.inspectorUrl ?? null,
    };
  });

  const perDayMap = new Map<string, { production: number; preview: number }>();
  for (let i = days - 1; i >= 0; i--) {
    perDayMap.set(new Date(now.getTime() - i * 86_400_000).toISOString().slice(0, 10), { production: 0, preview: 0 });
  }
  for (const it of items) {
    const key = new Date(it.created).toISOString().slice(0, 10);
    const slot = perDayMap.get(key);
    if (slot) slot[it.production ? "production" : "preview"] += 1;
  }

  const builds = items.map((i) => i.buildSeconds).filter((s): s is number => s !== null);
  return {
    ok: true,
    data: {
      total: items.length,
      production: items.filter((i) => i.production).length,
      failed: items.filter((i) => i.state === "ERROR").length,
      avgBuildSeconds: builds.length ? Math.round(builds.reduce((a, b) => a + b, 0) / builds.length) : 0,
      perDay: [...perDayMap].map(([label, v]) => ({ label, ...v })),
      recent: items.slice(0, 12),
      lastProduction: items.find((i) => i.production && i.state === "READY") ?? null,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Server health                                                       */
/* ------------------------------------------------------------------ */

export type Check = { name: string; ok: boolean; ms: number | null; detail: string };

async function ping(name: string, url: string): Promise<Check> {
  const start = Date.now();
  try {
    const res = await fetch(url, { method: "GET", cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(8_000) });
    const ms = Date.now() - start;
    return { name, ok: res.ok, ms, detail: `HTTP ${res.status}` };
  } catch (err) {
    return { name, ok: false, ms: null, detail: err instanceof Error ? err.message : "No response" };
  }
}

export async function getHealth(): Promise<Check[]> {
  const [home, cv] = await Promise.all([
    ping("Homepage", SITE_URL),
    ping("CV (PDF)", `${SITE_URL}/CV_Alejandro_Gomez.pdf`),
  ]);
  const env = (k: string) => Boolean(process.env[k]);
  return [
    home,
    cv,
    {
      name: "Contact form → Drive",
      ok: env("CONTACT_SCRIPT_URL") && env("CONTACT_SHARED_SECRET"),
      ms: null,
      detail: env("CONTACT_SCRIPT_URL") && env("CONTACT_SHARED_SECRET") ? "Configured" : "Missing env vars",
    },
    {
      name: "Vercel API access",
      ok: env("VERCEL_API_TOKEN"),
      ms: null,
      detail: env("VERCEL_API_TOKEN") ? "Token set" : "VERCEL_API_TOKEN missing",
    },
  ];
}
