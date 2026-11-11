// Login en 3 pasos del panel /admin: contraseña → código por correo → Face ID / huella (passkey).
// Todo corre en el servidor. Nada secreto llega al navegador.
//
// Variables de entorno (Vercel → Settings → Environment Variables):
//   ADMIN_SESSION_SECRET   firma las cookies (ya existe)
//   CONTACT_SCRIPT_URL     Apps Script que envía el código por correo (ya existe)
//   CONTACT_SHARED_SECRET  clave compartida con el Apps Script (ya existe)
//   ADMIN_PASSKEYS         (después de registrar Face ID) la lista de passkeys que el panel te da para copiar

import { createHmac, randomInt } from "node:crypto";
import { cookies, headers } from "next/headers";
import { safeEqual, secret } from "./session";

export const PENDING_COOKIE = "admin_pending";
export const REG_COOKIE = "admin_reg";
export const CODE_TTL_MS = 5 * 60 * 1000;
export const RESEND_AFTER_MS = 30 * 1000;
export const CODE_TRIES = 5;

/* ------------------------------------------------------------------ */
/* Cookie firmada con el progreso del login                            */
/* ------------------------------------------------------------------ */

export type Pending = {
  s: "code" | "face" | "done"; // paso actual ("done" = verificado, falta abrir la sesión)
  exp: number; // vence
  t: number; // cuándo se envió el último código
  n: number; // códigos incorrectos
  h?: string; // hash del código (nunca el código)
  ch?: string; // desafío de la passkey
};

function mac(kind: string, value: string): string | null {
  const key = secret();
  if (!key) return null;
  return createHmac("sha256", key).update(`${kind}|${value}`).digest("base64url");
}

function encode(kind: string, data: object): string | null {
  const body = Buffer.from(JSON.stringify(data)).toString("base64url");
  const sig = mac(kind, body);
  return sig ? `${body}.${sig}` : null;
}

function decode<T>(kind: string, token: string | undefined): T | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  const expected = body ? mac(kind, body) : null;
  if (!body || !sig || !expected || !safeEqual(sig, expected)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

const cookieBase = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/admin",
};

export async function readPending(): Promise<Pending | null> {
  const p = decode<Pending>("pending", (await cookies()).get(PENDING_COOKIE)?.value);
  return p && p.exp > Date.now() ? p : null;
}

export async function writePending(p: Pending): Promise<void> {
  const token = encode("pending", p);
  if (token) (await cookies()).set(PENDING_COOKIE, token, { ...cookieBase, maxAge: 10 * 60 });
}

export async function clearPending(): Promise<void> {
  (await cookies()).delete({ name: PENDING_COOKIE, path: "/admin" });
}

export async function writeRegChallenge(challenge: string): Promise<void> {
  const token = encode("reg", { ch: challenge, exp: Date.now() + CODE_TTL_MS });
  if (token) (await cookies()).set(REG_COOKIE, token, { ...cookieBase, maxAge: 5 * 60 });
}

export async function takeRegChallenge(): Promise<string | null> {
  const jar = await cookies();
  const r = decode<{ ch: string; exp: number }>("reg", jar.get(REG_COOKIE)?.value);
  jar.delete({ name: REG_COOKIE, path: "/admin" });
  return r && r.exp > Date.now() ? r.ch : null;
}

/* ------------------------------------------------------------------ */
/* Código de 6 dígitos                                                 */
/* ------------------------------------------------------------------ */

export function newCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

// El hash depende del vencimiento, así un código viejo no sirve con otra cookie.
export function hashCode(code: string, exp: number): string {
  return mac("code", `${code}|${exp}`) ?? "";
}

export function codeMatches(input: string, p: Pending): boolean {
  if (!/^\d{6}$/.test(input) || !p.h) return false;
  return safeEqual(hashCode(input, p.exp), p.h);
}

/** Envía el código por el Apps Script. El destinatario está fijo en el script. */
export async function sendToScript(payload: Record<string, string>): Promise<boolean> {
  const url = process.env.CONTACT_SCRIPT_URL;
  const shared = process.env.CONTACT_SHARED_SECRET;
  if (!url || !shared) return false;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: shared, ...payload }),
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await res.json().catch(() => null)) as { ok?: boolean } | null;
    return Boolean(res.ok && data?.ok);
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Passkeys (Face ID / huella / Windows Hello)                          */
/* ------------------------------------------------------------------ */

export type StoredPasskey = { id: string; pk: string; rp: string; tr?: string[]; at?: string };

export function storedPasskeys(): StoredPasskey[] {
  try {
    const raw = JSON.parse(process.env.ADMIN_PASSKEYS || "[]");
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (p): p is StoredPasskey =>
        p && typeof p.id === "string" && typeof p.pk === "string" && typeof p.rp === "string",
    );
  } catch {
    return [];
  }
}

/** rpID y origen del sitio. En alejandrogomez.me sirve para www y sin www. */
export async function relyingParty(): Promise<{ rpID: string; origin: string }> {
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "localhost").split(",")[0].trim();
  const hostname = host.replace(/:\d+$/, "");
  const proto = (h.get("x-forwarded-proto") ?? (hostname === "localhost" ? "http" : "https")).split(",")[0].trim();
  const rpID = hostname === "alejandrogomez.me" || hostname.endsWith(".alejandrogomez.me") ? "alejandrogomez.me" : hostname;
  return { rpID, origin: `${proto}://${host}` };
}

export async function passkeysForThisSite(): Promise<StoredPasskey[]> {
  const { rpID } = await relyingParty();
  return storedPasskeys().filter((p) => p.rp === rpID);
}
