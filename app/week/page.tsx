"use client";

import { useMemo } from "react";
import { AppShell } from "@/components/app-shell";
import { WeekGrid } from "@/components/week-grid";
import { useAuth } from "@/components/auth-provider";
import { getContextualGreeting, extractFirstName } from "@/lib/greeting";

export default function WeekPage() {
  const { user } = useAuth();
  const firstName = useMemo(() => extractFirstName(user), [user]);
  const greeting = useMemo(() => getContextualGreeting(firstName), [firstName]);

  return (
    <AppShell title={greeting}>
      <WeekGrid />
    </AppShell>
  );
}
