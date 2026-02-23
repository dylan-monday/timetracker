"use client";

import Link from "next/link";
import { CalendarRange, ChartColumn, Shield } from "lucide-react";
import { clsx } from "clsx";
import type { ReactNode } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { AmbientMotion } from "@/components/ambient-motion";
import { UserPill } from "@/components/user-pill";
import { playSound, type SoundName } from "@/lib/sounds";

interface AppShellProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

const navItems: Array<{ href: string; label: string; icon: typeof CalendarRange; sound: SoundName }> = [
  { href: "/week", label: "Week", icon: CalendarRange, sound: "navWeek" },
  { href: "/trends", label: "Trends", icon: ChartColumn, sound: "navTrends" },
  { href: "/admin", label: "Settings", icon: Shield, sound: "navSettings" }
];

export function AppShell({ title, subtitle, children }: AppShellProps) {
  const pathname = usePathname();

  return (
    <div className="relative min-h-screen overflow-hidden bg-canvas text-ink">
      <AmbientMotion />

      <main className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-8 pt-6 sm:px-8 lg:px-12">
        <header className="flex items-center justify-between rounded-2xl border border-black/5 bg-gradient-to-r from-panel via-white/85 to-panel px-4 py-3 shadow-soft backdrop-blur">
          <div className="flex items-center gap-3">
            <Link href="/week" aria-label="Go to week view">
              <Image
                src="/m26purple.svg"
                alt="M+P Time"
                width={152}
                height={31}
                className="h-7 w-auto sm:h-8"
                priority
              />
            </Link>
          </div>
          <nav className="flex items-center gap-1 rounded-xl border border-black/5 bg-white/60 p-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => !isActive && playSound(item.sound)}
                  className={clsx(
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-all duration-200",
                    isActive
                      ? "bg-white text-ink shadow-[0_1px_0_rgba(0,0,0,0.08)]"
                      : "text-muted hover:bg-black/5 hover:text-ink hover:scale-[1.02] active:scale-[0.98]"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <section className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="font-display text-4xl tracking-tight sm:text-5xl">{title}</h1>
            {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
          </div>
          <UserPill />
        </section>

        {children}
      </main>
    </div>
  );
}
