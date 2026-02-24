"use client";

import { useAuth } from "@/components/auth-provider";

export function UserPill() {
  const { user, signOut } = useAuth();

  if (!user) return null;

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/85 px-2 py-1">
      <span className="max-w-[120px] truncate px-2 text-xs text-muted sm:max-w-none">{user.email}</span>
      <button
        type="button"
        className="shrink-0 rounded-full border border-black/10 px-3 py-1 text-xs font-medium text-ink"
        onClick={() => {
          void signOut();
        }}
      >
        Sign out
      </button>
    </div>
  );
}
