"use client";

import { startAuthentication } from "@simplewebauthn/browser";
import type { PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/server";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { finishLogin, resendCode, submitCode, submitPasskey, submitPassword, type LoginResult, type Stage } from "./actions";

type View = "password" | "code" | "face" | "loading" | "denied";
type Denied = Extract<LoginResult, { status: "denied" }>;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function LoginForm() {
  const router = useRouter();
  const [view, setView] = useState<View>("password");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [deniedInfo, setDeniedInfo] = useState<Denied | null>(null);
  const [usedFace, setUsedFace] = useState(false);
  const [faceOptions, setFaceOptions] = useState<PublicKeyCredentialRequestOptionsJSON | null>(null);
  // Al terminar la animación: abre la sesión y muestra el dashboard
  const finish = useCallback(async () => {
    const ok = await finishLogin().catch(() => false);
    if (ok) router.refresh();
    else {
      setError("Your sign-in expired. Start again.");
      setView("password");
    }
  }, [router]);
  const [deadlines, setDeadlines] = useState({ expiresAt: 0, resendAt: 0 });

  const handle = useCallback(async (r: LoginResult) => {
    setError(null);
    if (r.status === "code") {
      const now = Date.now();
      setDeadlines({ expiresAt: now + r.expiresIn * 1000, resendAt: now + r.resendIn * 1000 });
      setView("code");
    } else if (r.status === "face") {
      setFaceOptions(r.options);
      setUsedFace(true);
      setView("face");
    } else if (r.status === "granted") {
      setView("loading");
    } else if (r.status === "denied") {
      setDeniedInfo(r);
      setView("denied");
    } else {
      setError(r.message);
      setShake((n) => n + 1);
      if (r.stage === "password") setView("password");
    }
  }, []);

  const run = useCallback(
    async (fn: () => Promise<LoginResult>) => {
      if (busy) return;
      setBusy(true);
      try {
        await handle(await fn());
      } catch {
        setError("Connection problem. Check your internet and try again.");
        setShake((n) => n + 1);
      } finally {
        setBusy(false);
      }
    },
    [busy, handle],
  );

  const retry = () => {
    if (!deniedInfo) return;
    setError(null);
    if (deniedInfo.restart) {
      setUsedFace(false);
      setView("password");
    } else {
      setView(deniedInfo.stage === "password" ? "password" : deniedInfo.stage);
    }
  };

  return (
    <div className="ag-auth min-h-[80vh] flex items-center justify-center px-4 py-10">
      <style>{CSS}</style>

      {view === "password" && (
        <PasswordCard busy={busy} error={error} shake={shake} onSubmit={(pw) => run(() => submitPassword(pw))} />
      )}

      {view === "code" && (
        <CodeCard
          busy={busy}
          error={error}
          shake={shake}
          deadlines={deadlines}
          onSubmit={(code) => run(() => submitCode(code))}
          onResend={() => run(() => resendCode())}
          onBack={() => setView("password")}
        />
      )}

      {view === "face" && faceOptions && (
        <FaceCard
          options={faceOptions}
          onResult={(r) => handle(r)}
          submit={(resp) => submitPasskey(resp)}
        />
      )}

      {view === "loading" && <Loader usedFace={usedFace} onDone={finish} />}

      {view === "denied" && deniedInfo && <DeniedScreen info={deniedInfo} onRetry={retry} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 1: password                                                    */
/* ------------------------------------------------------------------ */

function PasswordCard({ busy, error, shake, onSubmit }: { busy: boolean; error: string | null; shake: number; onSubmit: (pw: string) => void }) {
  const [pw, setPw] = useState("");
  return (
    <form
      key={shake}
      className={`ag-card ag-in ${shake ? "ag-shake" : ""}`}
      onSubmit={(e) => {
        e.preventDefault();
        if (pw) onSubmit(pw);
      }}
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
          <svg className="w-5 h-5 text-[#3443c7]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <div>
          <h1 className="text-slate-900 font-bold text-lg leading-tight">Admin Panel</h1>
          <p className="text-slate-500 text-xs">alejandrogomez.me · private</p>
        </div>
      </div>
      <label htmlFor="password" className="block text-xs font-semibold text-slate-600 mb-1.5">
        Password
      </label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        autoFocus
        required
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        className="ag-input"
      />
      {error && <p role="alert" className="ag-error">{error}</p>}
      <button type="submit" disabled={busy || !pw} className="ag-btn mt-5">
        {busy ? <Dots label="Sending code" /> : "Sign in"}
      </button>
      <p className="mt-4 text-center text-[11px] text-slate-400">Protected by password, email code and Face ID</p>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Step 2: email code                                                  */
/* ------------------------------------------------------------------ */

function CodeCard({
  busy,
  error,
  shake,
  deadlines,
  onSubmit,
  onResend,
  onBack,
}: {
  busy: boolean;
  error: string | null;
  shake: number;
  deadlines: { expiresAt: number; resendAt: number };
  onSubmit: (code: string) => void;
  onResend: () => void;
  onBack: () => void;
}) {
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [now, setNow] = useState(() => Date.now());
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const submitted = useRef("");
  const left = Math.max(0, Math.ceil((deadlines.expiresAt - now) / 1000));
  const resendLeft = Math.max(0, Math.ceil((deadlines.resendAt - now) / 1000));

  // Código nuevo (reenviado): limpia las casillas
  useEffect(() => {
    const t = setTimeout(() => {
      setDigits(["", "", "", "", "", ""]);
      submitted.current = "";
      refs.current[0]?.focus();
    }, 0);
    return () => clearTimeout(t);
  }, [deadlines]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  const fill = (start: number, text: string) => {
    const clean = text.replace(/\D/g, "");
    if (!clean) return;
    const next = [...digits];
    clean.slice(0, 6 - start).split("").forEach((c, k) => (next[start + k] = c));
    setDigits(next);
    const pos = Math.min(5, start + clean.length);
    refs.current[pos]?.focus();
    const code = next.join("");
    if (code.length === 6 && !busy && submitted.current !== code) {
      submitted.current = code;
      onSubmit(code);
    }
  };

  const code = digits.join("");
  const mm = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;

  return (
    <form
      key={shake}
      className={`ag-card ag-in ${shake ? "ag-shake" : ""}`}
      onSubmit={(e) => {
        e.preventDefault();
        if (code.length === 6) {
          submitted.current = code;
          onSubmit(code);
        }
      }}
    >
      <div className="ag-mailicon" aria-hidden="true">
        <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>
      <h1 className="text-center text-lg font-bold text-slate-900">Check your email</h1>
      <p className="text-center text-[13px] text-slate-500 mt-1 mb-5 leading-relaxed">
        We sent a 6-digit code to
        <br />
        <b className="text-slate-900">your email</b>
      </p>
      <div className="flex gap-2 justify-center">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            value={d}
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            aria-label={`Digit ${i + 1}`}
            disabled={busy || left === 0}
            className={`ag-otp ${d ? "ag-otp-filled" : ""}`}
            onChange={(e) => {
              const v = e.target.value;
              if (v.length > 1) return fill(i, v); // autocompletar / pegar
              const next = [...digits];
              next[i] = v.replace(/\D/g, "");
              setDigits(next);
              if (next[i]) fill(i, next[i]);
            }}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !digits[i] && i > 0) refs.current[i - 1]?.focus();
            }}
            onPaste={(e) => {
              e.preventDefault();
              fill(i, e.clipboardData.getData("text"));
            }}
          />
        ))}
      </div>
      {left === 0 ? (
        <p role="alert" className="ag-error">The code expired. Tap Resend code.</p>
      ) : (
        error && <p role="alert" className="ag-error">{error}</p>
      )}
      <button type="submit" disabled={busy || code.length < 6 || left === 0} className="ag-btn mt-5">
        {busy ? <Dots label="Verifying" /> : "Verify"}
      </button>
      <div className="flex justify-between mt-3.5 text-xs text-slate-500">
        <span>
          Expires in <b className="text-slate-900 tabular-nums">{mm}</b>
        </span>
        <button
          type="button"
          onClick={onResend}
          disabled={busy || resendLeft > 0}
          className="font-semibold text-[#3443c7] disabled:text-slate-400 cursor-pointer disabled:cursor-default"
        >
          {resendLeft > 0 ? `Resend in ${resendLeft}s` : "Resend code"}
        </button>
      </div>
      <button type="button" onClick={onBack} className="block mx-auto mt-4 text-[11px] text-slate-400 hover:text-slate-600 cursor-pointer">
        ← Back to password
      </button>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Step 3: Face ID / passkey                                           */
/* ------------------------------------------------------------------ */

function FaceCard({
  options,
  onResult,
  submit,
}: {
  options: PublicKeyCredentialRequestOptionsJSON;
  onResult: (r: LoginResult) => void;
  submit: (resp: Parameters<typeof submitPasskey>[0]) => Promise<LoginResult>;
}) {
  const [phase, setPhase] = useState<"idle" | "scanning" | "checking" | "ok">("idle");
  const [msg, setMsg] = useState("Tap the button and look at your device.");
  const [pct, setPct] = useState(0);

  const verify = async () => {
    setPhase("scanning");
    setPct(25);
    setMsg("Waiting for Face ID…");
    let resp;
    try {
      resp = await startAuthentication({ optionsJSON: options });
    } catch {
      // Cancelado o el dispositivo no respondió: no cuenta como intento
      setPhase("idle");
      setPct(0);
      setMsg("Cancelled, or this device isn't registered. Try again.");
      return;
    }
    setPhase("checking");
    setPct(55);
    setMsg("Mapping facial features…");
    const [r] = await Promise.all([submit(resp).catch(() => null), wait(1200)]);
    if (!r) {
      setPhase("idle");
      setPct(0);
      setMsg("Connection problem. Try again.");
      return;
    }
    setPct(85);
    setMsg("Comparing with your profile…");
    await wait(900);
    if (r.status === "granted") {
      setPct(100);
      setPhase("ok");
      setMsg("Identity verified");
      await wait(1100);
    }
    onResult(r);
  };

  const scanning = phase === "scanning" || phase === "checking";
  return (
    <div className="ag-card ag-in">
      <h1 className="text-center text-lg font-bold text-slate-900">Face verification</h1>
      <p className="text-center text-[13px] text-slate-500 mt-1 mb-4">Confirm it&apos;s you with Face ID, fingerprint or Windows Hello.</p>
      <div className={`ag-cam ${scanning ? "is-scan" : ""} ${phase === "ok" ? "is-ok" : ""}`}>
        <svg className="ag-cam-face" viewBox="0 0 100 100" aria-hidden="true">
          <path d="M30 18 H20 a4 4 0 0 0 -4 4 V32 M70 18 H80 a4 4 0 0 1 4 4 V32 M30 82 H20 a4 4 0 0 1 -4 -4 V68 M70 82 H80 a4 4 0 0 0 4 -4 V68" />
          <path d="M38 40 v4 M62 40 v4 M50 42 v12 h-4 M40 64 q10 8 20 0" />
        </svg>
        <svg className="ag-mesh" viewBox="0 0 100 100" aria-hidden="true">
          {MESH_LINES.map(([a, b], i) => (
            <line key={i} x1={MESH[a][0]} y1={MESH[a][1]} x2={MESH[b][0]} y2={MESH[b][1]} />
          ))}
          {MESH.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={1.3} style={{ animationDelay: `${(i % 6) * 0.15}s` }} />
          ))}
        </svg>
        <div className="ag-beam" />
        <div className="ag-okmark">
          <svg viewBox="0 0 70 70" aria-hidden="true">
            <path d="M18 36 l11 11 l23 -25" />
          </svg>
        </div>
      </div>
      <p className={`text-center text-[13px] font-semibold mt-4 min-h-[18px] ${phase === "ok" ? "text-slate-900" : "text-slate-500"}`}>{msg}</p>
      <div className={`ag-minibar ${phase === "ok" ? "is-ok" : ""}`}>
        <i style={{ width: `${pct}%` }} />
      </div>
      <button type="button" onClick={verify} disabled={phase !== "idle"} className="ag-btn mt-4">
        {phase === "idle" ? "Verify with Face ID" : phase === "ok" ? "Verified ✓" : <Dots label="Verifying" />}
      </button>
    </div>
  );
}

// Puntos de la "malla" facial (solo animación)
const MESH: [number, number][] = [
  [50, 22], [38, 28], [62, 28], [33, 40], [67, 40], [42, 42], [58, 42], [50, 50],
  [44, 58], [56, 58], [50, 63], [40, 70], [60, 70], [50, 76], [35, 55], [65, 55],
];
const MESH_LINES: [number, number][] = MESH.flatMap((p, i) =>
  MESH.slice(i + 1)
    .map((q, k) => [i, i + 1 + k] as [number, number])
    .filter(([a, b]) => Math.hypot(MESH[a][0] - MESH[b][0], MESH[a][1] - MESH[b][1]) < 17),
);

/* ------------------------------------------------------------------ */
/* Loading: AG shield                                                  */
/* ------------------------------------------------------------------ */

function Loader({ usedFace, onDone }: { usedFace: boolean; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const done = useRef(false);
  const doneFn = useRef(onDone);
  useEffect(() => {
    doneFn.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const plan = [450, 750, 750, 650];
    let i = 0;
    let t: ReturnType<typeof setTimeout>;
    const next = () => {
      i++;
      setStep(i);
      if (i < plan.length) t = setTimeout(next, plan[i]);
      else if (!done.current) {
        done.current = true;
        t = setTimeout(() => doneFn.current(), 900);
      }
    };
    t = setTimeout(next, plan[0]);
    return () => clearTimeout(t);
  }, []);

  const status = ["Verifying…", "Encrypting session…", "Scanning connections…", "Loading dashboard…", "Access granted"][step];
  const width = [12, 40, 66, 88, 100][step];
  const ok = step >= 4;
  const steps = ["Password", "Email code", ...(usedFace ? ["Face ID"] : []), "Session", "Dashboard"];
  const onCount = (usedFace ? 3 : 2) + (step >= 2 ? 1 : 0) + (step >= 4 ? 1 : 0);

  return (
    <div className="ag-overlay ag-fade" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-5">
        <div className={`ag-logo ${ok ? "is-ok" : ""}`}>
          <div className="ag-grid" />
          <svg className="ag-ring" viewBox="0 0 210 210" aria-hidden="true">
            <defs>
              <linearGradient id="agRing" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#3443c7" />
                <stop offset="1" stopColor="#8b9bff" />
              </linearGradient>
            </defs>
            <circle className="track" cx="105" cy="105" r="98" />
            <circle className="spin" cx="105" cy="105" r="98" />
          </svg>
          <ShieldSvg />
        </div>
        <p className="text-sm font-semibold text-slate-500 h-5">{ok ? <b className="text-slate-900">{status}</b> : status}</p>
        <div className={`ag-bar ${ok ? "is-ok" : ""}`}>
          <i style={{ width: `${width}%` }} />
        </div>
        <div className="flex flex-wrap justify-center gap-x-3.5 gap-y-1 text-[11px] text-slate-400 max-w-[360px]">
          {steps.map((s, i) => (
            <span key={s} className={`ag-step ${i < onCount ? "on" : ""}`}>
              {s}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function ShieldSvg() {
  const shield = "M100 38 L156 58 V112 C156 150 132 176 100 192 C68 176 44 150 44 112 V58 Z";
  return (
    <svg className="ag-shield-svg" viewBox="0 0 200 220" aria-hidden="true">
      <defs>
        <linearGradient id="agShield" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4b5be0" />
          <stop offset="1" stopColor="#1e2a8a" />
        </linearGradient>
        <linearGradient id="agShieldOk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#34d399" />
          <stop offset="1" stopColor="#047857" />
        </linearGradient>
        <linearGradient id="agScan" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset=".5" stopColor="#c7d2fe" stopOpacity=".55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id="agClip">
          <path d={shield} />
        </clipPath>
      </defs>
      <path className="ag-shield" d={shield} />
      <g clipPath="url(#agClip)">
        <path className="ag-trace" style={{ animationDelay: ".05s" }} d="M44 78 H64 L72 70 H86" />
        <path className="ag-trace" style={{ animationDelay: ".15s" }} d="M156 78 H136 L128 70 H114" />
        <path className="ag-trace" style={{ animationDelay: ".25s" }} d="M48 140 H66 L74 148" />
        <path className="ag-trace" style={{ animationDelay: ".35s" }} d="M152 140 H134 L126 148" />
        <path className="ag-trace" style={{ animationDelay: ".45s" }} d="M100 40 V56" />
        {[
          [86, 70],
          [114, 70],
          [74, 148],
          [126, 148],
          [100, 58],
        ].map(([cx, cy], i) => (
          <circle key={i} className="ag-node" cx={cx} cy={cy} r={3} style={{ animationDelay: `${0.9 + i * 0.1}s, ${1.2 + i * 0.2}s` }} />
        ))}
        <rect className="ag-scan" x="40" y="100" width="120" height="26" />
      </g>
      <path className="ag-edge" d="M100 46 L149 63.5 V112 C149 145 128 168 100 183 C72 168 51 145 51 112 V63.5 Z" />
      <text className="ag-letters" x="100" y="128" textAnchor="middle">
        AG
      </text>
      <g className="ag-key">
        <circle cx="100" cy="160" r="6" />
        <path d="M97 163 H103 L105 176 H95 Z" />
      </g>
      <g className="ag-badge">
        <circle cx="148" cy="176" r="16" />
        <path d="M140 176 l6 6 l10 -12" />
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Access denied                                                       */
/* ------------------------------------------------------------------ */

function DeniedScreen({ info, onRetry }: { info: Denied; onRetry: () => void }) {
  const [time] = useState(() => new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }));
  const label: Record<Stage, string> = { password: "password", code: "email code", face: "Face ID" };
  return (
    <div className="ag-overlay ag-denied ag-fade" role="alert">
      <div className="text-center px-6">
        <div className="ag-dlogo">
          <div className="ag-dpulse" />
          <svg className="ag-dring" viewBox="0 0 210 210" aria-hidden="true">
            <circle cx="105" cy="105" r="100" />
          </svg>
          <svg className="ag-dsvg" viewBox="0 0 200 220" aria-hidden="true">
            <defs>
              <linearGradient id="agDenied" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#f87171" />
                <stop offset="1" stopColor="#b91c1c" />
              </linearGradient>
            </defs>
            <path className="ag-dshield" d="M100 38 L156 58 V112 C156 150 132 176 100 192 C68 176 44 150 44 112 V58 Z" />
            <path className="ag-dx" d="M80 92 L120 132" />
            <path className="ag-dx b" d="M120 92 L80 132" />
          </svg>
        </div>
        <h2 className="mt-4 text-[26px] font-extrabold text-red-700 tracking-tight">Access denied</h2>
        <p className="text-sm text-red-900 mt-1.5">{info.reason}</p>
        {info.locked ? (
          <p className="inline-block mt-3 text-xs font-semibold text-white bg-red-600 rounded-full px-3 py-1">Locked for 15 minutes</p>
        ) : (
          <p className="mt-2.5 text-xs font-semibold text-red-800">
            {info.left} attempt{info.left === 1 ? "" : "s"} left
          </p>
        )}
        <p className="mt-3.5 mx-auto max-w-[290px] text-[11px] leading-relaxed text-red-700/80">
          Failed {label[info.stage]} attempt at {time}.
          {info.locked ? " An alert was sent to your email." : " If this wasn't you, change your admin password."}
        </p>
        <button type="button" onClick={onRetry} disabled={info.locked} className="ag-btn ag-btn-red mt-5">
          {info.locked ? "Locked" : info.restart ? "Start again" : "Try again"}
        </button>
      </div>
    </div>
  );
}

function Dots({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      {label}
      <span className="ag-dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */

const CSS = `
.ag-card { width: min(92vw, 360px); background: #fff; border: 1px solid #e2e8f0; border-radius: 18px; padding: 28px;
  box-shadow: 0 10px 40px -12px rgba(15,23,42,.18); }
.ag-in { animation: agIn .45s cubic-bezier(.22,1,.36,1) both; }
.ag-shake { animation: agIn .45s cubic-bezier(.22,1,.36,1) both, agShake .5s ease .05s; }
.ag-fade { animation: agFade .45s ease both; }
.ag-input { width: 100%; padding: 10px 14px; border-radius: 10px; background: #f8fafc; border: 1px solid #e2e8f0; color: #0f172a; font-size: 16px; outline: none; transition: border-color .2s, box-shadow .2s, background .2s; }
.ag-input:focus { border-color: #3443c7; box-shadow: 0 0 0 3px rgba(52,67,199,.18); background: #fff; }
.ag-error { margin-top: 12px; font-size: 12px; color: #b91c1c; background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 8px 12px; text-align: center; }
.ag-btn { width: 100%; padding: 11px; border-radius: 10px; background: #3443c7; color: #fff; font-weight: 600; font-size: 14px; cursor: pointer; transition: background .2s, opacity .2s; }
.ag-btn:hover:not(:disabled) { background: #2b36a8; }
.ag-btn:disabled { opacity: .6; cursor: default; }
.ag-btn-red { width: auto; padding: 10px 22px; background: #dc2626; }
.ag-btn-red:hover:not(:disabled) { background: #b91c1c; }
.ag-btn-red:disabled { background: #fca5a5; opacity: 1; }
.ag-dots { display: inline-flex; gap: 3px; }
.ag-dots i { width: 4px; height: 4px; border-radius: 50%; background: currentColor; animation: agDot 1s ease-in-out infinite; }
.ag-dots i:nth-child(2) { animation-delay: .15s; } .ag-dots i:nth-child(3) { animation-delay: .3s; }

.ag-mailicon { width: 52px; height: 52px; border-radius: 16px; background: #eef1ff; color: #3443c7; display: grid; place-items: center; margin: 0 auto 14px; position: relative; }
.ag-mailicon::after { content: ""; position: absolute; right: -3px; top: -3px; width: 12px; height: 12px; border-radius: 50%; background: #10b981; border: 2px solid #fff; animation: agPulse 1.6s ease-in-out infinite; }
.ag-otp { width: 44px; height: 52px; text-align: center; font-size: 22px; font-weight: 700; border-radius: 12px; background: #f8fafc; border: 1px solid #e2e8f0; color: #0f172a; outline: none; transition: border-color .2s, box-shadow .2s, background .2s; }
.ag-otp:focus { border-color: #3443c7; box-shadow: 0 0 0 3px rgba(52,67,199,.18); background: #fff; }
.ag-otp-filled { border-color: #3443c7; background: #fff; }
.ag-otp:disabled { opacity: .6; }
@media (max-width: 360px) { .ag-otp { width: 38px; height: 48px; } }

.ag-cam { position: relative; width: 210px; height: 210px; margin: 0 auto; border-radius: 50%; overflow: hidden;
  background: radial-gradient(circle at 50% 40%, #1e2a8a, #0f172a);
  box-shadow: 0 0 0 4px #fff, 0 0 0 6px #c7d2fe, 0 18px 36px -12px rgba(52,67,199,.45); transition: box-shadow .5s ease, background .5s ease; }
.ag-cam-face { position: absolute; inset: 22%; width: 56%; height: 56%; fill: none; stroke: #a5b4fc; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; transition: opacity .4s ease; }
.ag-cam.is-scan .ag-cam-face, .ag-cam.is-ok .ag-cam-face { opacity: 0; }
.ag-mesh { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; transition: opacity .5s ease; }
.ag-cam.is-scan .ag-mesh { opacity: 1; }
.ag-mesh line { stroke: rgba(165,180,252,.55); stroke-width: .6; }
.ag-mesh circle { fill: #a5b4fc; animation: agBlink 1.2s ease-in-out infinite; }
.ag-beam { position: absolute; left: 0; right: 0; height: 40px; top: -40px; opacity: 0; background: linear-gradient(180deg, transparent, rgba(129,140,248,.65), transparent); }
.ag-cam.is-scan .ag-beam { opacity: 1; animation: agBeam 1.4s ease-in-out infinite; }
.ag-okmark { position: absolute; inset: 0; display: grid; place-items: center; background: rgba(16,185,129,.35); opacity: 0; transition: opacity .4s ease; }
.ag-okmark svg { width: 70px; height: 70px; }
.ag-okmark path { fill: none; stroke: #fff; stroke-width: 5; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 60; stroke-dashoffset: 60; }
.ag-cam.is-ok { background: radial-gradient(circle at 50% 40%, #059669, #064e3b); box-shadow: 0 0 0 4px #fff, 0 0 0 6px #6ee7b7, 0 18px 36px -12px rgba(16,185,129,.45); }
.ag-cam.is-ok .ag-okmark { opacity: 1; }
.ag-cam.is-ok .ag-okmark path { transition: stroke-dashoffset .5s ease .2s; stroke-dashoffset: 0; }
.ag-minibar { height: 6px; border-radius: 99px; background: #e2e8f0; overflow: hidden; margin-top: 10px; }
.ag-minibar i { display: block; height: 100%; background: linear-gradient(90deg, #3443c7, #5b6cf0); transition: width .6s cubic-bezier(.22,1,.36,1), background .4s ease; }
.ag-minibar.is-ok i { background: #10b981; }

.ag-overlay { position: fixed; inset: 0; z-index: 50; display: grid; place-items: center; background: radial-gradient(1200px 600px at 50% 40%, #fff 0%, #f8fafc 60%); }
.ag-logo { position: relative; width: 210px; height: 220px; }
.ag-grid { position: absolute; left: 50%; top: 52%; width: 320px; height: 320px; transform: translate(-50%,-50%);
  background-image: radial-gradient(circle, rgba(52,67,199,.16) 1.2px, transparent 1.3px); background-size: 16px 16px;
  -webkit-mask-image: radial-gradient(circle, #000 30%, transparent 70%); mask-image: radial-gradient(circle, #000 30%, transparent 70%); }
.ag-ring { position: absolute; left: 50%; top: 52%; width: 210px; height: 210px; transform: translate(-50%,-50%); }
.ag-ring circle { fill: none; stroke-width: 3; }
.ag-ring .track { stroke: #e2e8f0; }
.ag-ring .spin { stroke: url(#agRing); stroke-linecap: round; stroke-dasharray: 140 520; transform-origin: center; animation: agSpin 1.1s linear infinite; }
.ag-logo.is-ok .ag-ring .spin { animation: none; stroke: #10b981; stroke-dasharray: 620 0; transition: stroke-dasharray .6s ease, stroke .4s ease; }
.ag-shield-svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.ag-shield { fill: url(#agShield); filter: drop-shadow(0 16px 24px rgba(52,67,199,.30)); transition: fill .5s ease; }
.ag-logo.is-ok .ag-shield { fill: url(#agShieldOk); filter: drop-shadow(0 16px 24px rgba(16,185,129,.30)); }
.ag-edge { fill: none; stroke: #8b9bff; stroke-width: 2; opacity: .55; transition: stroke .5s ease; }
.ag-logo.is-ok .ag-edge { stroke: #6ee7b7; }
.ag-trace { fill: none; stroke: #a5b4fc; stroke-width: 1.6; stroke-linecap: round; opacity: .75; stroke-dasharray: 80; stroke-dashoffset: 80; animation: agDraw 1s ease forwards; }
.ag-logo.is-ok .ag-trace { stroke: #a7f3d0; }
.ag-node { fill: #c7d2fe; opacity: 0; animation: agShow .3s ease forwards, agPulse 1.6s ease-in-out infinite; }
.ag-logo.is-ok .ag-node { fill: #d1fae5; }
.ag-letters { font-weight: 900; font-size: 50px; letter-spacing: 1px; fill: transparent; stroke: #fff; stroke-width: 1.6; stroke-dasharray: 240; stroke-dashoffset: 240;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  animation: agDraw 1.3s ease forwards .35s, agFill .6s ease forwards 1.45s; }
.ag-scan { fill: url(#agScan); animation: agScanY 1.6s ease-in-out infinite; }
.ag-logo.is-ok .ag-scan { animation: none; opacity: 0; }
.ag-key { fill: #fff; opacity: .9; transform-origin: 100px 168px; transition: transform .35s ease, opacity .35s ease; }
.ag-logo.is-ok .ag-key { transform: scale(0); opacity: 0; }
.ag-badge { transform-origin: 148px 176px; transform: scale(0); transition: transform .5s cubic-bezier(.34,1.56,.64,1) .15s; }
.ag-badge circle { fill: #10b981; stroke: #fff; stroke-width: 4; }
.ag-badge path { fill: none; stroke: #fff; stroke-width: 4; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 30; stroke-dashoffset: 30; transition: stroke-dashoffset .4s ease .45s; }
.ag-logo.is-ok .ag-badge { transform: scale(1); }
.ag-logo.is-ok .ag-badge path { stroke-dashoffset: 0; }
.ag-bar { width: 220px; height: 6px; border-radius: 99px; background: #e2e8f0; overflow: hidden; }
.ag-bar i { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #3443c7, #5b6cf0); transition: width .5s cubic-bezier(.22,1,.36,1), background .4s ease; }
.ag-bar.is-ok i { background: #10b981; }
.ag-step { display: inline-flex; align-items: center; gap: 5px; transition: color .3s ease; }
.ag-step::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: #cbd5e1; transition: background .3s ease; }
.ag-step.on { color: #0f172a; }
.ag-step.on::before { background: #10b981; }

.ag-denied { background: radial-gradient(900px 500px at 50% 40%, #fff 0%, #fef2f2 70%); }
.ag-dlogo { position: relative; width: 210px; height: 220px; margin: 0 auto; }
.ag-dring { position: absolute; left: 50%; top: 52%; width: 210px; height: 210px; transform: translate(-50%,-50%); }
.ag-dring circle { fill: none; stroke: #ef4444; stroke-width: 3; stroke-dasharray: 660; stroke-dashoffset: 660; animation: agDash .7s ease forwards .1s; }
.ag-dpulse { position: absolute; left: 50%; top: 52%; width: 210px; height: 210px; border-radius: 50%; transform: translate(-50%,-50%); border: 2px solid #fca5a5; opacity: 0; animation: agAlarm 1.6s ease-out infinite .6s; }
.ag-dsvg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; animation: agShakeBig .55s ease .25s; }
.ag-dshield { fill: url(#agDenied); filter: drop-shadow(0 16px 24px rgba(220,38,38,.32)); }
.ag-dx { fill: none; stroke: #fff; stroke-width: 9; stroke-linecap: round; stroke-dasharray: 60; stroke-dashoffset: 60; animation: agDraw .35s ease forwards .45s; }
.ag-dx.b { animation-delay: .65s; }

@keyframes agIn { from { opacity: 0; transform: translateY(10px) scale(.98); } to { opacity: 1; transform: none; } }
@keyframes agFade { from { opacity: 0; } to { opacity: 1; } }
@keyframes agShake { 10%,90% { transform: translateX(-2px); } 20%,80% { transform: translateX(4px); } 30%,50%,70% { transform: translateX(-6px); } 40%,60% { transform: translateX(6px); } }
@keyframes agShakeBig { 15%,85% { transform: translateX(-4px); } 30%,70% { transform: translateX(8px); } 45%,55% { transform: translateX(-10px); } 50% { transform: translateX(10px); } }
@keyframes agSpin { to { transform: rotate(360deg); } }
@keyframes agDraw { to { stroke-dashoffset: 0; } }
@keyframes agDash { to { stroke-dashoffset: 0; } }
@keyframes agFill { to { fill: #fff; stroke-width: 0; } }
@keyframes agShow { to { opacity: 1; } }
@keyframes agPulse { 50% { opacity: .45; } }
@keyframes agBlink { 50% { opacity: .35; } }
@keyframes agDot { 0%,100% { opacity: .3; transform: translateY(0); } 50% { opacity: 1; transform: translateY(-2px); } }
@keyframes agBeam { 0% { top: -40px; } 100% { top: 100%; } }
@keyframes agScanY { 0% { transform: translateY(-70px); opacity: 0; } 20%,80% { opacity: 1; } 100% { transform: translateY(70px); opacity: 0; } }
@keyframes agAlarm { 0% { opacity: .9; transform: translate(-50%,-50%) scale(1); } 100% { opacity: 0; transform: translate(-50%,-50%) scale(1.35); } }
@media (prefers-reduced-motion: reduce) {
  .ag-auth *, .ag-auth *::before, .ag-auth *::after { animation-duration: 1ms !important; animation-iteration-count: 1 !important; transition-duration: 1ms !important; }
}
`;
