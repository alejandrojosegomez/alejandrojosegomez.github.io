"use server";

import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  LOCK_MINUTES,
  SESSION_COOKIE,
  attemptsLeft,
  checkPassword,
  clearAttempts,
  clientInfo,
  isAdmin,
  isConfigured,
  lockedUntil,
  recordFailedAttempt,
  startSession,
  tooManyAttempts,
} from "./session";
import {
  CODE_TRIES,
  CODE_TTL_MS,
  RESEND_AFTER_MS,
  clearPending,
  codeMatches,
  hashCode,
  newCode,
  passkeysForThisSite,
  readPending,
  relyingParty,
  sendToScript,
  storedPasskeys,
  takeRegChallenge,
  writePending,
  writeRegChallenge,
  type Pending,
  type StoredPasskey,
} from "./twofactor";

export type Stage = "password" | "code" | "face";

export type LoginResult =
  | { status: "code"; resendIn: number; expiresIn: number }
  | { status: "face"; options: PublicKeyCredentialRequestOptionsJSON }
  | { status: "granted" }
  | {
      status: "denied";
      stage: Stage;
      reason: string;
      left: number;
      locked: boolean;
      restart: boolean;
      until: number; // fin del bloqueo (ms), 0 si no hay bloqueo
      fresh: boolean; // true = este intento falló; false = ya estaba bloqueado
      alerted: boolean;
    }
  | { status: "error"; stage: Stage; message: string };

const slow = () => new Promise((r) => setTimeout(r, 600)); // frena la fuerza bruta

async function denied(stage: Stage, reason: string, restart = false): Promise<LoginResult> {
  const { ip, userAgent } = await clientInfo();
  recordFailedAttempt(ip);
  const until = lockedUntil(ip);
  const locked = until > 0;
  const left = attemptsLeft(ip);
  let alerted = false;
  if (locked) {
    await clearPending();
    alerted = await sendToScript({ action: "admin_alert", reason, ip, userAgent });
  } else if (restart) {
    await clearPending();
  }
  await slow();
  return { status: "denied", stage, reason, left, locked, restart: restart || locked, until, fresh: true, alerted };
}

async function lockedResult(stage: Stage): Promise<LoginResult> {
  const { ip } = await clientInfo();
  return {
    status: "denied",
    stage,
    reason: "Sign-in is locked after too many failed attempts.",
    left: 0,
    locked: true,
    restart: true,
    until: lockedUntil(ip) || Date.now() + LOCK_MINUTES * 60 * 1000,
    fresh: false,
    alerted: false,
  };
}

async function sendNewCode(prev?: Pending): Promise<LoginResult> {
  const { ip, userAgent } = await clientInfo();
  const code = newCode();
  const now = Date.now();
  const exp = now + CODE_TTL_MS;
  const sent = await sendToScript({ action: "admin_code", code, ip, userAgent });
  if (!sent) {
    return { status: "error", stage: prev ? "code" : "password", message: "Couldn't send the code email. Try again in a moment." };
  }
  await writePending({ s: "code", exp, t: now, n: prev?.n ?? 0, h: hashCode(code, exp) });
  return { status: "code", resendIn: RESEND_AFTER_MS / 1000, expiresIn: CODE_TTL_MS / 1000 };
}

// Todos los pasos están bien. La sesión se abre con finishLogin() cuando termina la animación
// (si se abriera aquí, el panel saltaría al dashboard antes de mostrar el escudo).
async function grant(p: Pending): Promise<LoginResult> {
  const { ip } = await clientInfo();
  clearAttempts(ip);
  await writePending({ s: "done", exp: Date.now() + 60_000, t: p.t, n: p.n });
  return { status: "granted" };
}

export async function finishLogin(): Promise<boolean> {
  const p = await readPending();
  if (!p || p.s !== "done") return false;
  await clearPending();
  return startSession();
}

/* ---------------- Step 1: password ---------------- */

export async function submitPassword(password: string): Promise<LoginResult> {
  if (!isConfigured()) {
    return { status: "error", stage: "password", message: "The admin panel is not set up yet (missing ADMIN_PASSWORD or ADMIN_SESSION_SECRET)." };
  }
  const { ip } = await clientInfo();
  if (tooManyAttempts(ip)) return lockedResult("password");
  if (!password || !checkPassword(String(password))) return denied("password", "Wrong password.", true);
  return sendNewCode();
}

/* ---------------- Step 2: email code ---------------- */

export async function resendCode(): Promise<LoginResult> {
  const { ip } = await clientInfo();
  if (tooManyAttempts(ip)) return lockedResult("code");
  const p = await readPending();
  if (!p || p.s !== "code") return { status: "error", stage: "password", message: "Your sign-in expired. Start again." };
  if (Date.now() - p.t < RESEND_AFTER_MS) {
    return { status: "error", stage: "code", message: "Wait a few seconds before asking for a new code." };
  }
  return sendNewCode(p);
}

