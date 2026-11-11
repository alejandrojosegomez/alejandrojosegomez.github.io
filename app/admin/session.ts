// Sesión del panel /admin: cookie firmada con HMAC (solo el servidor puede crearla).
//
// Variables de entorno (Vercel → Settings → Environment Variables):
//   ADMIN_PASSWORD        tu contraseña del panel (solo tú la sabes)
//   ADMIN_SESSION_SECRET  clave larga y aleatoria para firmar la cookie

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { connection } from "next/server";

export const SESSION_COOKIE = "admin_session";
export const SESSION_HOURS = 12;

export function secret(): string | null {
  const s = process.env.ADMIN_SESSION_SECRET;
  return s && s.length >= 32 ? s : null;
}

function sign(value: string, key: string): string {
  return createHmac("sha256", key).update(value).digest("base64url");
}

export function safeEqual(a: string, b: string): boolean {
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

// Versión de la sesión. Las sesiones de antes del login de 3 pasos (solo contraseña)
// no tienen esta marca y ya no sirven. Subir el número cierra todas las sesiones abiertas.
const SESSION_VERSION = "s2";

export function createSessionToken(now = Date.now()): string | null {
  const key = secret();
  if (!key) return null;
  const exp = String(now + SESSION_HOURS * 60 * 60 * 1000);
  return `${SESSION_VERSION}.${exp}.${sign(`${SESSION_VERSION}|${exp}`, key)}`;
}

export function verifySessionToken(token: string | undefined, now = Date.now()): boolean {
  const key = secret();
  if (!key || !token) return false;
  const [version, exp, sig, extra] = token.split(".");
  if (extra !== undefined || version !== SESSION_VERSION) return false;
  if (!exp || !sig || !/^\d+$/.test(exp)) return false;
  if (!safeEqual(sig, sign(`${SESSION_VERSION}|${exp}`, key))) return false;
  return Number(exp) > now;
}

/** Lee la cookie de la petición actual. Debe usarse dentro de un <Suspense>. */
export async function isAdmin(): Promise<boolean> {
  // Se evalúa en cada petición (usa la hora actual para revisar si la sesión expiró).
  await connection();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySessionToken(token);
}

/** Guarda la sesión completa (después de contraseña + código + Face ID). */
export async function startSession(): Promise<boolean> {
  const token = createSessionToken();
  if (!token) return false;
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // "lax": la sesión también abre el panel cuando llegas desde un enlace externo.
    // Las server actions de Next.js ya bloquean peticiones de otros sitios (CSRF).
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_HOURS * 60 * 60,
  });
  return true;
}

export async function clientInfo(): Promise<{ ip: string; userAgent: string }> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  return { ip, userAgent: (h.get("user-agent") ?? "unknown").slice(0, 200) };
}

// Límite de intentos fallidos por IP (por instancia del servidor): 5 cada 15 minutos.
// Cuenta juntos los errores de contraseña, código y Face ID.
const WINDOW_MS = 15 * 60 * 1000;
export const MAX_TRIES = 5;
export const LOCK_MINUTES = 15;
// Por IP: fallos recientes y, si se bloqueó, hasta cuándo.
// El bloqueo dura exactamente LOCK_MINUTES desde el 5.º fallo; al terminar, se empieza de cero.
type Record_ = { fails: number[]; lockUntil: number };
const attempts = new Map<string, Record_>();

function current(ip: string, now: number): Record_ {
  let r = attempts.get(ip) ?? { fails: [], lockUntil: 0 };
  if (r.lockUntil && now >= r.lockUntil) r = { fails: [], lockUntil: 0 }; // el bloqueo terminó
  r.fails = r.fails.filter((t) => now - t < WINDOW_MS);
  attempts.set(ip, r);
  return r;
}

/** Hora (ms) en que termina el bloqueo, o 0 si no está bloqueado. */
export function lockedUntil(ip: string): number {
  const now = Date.now();
  const r = current(ip, now);
  return r.lockUntil > now ? r.lockUntil : 0;
}

export function tooManyAttempts(ip: string): boolean {
  return lockedUntil(ip) > 0;
}

export function recordFailedAttempt(ip: string): void {
  const now = Date.now();
  const r = current(ip, now);
  if (r.lockUntil > now) return; // durante el bloqueo no se suma tiempo
  r.fails.push(now);
  if (r.fails.length >= MAX_TRIES) {
    r.lockUntil = now + LOCK_MINUTES * 60 * 1000;
    r.fails = [];
  }
}

export function clearAttempts(ip: string): void {
  attempts.delete(ip);
}

export function attemptsLeft(ip: string): number {
  const now = Date.now();
  const r = current(ip, now);
  return r.lockUntil > now ? 0 : Math.max(0, MAX_TRIES - r.fails.length);
}
