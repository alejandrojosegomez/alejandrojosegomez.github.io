"use client";

import { startRegistration } from "@simplewebauthn/browser";
import { useState } from "react";
import { beginPasskeySetup, finishPasskeySetup } from "./actions";

function deviceName(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android phone";
  if (/Windows/.test(ua)) return "Windows PC";
  if (/Macintosh/.test(ua)) return "Mac";
  return "Device";
}

export function PasskeySetup({ count }: { count: number }) {
  const [state, setState] = useState<"idle" | "working" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [value, setValue] = useState("");
  const [copied, setCopied] = useState(false);

  const setup = async () => {
    setState("working");
    setMessage("");
    try {
      const begin = await beginPasskeySetup();
      if (!begin.ok) throw new Error(begin.message);
      const resp = await startRegistration({ optionsJSON: begin.options });
      const done = await finishPasskeySetup(resp, deviceName());
      if (!done.ok) throw new Error(done.message);
      setValue(done.value);
      setState("done");
    } catch (err) {
      const text = err instanceof Error ? err.message : "";
      setMessage(/NotAllowed|cancel|timed out/i.test(text) || !text ? "Setup was cancelled. Try again." : text);
      setState("error");
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`w-2.5 h-2.5 rounded-full ${count ? "bg-emerald-500" : "bg-amber-400"}`} />
          <p className="text-sm text-slate-700">
            {count ? (
              <>
                Face ID is <b className="text-slate-900">on</b> · {count} device{count === 1 ? "" : "s"} registered
              </>
            ) : (
              <>
                Face ID is <b className="text-slate-900">not set up yet</b> · sign-in uses password + email code
              </>
            )}
          </p>
        </div>
        {state !== "done" && (
          <button
            type="button"
            onClick={setup}
            disabled={state === "working"}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-sm font-semibold transition cursor-pointer"
          >
            {state === "working" ? "Waiting for your device…" : count ? "Add this device" : "Set up Face ID on this device"}
          </button>
        )}
      </div>

      {state === "error" && <p className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{message}</p>}

      {state === "done" && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-semibold">Device registered. One last step to turn it on:</p>
          <ol className="list-decimal ml-5 mt-2 space-y-1 text-[13px]">
            <li>Copy the value below.</li>
            <li>
              Vercel → your project → Settings → Environment Variables → add <b>ADMIN_PASSKEYS</b> (or edit it if it exists), paste
              the value, check Production and Preview, turn on Sensitive, and Save.
            </li>
            <li>Redeploy (or ask Claude to). From then on, sign-in asks for Face ID.</li>
          </ol>
          <textarea readOnly value={value} rows={3} className="mt-3 w-full rounded-lg border border-emerald-200 bg-white p-2 font-mono text-[11px] text-slate-700" />
          <button
            type="button"
            onClick={copy}
            className="mt-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition cursor-pointer"
          >
            {copied ? "Copied ✓" : "Copy value"}
          </button>
          <p className="mt-2 text-[11px] text-emerald-800/80">This is a public key, not a password. It only works with your device.</p>
        </div>
      )}
    </div>
  );
}
