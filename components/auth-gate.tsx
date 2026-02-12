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
        <div className="ambient-gradient-layer pointer-events-none absolute inset-0" />
        <div className="ambient-film-layer pointer-events-none absolute inset-0" />
        <div className="ambient-orb ambient-orb-a pointer-events-none absolute -left-24 top-8 h-72 w-72 rounded-full bg-[#b9d8c2]/32 blur-[84px]" />
        <div className="ambient-orb ambient-orb-b pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-[#bfd4e5]/34 blur-[84px]" />
        <div className="ambient-orb ambient-orb-c pointer-events-none absolute left-1/2 top-1/3 h-56 w-56 -translate-x-1/2 rounded-full bg-[#d7ceb8]/24 blur-[84px]" />

        <section className="relative z-10 w-full max-w-xl rounded-[1.6rem] border border-black/10 bg-panel/95 p-8 shadow-[0_20px_80px_rgba(17,19,24,0.12)] backdrop-blur">
          <div className="mb-6 flex justify-center">
            <Image src="/MP26.svg" alt="M+P Time" width={248} height={52} className="h-11 w-auto sm:h-12" priority />
          </div>

          <h1 className="font-display text-center text-5xl tracking-tight text-ink sm:text-6xl">
            Track the work.
            <br />
            Keep the signal.
          </h1>
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

          <div className="mt-4 flex items-center justify-center text-center text-xs text-muted">
            <span>Only @mondayandpartners.com accounts are allowed.</span>
          </div>

          {!envReady ? (
            <p className="mt-3 rounded-xl border border-danger/25 bg-danger/10 px-3 py-2 text-center text-xs text-danger">
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
