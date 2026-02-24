"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Time-Based Gradient Background
 *
 * - Animated gradient positions via requestAnimationFrame
 * - Time-based color palettes
 * - Respects prefers-reduced-motion
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

interface GradientState {
  colors: { primary: ColorRGB; secondary: ColorRGB; tertiary: ColorRGB };
  positions: {
    p1: { x: number; y: number };
    p2: { x: number; y: number };
    p3: { x: number; y: number };
  };
}

export function AmbientMotion() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const stateRef = useRef<GradientState>({
    colors: TIME_PALETTES[getTimePeriod(new Date().getHours())],
    positions: {
      p1: { x: 25, y: 20 },
      p2: { x: 75, y: 30 },
      p3: { x: 50, y: 80 },
    },
  });

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const updateGradient = useCallback((state: GradientState) => {
    if (!containerRef.current) return;
    const { colors, positions } = state;

    const gradient = `radial-gradient(ellipse 85% 75% at ${positions.p1.x}% ${positions.p1.y}%, ${rgbaString(colors.primary, 0.7)} 0%, ${rgbaString(colors.primary, 0.35)} 30%, transparent 60%), radial-gradient(ellipse 75% 85% at ${positions.p2.x}% ${positions.p2.y}%, ${rgbaString(colors.secondary, 0.65)} 0%, ${rgbaString(colors.secondary, 0.3)} 35%, transparent 65%), radial-gradient(ellipse 95% 65% at ${positions.p3.x}% ${positions.p3.y}%, ${rgbaString(colors.tertiary, 0.6)} 0%, ${rgbaString(colors.tertiary, 0.25)} 40%, transparent 70%), linear-gradient(to bottom, #f8f9f6 0%, #f5f6f3 100%)`;

    containerRef.current.style.background = gradient;
  }, []);

  useEffect(() => {
    let rafId = 0;
    let lastColorUpdate = 0;
    const startTime = performance.now();

    const tick = (time: number) => {
      const elapsed = time - startTime;

      // Update colors every 30 seconds
      if (time - lastColorUpdate > 30000) {
        const hour = new Date().getHours();
        stateRef.current.colors = TIME_PALETTES[getTimePeriod(hour)];
        lastColorUpdate = time;
      }

      // Animate positions (unless reduced motion)
      if (!reducedMotion) {
        const t = elapsed * 0.001; // Convert to seconds for smoother math
        stateRef.current.positions = {
          p1: {
            x: 25 + Math.sin(t * 0.07) * 20 + Math.cos(t * 0.03) * 10,
            y: 20 + Math.cos(t * 0.05) * 15 + Math.sin(t * 0.04) * 8,
          },
          p2: {
            x: 75 + Math.sin(t * 0.04 + 2) * 18 + Math.cos(t * 0.06) * 12,
            y: 30 + Math.cos(t * 0.06 + 1) * 20 + Math.sin(t * 0.03) * 10,
          },
          p3: {
            x: 50 + Math.sin(t * 0.05 + 4) * 25 + Math.cos(t * 0.04) * 15,
            y: 80 + Math.cos(t * 0.04 + 3) * 12 + Math.sin(t * 0.05) * 8,
          },
        };
      }

      updateGradient(stateRef.current);
      rafId = requestAnimationFrame(tick);
    };

    // Initial render
    updateGradient(stateRef.current);
    rafId = requestAnimationFrame(tick);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [reducedMotion, updateGradient]);

  // Initial gradient for SSR/first paint
  const initialColors = TIME_PALETTES[getTimePeriod(new Date().getHours())];
  const initialGradient = `radial-gradient(ellipse 85% 75% at 25% 20%, ${rgbaString(initialColors.primary, 0.7)} 0%, ${rgbaString(initialColors.primary, 0.35)} 30%, transparent 60%), radial-gradient(ellipse 75% 85% at 75% 30%, ${rgbaString(initialColors.secondary, 0.65)} 0%, ${rgbaString(initialColors.secondary, 0.3)} 35%, transparent 65%), radial-gradient(ellipse 95% 65% at 50% 80%, ${rgbaString(initialColors.tertiary, 0.6)} 0%, ${rgbaString(initialColors.tertiary, 0.25)} 40%, transparent 70%), linear-gradient(to bottom, #f8f9f6 0%, #f5f6f3 100%)`;

  return (
    <div
      ref={containerRef}
      className="pointer-events-none fixed inset-0 z-0"
      aria-hidden="true"
      style={{ background: initialGradient }}
    />
  );
}
