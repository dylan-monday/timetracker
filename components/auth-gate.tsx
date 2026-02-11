"use client";

import { useMemo } from "react";
import Image from "next/image";
import { useAuth } from "@/components/auth-provider";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading, envReady, signInWithGoogle } = useAuth();

  const isAllowedDomain = useMemo(() => {
    if (!user?.email) return false;
    return user.email.toLowerCase().endsWith("@mondayandpartners.com");
  }, [user?.email]);

  if (loading) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-canvas text-sm text-muted">
        <div className="pointer-events-none absolute -left-20 top-10 h-64 w-64 rounded-full bg-accent/25 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-0 h-72 w-72 rounded-full bg-sky-200/30 blur-3xl" />
        Loading your workspace...
      </div>
    );
  }

  if (!user) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-canvas px-4">
        <div className="pointer-events-none absolute -left-24 top-8 h-72 w-72 rounded-full bg-accent/30 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-sky-200/35 blur-3xl" />

        <section className="w-full max-w-xl rounded-[1.6rem] border border-black/10 bg-panel/95 p-8 shadow-[0_20px_80px_rgba(17,19,24,0.12)] backdrop-blur">
          <div className="mb-6 flex items-center justify-between">
            <div className="inline-flex items-center gap-3 rounded-full border border-black/10 bg-white/70 px-3 py-2">
              <Image src="/m26-black-simple.svg" alt="M+P" width={28} height={28} className="h-7 w-7" />
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">M+P Time</span>
            </div>
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-accentStrong shadow-[0_0_14px_rgba(88,200,87,.8)]" />
          </div>

          <h1 className="font-display text-5xl font-semibold tracking-tight text-ink sm:text-6xl">
            Track the work.
            <br />
            Keep the signal.
          </h1>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted">
            A pared-back weekly canvas for creative teams. Fast capture, less admin drag, and clearer
            trend lines.
          </p>

          <button
            type="button"
            className="mt-7 w-full rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-45"
            onClick={() => {
              void signInWithGoogle();
            }}
            disabled={!envReady}
          >
            Continue with Google
          </button>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
            <span>Only @mondayandpartners.com accounts are allowed.</span>
            <span>Default: light, crisp, mobile-first.</span>
          </div>

          {!envReady ? (
            <p className="mt-3 rounded-xl border border-danger/25 bg-danger/10 px-3 py-2 text-xs text-danger">
              Configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to enable sign-in.
            </p>
          ) : null}
        </section>
      </main>
    );
  }

  if (!isAllowedDomain) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas px-4">
        <section className="w-full max-w-md rounded-2xl border border-danger/40 bg-panel p-6 shadow-soft">
          <h1 className="text-lg font-semibold text-ink">Access restricted</h1>
          <p className="mt-2 text-sm text-muted">
            This app is currently limited to mondayandpartners.com email addresses.
          </p>
        </section>
      </main>
    );
  }

  return <>{children}</>;
}
