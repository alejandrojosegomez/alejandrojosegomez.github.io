"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

const initial: LoginState = { error: null };

export function LoginForm() {
  const [state, action, pending] = useActionState(login, initial);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <form
        action={action}
        className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl p-7 shadow-[0_10px_40px_-12px_rgba(15,23,42,0.18)]"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <svg className="w-5 h-5 text-[#3443c7]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          className="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#3443c7]/30 focus:border-[#3443c7] focus:bg-white"
        />

        {state.error && (
          <p role="alert" className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-5 w-full py-2.5 rounded-lg bg-[#3443c7] hover:bg-[#2b36a8] disabled:opacity-60 text-white font-semibold text-sm transition cursor-pointer"
        >
          {pending ? "Checking…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
