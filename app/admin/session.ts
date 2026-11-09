// Sesión del panel /admin: cookie firmada con HMAC (solo el servidor puede crearla).
//
// Variables de entorno (Vercel → Settings → Environment Variables):
//   ADMIN_PASSWORD        tu contraseña del panel (solo tú la sabes)
//   ADMIN_SESSION_SECRET  clave larga y aleatoria para firmar la cookie

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { connection } from "next/server";

export const SESSION_COOKIE = "admin_session";
export const SESSION_HOURS = 12;

function secret(): string | null {
  const s = process.env.ADMIN_SESSION_SECRET;
  return s && s.length >= 32 ? s : null;
}

function sign(value: string, key: string): string {
  return createHmac("sha256", key).update(value).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  // Compara hashes de igual longitud para no filtrar información por tiempo.
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function isConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD && secret());
}

export function checkPassword(input: string): boolean {
  const real = process.env.ADMIN_PASSWORD;
  if (!real) return false;
  return safeEqual(input, real);
}

export function createSessionToken(now = Date.now()): string | null {
  const key = secret();
  if (!key) return null;
  const exp = String(now + SESSION_HOURS * 60 * 60 * 1000);
  return `${exp}.${sign(exp, key)}`;
}

export function verifySessionToken(token: string | undefined, now = Date.now()): boolean {
  const key = secret();
  if (!key || !token) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || !/^\d+$/.test(exp)) return false;
  if (!safeEqual(sig, sign(exp, key))) return false;
  return Number(exp) > now;
}

/** Lee la cookie de la petición actual. Debe usarse dentro de un <Suspense>. */
export async function isAdmin(): Promise<boolean> {
  // Se evalúa en cada petición (usa la hora actual para revisar si la sesión expiró).
  await connection();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySessionToken(token);
}

// Límite de intentos de login por IP (por instancia del servidor): 5 cada 15 minutos.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_TRIES = 5;
const attempts = new Map<string, number[]>();

export function tooManyAttempts(ip: string): boolean {
  const now = Date.now();
  const recent = (attempts.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  attempts.set(ip, recent);
  return recent.length >= MAX_TRIES;
}

export function recordFailedAttempt(ip: string): void {
  const list = attempts.get(ip) ?? [];
  list.push(Date.now());
  attempts.set(ip, list);
}

export function clearAttempts(ip: string): void {
  attempts.delete(ip);
}
