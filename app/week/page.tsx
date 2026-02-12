import { AppShell } from "@/components/app-shell";
import { WeekGrid } from "@/components/week-grid";

export default function WeekPage() {
  return (
    <AppShell title="Your Week">
      <WeekGrid />
    </AppShell>
  );
}
