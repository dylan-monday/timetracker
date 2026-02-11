import Link from "next/link";
import { CalendarRange, ChartColumn, Shield } from "lucide-react";
import { clsx } from "clsx";
import type { ReactNode } from "react";
import Image from "next/image";
import { UserPill } from "@/components/user-pill";

interface AppShellProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

const navItems = [
  { href: "/week", label: "Week", icon: CalendarRange },
  { href: "/trends", label: "Trends", icon: ChartColumn },
  { href: "/admin", label: "Admin", icon: Shield }
];

export function AppShell({ title, subtitle, children }: AppShellProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-canvas text-ink">
      <div className="pointer-events-none absolute -left-24 top-6 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
      <div className="pointer-events-none absolute right-8 top-12 h-48 w-48 animate-pulse rounded-full bg-sky-200/30 blur-3xl [animation-duration:4.2s]" />

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-8 pt-6 sm:px-8 lg:px-12">
        <header className="flex items-center justify-between rounded-2xl border border-black/5 bg-panel/90 px-4 py-3 shadow-soft backdrop-blur">
          <div className="flex items-center gap-3">
            <Image src="/MP26.svg" alt="Monday + Partners" width={28} height={28} className="h-7 w-7" />
            <div className="h-2.5 w-2.5 rounded-full bg-accentStrong shadow-[0_0_14px_rgba(88,200,87,.9)]" />
            <span className="text-sm font-semibold tracking-tight">Monday + Partners Time</span>
          </div>
          <nav className="flex items-center gap-1 rounded-xl border border-black/5 bg-white/60 p-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted transition hover:bg-black/5 hover:text-ink"
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
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
            {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
          </div>
          <UserPill />
        </section>

        {children}
      </main>
    </div>
  );
}
