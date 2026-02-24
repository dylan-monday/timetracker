"use client";

import { useEffect, useState } from "react";

/**
 * Time-Based Gradient Background
 *
 * Uses CSS animations for smooth gradient movement (better iOS support)
 * and JS only for time-based color changes.
 */

const TIME_PALETTES = {
  morning: {
    primary: { r: 90, g: 170, b: 230 },
    secondary: { r: 60, g: 185, b: 175 },
    tertiary: { r: 185, g: 175, b: 225 },
  },
  midday: {
    primary: { r: 250, g: 200, b: 100 },
    secondary: { r: 120, g: 185, b: 130 },
    tertiary: { r: 255, g: 175, b: 150 },
  },
  afternoon: {
    primary: { r: 245, g: 160, b: 80 },
    secondary: { r: 210, g: 140, b: 120 },
    tertiary: { r: 240, g: 195, b: 100 },
  },
  evening: {
    primary: { r: 255, g: 155, b: 100 },
    secondary: { r: 230, g: 140, b: 160 },
    tertiary: { r: 190, g: 155, b: 185 },
  },
  night: {
    primary: { r: 90, g: 130, b: 190 },
    secondary: { r: 140, g: 120, b: 180 },
    tertiary: { r: 110, g: 115, b: 175 },
  },
} as const;

type TimePeriod = keyof typeof TIME_PALETTES;
type ColorRGB = { r: number; g: number; b: number };

function getTimePeriod(hour: number): TimePeriod {
  if (hour >= 6 && hour < 11) return "morning";
  if (hour >= 11 && hour < 14) return "midday";
  if (hour >= 14 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

function rgbaString(color: ColorRGB, alpha: number): string {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
}

function getColorsForTime(hour: number): { primary: ColorRGB; secondary: ColorRGB; tertiary: ColorRGB } {
  return TIME_PALETTES[getTimePeriod(hour)];
}

export function AmbientMotion() {
  const [colors, setColors] = useState(() => getColorsForTime(new Date().getHours()));
  const [reducedMotion, setReducedMotion] = useState(false);

  // Update colors based on time (check every minute)
  useEffect(() => {
    const updateColors = () => {
      setColors(getColorsForTime(new Date().getHours()));
    };

    const interval = setInterval(updateColors, 60000);
    return () => clearInterval(interval);
  }, []);

  // Check reduced motion preference
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);

    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // CSS custom properties for the gradient colors
  const cssVars = {
    "--gradient-primary": rgbaString(colors.primary, 0.6),
    "--gradient-primary-fade": rgbaString(colors.primary, 0.25),
    "--gradient-secondary": rgbaString(colors.secondary, 0.55),
    "--gradient-secondary-fade": rgbaString(colors.secondary, 0.2),
    "--gradient-tertiary": rgbaString(colors.tertiary, 0.5),
    "--gradient-tertiary-fade": rgbaString(colors.tertiary, 0.15),
  } as React.CSSProperties;

  return (
    <>
      <style>{`
        @keyframes drift1 {
          0%, 100% { transform: translate(0%, 0%); }
          25% { transform: translate(10%, 5%); }
          50% { transform: translate(-5%, 10%); }
          75% { transform: translate(-10%, -5%); }
        }
        @keyframes drift2 {
          0%, 100% { transform: translate(0%, 0%); }
          25% { transform: translate(-8%, 8%); }
          50% { transform: translate(8%, -4%); }
          75% { transform: translate(4%, 6%); }
        }
        @keyframes drift3 {
          0%, 100% { transform: translate(0%, 0%); }
          25% { transform: translate(6%, -8%); }
          50% { transform: translate(-10%, 5%); }
          75% { transform: translate(8%, 8%); }
        }
        .gradient-layer {
          position: absolute;
          inset: -20%;
          border-radius: 50%;
          filter: blur(60px);
        }
        .gradient-1 {
          background: radial-gradient(ellipse at center, var(--gradient-primary) 0%, var(--gradient-primary-fade) 40%, transparent 70%);
          animation: drift1 45s ease-in-out infinite;
        }
        .gradient-2 {
          background: radial-gradient(ellipse at center, var(--gradient-secondary) 0%, var(--gradient-secondary-fade) 40%, transparent 70%);
          animation: drift2 50s ease-in-out infinite;
        }
        .gradient-3 {
          background: radial-gradient(ellipse at center, var(--gradient-tertiary) 0%, var(--gradient-tertiary-fade) 40%, transparent 70%);
          animation: drift3 55s ease-in-out infinite;
        }
        .no-motion .gradient-layer {
          animation: none !important;
        }
      `}</style>
      <div
        className={`pointer-events-none fixed inset-0 z-0 overflow-hidden ${reducedMotion ? "no-motion" : ""}`}
        style={{ backgroundColor: "#f5f6f3", ...cssVars }}
        aria-hidden="true"
      >
        <div className="gradient-layer gradient-1" style={{ top: "-10%", left: "-10%" }} />
        <div className="gradient-layer gradient-2" style={{ top: "10%", right: "-15%" }} />
        <div className="gradient-layer gradient-3" style={{ bottom: "-5%", left: "20%" }} />
      </div>
    </>
  );
}