export async function submitCode(code: string): Promise<LoginResult> {
  const { ip } = await clientInfo();
  if (tooManyAttempts(ip)) return lockedResult("code");
  const p = await readPending();
  if (!p || p.s !== "code") return denied("code", "The code expired. Sign in again to get a new one.", true);

  if (!codeMatches(String(code), p)) {
    const n = p.n + 1;
    if (n >= CODE_TRIES) return denied("code", "Too many wrong codes. Sign in again.", true);
    await writePending({ ...p, n });
    return denied("code", "The code doesn't match the one sent to your email.");
  }

  const keys = await passkeysForThisSite();
  if (keys.length === 0) return grant(p); // Face ID todavía no está configurado: contraseña + correo

  const { rpID } = await relyingParty();
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "required",
    timeout: 60_000,
    allowCredentials: keys.map((k) => ({ id: k.id, transports: k.tr as AuthenticatorTransportFuture[] | undefined })),
  });
  await writePending({ s: "face", exp: Date.now() + CODE_TTL_MS, t: p.t, n: p.n, ch: options.challenge });
  return { status: "face", options };
}

/* ---------------- Step 3: Face ID / passkey ---------------- */

export async function submitPasskey(response: AuthenticationResponseJSON): Promise<LoginResult> {
  const { ip } = await clientInfo();
  if (tooManyAttempts(ip)) return lockedResult("face");
  const p = await readPending();
  if (!p || p.s !== "face" || !p.ch) return denied("face", "The verification expired. Sign in again.", true);

  const key = (await passkeysForThisSite()).find((k) => k.id === response?.id);
  if (!key) return denied("face", "This device isn't registered for your admin panel.");

  try {
    const { rpID, origin } = await relyingParty();
    const result = await verifyAuthenticationResponse({
      response,
      expectedChallenge: p.ch,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: {
        id: key.id,
        publicKey: new Uint8Array(Buffer.from(key.pk, "base64url")),
        counter: 0,
        transports: key.tr as AuthenticatorTransportFuture[] | undefined,
      },
    });
    if (!result.verified) return denied("face", "Face ID couldn't verify it's you.");
  } catch {
    return denied("face", "Face ID couldn't verify it's you.");
  }
  return grant(p);
}

/* ---------------- Face ID setup (only when signed in) ---------------- */

export type SetupResult =
  | { ok: true; options: PublicKeyCredentialCreationOptionsJSON }
  | { ok: false; message: string };

export async function beginPasskeySetup(): Promise<SetupResult> {
  if (!(await isAdmin())) return { ok: false, message: "Sign in first." };
  const { rpID } = await relyingParty();
  const existing = storedPasskeys().filter((k) => k.rp === rpID);
  const options = await generateRegistrationOptions({
    rpName: "AG Admin",
    rpID,
    userName: "alejandro",
    userDisplayName: "Alejandro Gomez",
    attestationType: "none",
    timeout: 60_000,
    excludeCredentials: existing.map((k) => ({ id: k.id, transports: k.tr as AuthenticatorTransportFuture[] | undefined })),
    authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
  });
  await writeRegChallenge(options.challenge);
  return { ok: true, options };
}

export type FinishSetupResult = { ok: true; value: string; total: number } | { ok: false; message: string };

export async function finishPasskeySetup(response: RegistrationResponseJSON, device: string): Promise<FinishSetupResult> {
  if (!(await isAdmin())) return { ok: false, message: "Sign in first." };
  const challenge = await takeRegChallenge();
  if (!challenge) return { ok: false, message: "Setup expired. Try again." };
  try {
    const { rpID, origin } = await relyingParty();
    const result = await verifyRegistrationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
    if (!result.verified || !result.registrationInfo) return { ok: false, message: "Your device didn't confirm it. Try again." };
    const c = result.registrationInfo.credential;
    const entry: StoredPasskey = {
      id: c.id,
      pk: Buffer.from(c.publicKey).toString("base64url"),
      rp: rpID,
      tr: c.transports,
      at: String(device || "Device").replace(/[^\w .()-]/g, "").slice(0, 40),
    };
    const all = [...storedPasskeys().filter((k) => k.id !== entry.id), entry];
    return { ok: true, value: JSON.stringify(all), total: all.length };
  } catch {
    return { ok: false, message: "Your device didn't confirm it. Try again." };
  }
}

/* ---------------- Logout ---------------- */

export async function logout(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  await clearPending();
  redirect("/admin");
}
