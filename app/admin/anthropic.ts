// Uso y costo de la API de Claude (Claude Console) para el panel /admin.
//
// Solo lectura y solo en el servidor: la clave nunca llega al navegador, no se
// guarda en el código y nunca aparece en mensajes de error.
//
// Variable de entorno (Vercel → Settings → Environment Variables, marcada como Sensitive):
//   ANTHROPIC_ADMIN_KEY   Admin API key de la organización (empieza con sk-ant-admin)
//
// Endpoints (documentados en platform.claude.com):
//   GET /v1/organizations/usage_report/messages   tokens por día y por modelo
//   GET /v1/organizations/cost_report             costo por día (centavos USD como texto)

import type { Bar, Result } from "./data";

const API = "https://api.anthropic.com";
const MAX_PAGES = 4; // 4 páginas × 31 días cubren el rango de 90 días

export type ClaudeDay = { label: string; tokens: number; cost: number };
export type ClaudeUsage = {
  perDay: ClaudeDay[];
  totalCost: number; // USD
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  totalTokens: number;
  byModel: Bar[];
};

type UsageRow = {
  model?: string | null;
  uncached_input_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation?: { ephemeral_1h_input_tokens?: number; ephemeral_5m_input_tokens?: number };
  output_tokens?: number;
};
type CostRow = { amount?: string; currency?: string };
type Bucket<R> = { starting_at: string; ending_at: string; results: R[] };
type Page<R> = { data: Bucket<R>[]; has_more: boolean; next_page: string | null };

export function isClaudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_ADMIN_KEY);
}

async function report<R>(path: string, params: Record<string, string | string[]>): Promise<Result<Bucket<R>[]>> {
  const key = process.env.ANTHROPIC_ADMIN_KEY;
  if (!key) return { ok: false, error: "ANTHROPIC_ADMIN_KEY is not set." };
  if (!key.startsWith("sk-ant-admin")) return { ok: false, error: "ANTHROPIC_ADMIN_KEY is not an Admin API key." };

  const buckets: Bucket<R>[] = [];
  let page: string | null = null;
  for (let i = 0; i < MAX_PAGES; i++) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (Array.isArray(v)) v.forEach((x) => qs.append(k, x));
      else qs.set(k, v);
    }
    if (page) qs.set("page", page);
    try {
      const res = await fetch(`${API}${path}?${qs}`, {
        headers: {
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "User-Agent": "AlejandroAdmin/1.0 (https://www.alejandrogomez.me)",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        // Solo el tipo de error; nunca devolvemos cabeceras ni la clave.
        const type = typeof body?.error?.type === "string" ? body.error.type : `HTTP ${res.status}`;
        return { ok: false, error: type };
      }
      const p = body as Page<R>;
      buckets.push(...(Array.isArray(p?.data) ? p.data : []));
      if (!p?.has_more || !p.next_page) break;
      page = p.next_page;
    } catch (err) {
      return { ok: false, error: err instanceof Error && err.name === "TimeoutError" ? "Timed out" : "Request failed" };
    }
  }
  return { ok: true, data: buckets };
}

export async function getClaudeUsage(days: number, now: Date): Promise<Result<ClaudeUsage>> {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const start = new Date(end.getTime() - days * 86_400_000);
  const range = { starting_at: start.toISOString(), ending_at: end.toISOString(), bucket_width: "1d", limit: "31" };

  const [usage, cost] = await Promise.all([
    report<UsageRow>("/v1/organizations/usage_report/messages", { ...range, "group_by[]": ["model"] }),
    report<CostRow>("/v1/organizations/cost_report", range),
  ]);
  if (!usage.ok) return usage;
  if (!cost.ok) return cost;

  // Un día por fila, aunque no haya uso.
  const perDay = new Map<string, ClaudeDay>();
  for (let t = start.getTime(); t < end.getTime(); t += 86_400_000) {
    const label = new Date(t).toISOString().slice(0, 10);
    perDay.set(label, { label, tokens: 0, cost: 0 });
  }

  let inputTokens = 0;
  let outputTokens = 0;
  let cachedTokens = 0;
  const models = new Map<string, number>();
  for (const b of usage.data) {
    const day = perDay.get(b.starting_at.slice(0, 10));
    for (const r of b.results ?? []) {
      const input =
        (r.uncached_input_tokens ?? 0) +
        (r.cache_creation?.ephemeral_1h_input_tokens ?? 0) +
        (r.cache_creation?.ephemeral_5m_input_tokens ?? 0);
      const cached = r.cache_read_input_tokens ?? 0;
      const output = r.output_tokens ?? 0;
      const total = input + cached + output;
      inputTokens += input;
      cachedTokens += cached;
      outputTokens += output;
      if (day) day.tokens += total;
      const name = r.model || "Other";
      models.set(name, (models.get(name) ?? 0) + total);
    }
  }

  let totalCost = 0;
  for (const b of cost.data) {
    const day = perDay.get(b.starting_at.slice(0, 10));
    for (const r of b.results ?? []) {
      const cents = Number(r.amount ?? 0);
      if (!Number.isFinite(cents)) continue;
      const usd = cents / 100;
      totalCost += usd;
      if (day) day.cost += usd;
    }
  }

  const byModel = [...models.entries()]
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, value]) => ({ label, value }));

  return {
    ok: true,
    data: {
      perDay: [...perDay.values()],
      totalCost,
      inputTokens,
      outputTokens,
      cachedTokens,
      totalTokens: inputTokens + outputTokens + cachedTokens,
      byModel,
    },
  };
}
