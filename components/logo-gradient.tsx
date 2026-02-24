"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Logo with animated gradient showing through
 * Uses the M+P SVG as a CSS mask so the ambient gradient bleeds through the logo shape
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

interface LogoGradientProps {
  className?: string;
}

export function LogoGradient({ className = "" }: LogoGradientProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({
    colors: TIME_PALETTES[getTimePeriod(new Date().getHours())],
    positions: { p1: { x: 30, y: 30 }, p2: { x: 70, y: 50 }, p3: { x: 50, y: 70 } },
  });

  const updateGradient = useCallback(() => {
    if (!containerRef.current) return;
    const { colors, positions } = stateRef.current;

    // Simpler, bolder gradient for the small logo area
    const gradient = `radial-gradient(ellipse 150% 150% at ${positions.p1.x}% ${positions.p1.y}%, ${rgbaString(colors.primary, 0.9)} 0%, transparent 50%), radial-gradient(ellipse 120% 120% at ${positions.p2.x}% ${positions.p2.y}%, ${rgbaString(colors.secondary, 0.85)} 0%, transparent 55%), radial-gradient(ellipse 140% 140% at ${positions.p3.x}% ${positions.p3.y}%, ${rgbaString(colors.tertiary, 0.8)} 0%, transparent 60%)`;

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
        stateRef.current.colors = TIME_PALETTES[getTimePeriod(new Date().getHours())];
        lastColorUpdate = time;
      }

      // Animate positions
      const t = elapsed * 0.001;
      stateRef.current.positions = {
        p1: {
          x: 30 + Math.sin(t * 0.08) * 25,
          y: 30 + Math.cos(t * 0.06) * 20,
        },
        p2: {
          x: 70 + Math.sin(t * 0.05 + 2) * 20,
          y: 50 + Math.cos(t * 0.07 + 1) * 25,
        },
        p3: {
          x: 50 + Math.sin(t * 0.06 + 4) * 25,
          y: 70 + Math.cos(t * 0.05 + 3) * 15,
        },
      };

      updateGradient();
      rafId = requestAnimationFrame(tick);
    };

    updateGradient();
    rafId = requestAnimationFrame(tick);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [updateGradient]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        WebkitMaskImage: "url(/m26purple.svg)",
        WebkitMaskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskImage: "url(/m26purple.svg)",
        maskSize: "contain",
        maskRepeat: "no-repeat",
        maskPosition: "center",
      }}
      aria-label="M+P Time"
      role="img"
    />
  );
}
