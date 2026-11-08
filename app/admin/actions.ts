"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE,
  SESSION_HOURS,
  checkPassword,
  clearAttempts,
  createSessionToken,
  isConfigured,
  recordFailedAttempt,
  tooManyAttempts,
} from "./session";

export type LoginState = { error: string | null };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  if (!isConfigured()) {
    return { error: "The admin panel is not set up yet (missing ADMIN_PASSWORD or ADMIN_SESSION_SECRET)." };
  }

  const ip = ((await headers()).get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (tooManyAttempts(ip)) {
    return { error: "Too many attempts. Try again in 15 minutes." };
  }

  const password = String(formData.get("password") ?? "");
  if (!password || !checkPassword(password)) {
    recordFailedAttempt(ip);
    // Pequeña espera para frenar ataques de fuerza bruta
    await new Promise((r) => setTimeout(r, 600));
    return { error: "Wrong password." };
  }

  const token = createSessionToken();
  if (!token) return { error: "Session could not be created." };

  clearAttempts(ip);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_HOURS * 60 * 60,
  });
  redirect("/admin");
}

export async function logout(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/admin");
}
