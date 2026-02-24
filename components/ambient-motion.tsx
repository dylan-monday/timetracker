"use client";

import { useEffect, useState } from "react";

/**
 * Time-Based Gradient Background
 * Uses CSS animations with soft gradients (no blur filter for iOS compatibility)
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

export function AmbientMotion() {
  const [colors, setColors] = useState(() => TIME_PALETTES[getTimePeriod(new Date().getHours())]);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const updateColors = () => {
      setColors(TIME_PALETTES[getTimePeriod(new Date().getHours())]);
    };
    const interval = setInterval(updateColors, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Build gradient with very soft edges (no blur needed)
  const gradient = `
    radial-gradient(ellipse 120% 100% at 20% 20%, ${rgbaString(colors.primary, 0.5)} 0%, ${rgbaString(colors.primary, 0.2)} 25%, transparent 50%),
    radial-gradient(ellipse 100% 120% at 80% 30%, ${rgbaString(colors.secondary, 0.45)} 0%, ${rgbaString(colors.secondary, 0.15)} 30%, transparent 55%),
    radial-gradient(ellipse 130% 90% at 50% 90%, ${rgbaString(colors.tertiary, 0.4)} 0%, ${rgbaString(colors.tertiary, 0.1)} 35%, transparent 60%),
    linear-gradient(to bottom, #f8f9f6 0%, #f5f6f3 100%)
  `;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0"
      aria-hidden="true"
      style={{
        background: gradient,
        transition: reducedMotion ? "none" : "background 2s ease-in-out",
      }}
    />
  );
}
