"use client";

import { useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { startOfWeek, parseISO } from "date-fns";
import { AppShell } from "@/components/app-shell";
import { WeekGrid } from "@/components/week-grid";
import { useAuth } from "@/components/auth-provider";
import { getContextualGreeting, extractFirstName } from "@/lib/greeting";

export default function WeekPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const firstName = useMemo(() => extractFirstName(user), [user]);
  const greeting = useMemo(() => getContextualGreeting(firstName), [firstName]);

  // Parse week start from URL, default to current week
  const weekStart = useMemo(() => {
    const startParam = searchParams.get("start");
    if (startParam) {
      try {
        const parsed = parseISO(startParam);
        // Normalize to Monday of that week
        return startOfWeek(parsed, { weekStartsOn: 1 });
      } catch {
        return startOfWeek(new Date(), { weekStartsOn: 1 });
      }
    }
    return startOfWeek(new Date(), { weekStartsOn: 1 });
  }, [searchParams]);

  // Callback to update URL when navigating weeks
  const onWeekChange = useCallback(
    (newWeekStart: Date) => {
      const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
      const isoDate = newWeekStart.toISOString().split("T")[0];

      // If navigating to current week, remove the param for cleaner URL
      if (newWeekStart.getTime() === currentWeekStart.getTime()) {
        router.push("/week");
      } else {
        router.push(`/week?start=${isoDate}`);
      }
    },
    [router]
  );

  return (
    <AppShell title={greeting}>
      <WeekGrid weekStart={weekStart} onWeekChange={onWeekChange} />
    </AppShell>
  );
}
