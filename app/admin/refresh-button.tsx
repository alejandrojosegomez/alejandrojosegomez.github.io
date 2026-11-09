"use client";

import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";

// Botón para recargar los datos + recarga automática cada 60 s.
export function RefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const id = setInterval(() => startTransition(() => router.refresh()), 60_000);
    return () => clearInterval(id);
  }, [router]);

  return (
    <button
      type="button"
      onClick={() => startTransition(() => router.refresh())}
      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold shadow-sm transition cursor-pointer"
    >
      <svg className={`w-3.5 h-3.5 ${pending ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
      {pending ? "Refreshing…" : "Refresh"}
    </button>
  );
}
