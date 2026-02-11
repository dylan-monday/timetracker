"use client";

import { useMemo } from "react";
import { useAuth } from "@/components/auth-provider";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading, envReady, signInWithGoogle } = useAuth();

  const isAllowedDomain = useMemo(() => {
    if (!user?.email) return false;
    return user.email.toLowerCase().endsWith("@mondayandpartners.com");
  }, [user?.email]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas text-sm text-muted">
        Loading your workspace...
      </div>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas px-4">
        <section className="w-full max-w-md rounded-2xl border border-black/10 bg-panel p-6 shadow-soft">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Monday + Partners Time</h1>
          <p className="mt-2 text-sm text-muted">
            Sign in with Google to access your weekly timeline and trends.
          </p>
          <button
            type="button"
            className="mt-5 w-full rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-white"
            onClick={() => {
              void signInWithGoogle();
            }}
            disabled={!envReady}
          >
            Continue with Google
          </button>
          <p className="mt-3 text-xs text-muted">Only @mondayandpartners.com accounts are allowed.</p>
          {!envReady ? (
            <p className="mt-1 text-xs text-danger">
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
