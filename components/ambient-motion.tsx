"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Time-Based Gradient Background
 *
 * Design intent:
 * - Background that feels alive without being distracting
 * - Colors shift based on time of day to create temporal awareness
 * - Slow drift animation (30-60s cycles) that's perceivable but calm
 *
 * Technical approach:
 * - Single full-screen div with CSS radial-gradients (NO filter:blur)
 * - Gradient stops animated via CSS custom properties
 * - requestAnimationFrame for smooth position drift
 * - Time-based color palettes with 30-minute blend transitions
 */

// Time period color palettes
// Each has 3 gradient colors: primary, secondary, tertiary
// More saturated and pronounced for that dreamy, Frosti-like atmosphere
const TIME_PALETTES = {
  // Morning (6am-11am): Ethereal dawn - rich sky blue, deep teal, lavender mist
  morning: {
    primary: { r: 90, g: 170, b: 230 },     // rich sky blue
    secondary: { r: 60, g: 185, b: 175 },   // deep teal
    tertiary: { r: 185, g: 175, b: 225 },   // lavender mist
  },
  // Midday (11am-2pm): Warm presence - golden amber, forest sage, coral bloom
  midday: {
    primary: { r: 250, g: 200, b: 100 },    // golden amber
    secondary: { r: 120, g: 185, b: 130 },  // forest sage
    tertiary: { r: 255, g: 175, b: 150 },   // coral bloom
  },
  // Afternoon (2pm-5pm): Honeyed light - deep amber, warm terracotta, wheat gold
  afternoon: {
    primary: { r: 245, g: 160, b: 80 },     // deep amber
    secondary: { r: 210, g: 140, b: 120 },  // warm terracotta
    tertiary: { r: 240, g: 195, b: 100 },   // wheat gold
  },
  // Evening (5pm-9pm): Golden hour glow - sunset peach, rose, dusty mauve
  evening: {
    primary: { r: 255, g: 155, b: 100 },    // sunset peach
    secondary: { r: 230, g: 140, b: 160 },  // rose
    tertiary: { r: 190, g: 155, b: 185 },   // dusty mauve
  },
  // Night (9pm-6am): Deep contemplation - midnight blue, violet, soft indigo
  night: {
    primary: { r: 90, g: 130, b: 190 },     // midnight blue
    secondary: { r: 140, g: 120, b: 180 },  // violet
    tertiary: { r: 110, g: 115, b: 175 },   // soft indigo
  },
} as const;

type TimePeriod = keyof typeof TIME_PALETTES;
type ColorRGB = { r: number; g: number; b: number };

interface GradientState {
  colors: {
    primary: ColorRGB;
    secondary: ColorRGB;
    tertiary: ColorRGB;
  };
  positions: {
    p1: { x: number; y: number };
    p2: { x: number; y: number };
    p3: { x: number; y: number };
  };
}

function getTimePeriod(hour: number): TimePeriod {
  if (hour >= 6 && hour < 11) return "morning";
  if (hour >= 11 && hour < 14) return "midday";
  if (hour >= 14 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

function getBlendFactor(hour: number, minute: number): { current: TimePeriod; next: TimePeriod; blend: number } {
  const totalMinutes = hour * 60 + minute;

  // Transition boundaries (in minutes from midnight)
  const transitions = [
    { start: 5 * 60 + 30, end: 6 * 60, from: "night" as TimePeriod, to: "morning" as TimePeriod },
    { start: 10 * 60 + 30, end: 11 * 60, from: "morning" as TimePeriod, to: "midday" as TimePeriod },
    { start: 13 * 60 + 30, end: 14 * 60, from: "midday" as TimePeriod, to: "afternoon" as TimePeriod },
    { start: 16 * 60 + 30, end: 17 * 60, from: "afternoon" as TimePeriod, to: "evening" as TimePeriod },
    { start: 20 * 60 + 30, end: 21 * 60, from: "evening" as TimePeriod, to: "night" as TimePeriod },
  ];

  for (const t of transitions) {
    if (totalMinutes >= t.start && totalMinutes < t.end) {
      const blend = (totalMinutes - t.start) / (t.end - t.start);
      return { current: t.from, next: t.to, blend };
    }
  }

  const period = getTimePeriod(hour);
  return { current: period, next: period, blend: 0 };
}

function lerpColor(a: ColorRGB, b: ColorRGB, t: number): ColorRGB {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  };
}

function getColorsForTime(hour: number, minute: number) {
  const { current, next, blend } = getBlendFactor(hour, minute);
  const currentPalette = TIME_PALETTES[current];
  const nextPalette = TIME_PALETTES[next];

  return {
    primary: lerpColor(currentPalette.primary, nextPalette.primary, blend),
    secondary: lerpColor(currentPalette.secondary, nextPalette.secondary, blend),
    tertiary: lerpColor(currentPalette.tertiary, nextPalette.tertiary, blend),
  };
}

function rgbaString(color: ColorRGB, alpha: number): string {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
}

export function AmbientMotion() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const stateRef = useRef<GradientState>({
    colors: TIME_PALETTES.morning,
    positions: {
      p1: { x: 25, y: 20 },
      p2: { x: 75, y: 30 },
      p3: { x: 50, y: 80 },
    },
  });

  // Check for debug mode via query param
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setDebugMode(params.get("debug-bg") === "1" || params.get("debug-bg") === "true");
  }, []);

  // Check for reduced motion preference
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);

    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const updateGradient = useCallback((state: GradientState) => {
    if (!containerRef.current) return;

    const { colors, positions } = state;

    // Build the gradient string
    // Using multiple radial gradients layered on top of each other
    // Each gradient is positioned at a different point and drifts slowly
    // More pronounced alphas for that dreamy, immersive feel
    const gradient = `radial-gradient(ellipse 85% 75% at ${positions.p1.x}% ${positions.p1.y}%, ${rgbaString(colors.primary, 0.7)} 0%, ${rgbaString(colors.primary, 0.35)} 30%, transparent 60%), radial-gradient(ellipse 75% 85% at ${positions.p2.x}% ${positions.p2.y}%, ${rgbaString(colors.secondary, 0.65)} 0%, ${rgbaString(colors.secondary, 0.3)} 35%, transparent 65%), radial-gradient(ellipse 95% 65% at ${positions.p3.x}% ${positions.p3.y}%, ${rgbaString(colors.tertiary, 0.6)} 0%, ${rgbaString(colors.tertiary, 0.25)} 40%, transparent 70%)`;

    // Use backgroundImage for the gradients (better mobile support)
    // and backgroundColor for the base color
    containerRef.current.style.backgroundImage = gradient;
    containerRef.current.style.backgroundColor = "#f5f6f3";
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let rafId = 0;
    let lastColorUpdate = 0;
    const startTime = performance.now();

    const tick = (time: number) => {
      const elapsed = time - startTime;

      // In debug mode, complete a full 24-hour cycle in 60 seconds
      // Normal mode uses real time
      let hour: number;
      let minute: number;

      if (debugMode) {
        const debugSeconds = (elapsed / 1000) % 60;
        const debugHours = (debugSeconds / 60) * 24;
        hour = Math.floor(debugHours);
        minute = Math.floor((debugHours % 1) * 60);
      } else {
        const now = new Date();
        hour = now.getHours();
        minute = now.getMinutes();
      }

      // Update colors every second in debug mode, every 30 seconds in normal mode
      const colorUpdateInterval = debugMode ? 100 : 30000;
      if (time - lastColorUpdate > colorUpdateInterval) {
        stateRef.current.colors = getColorsForTime(hour, minute);
        lastColorUpdate = time;
      }

      // Position drift animation (disabled if reduced motion)
      if (!reducedMotion) {
        // Time factor for position animation
        // In debug mode, speed up the drift cycle too
        const driftSpeed = debugMode ? 0.01 : 0.001;
        const t = elapsed * driftSpeed;

        // Each position drifts in a figure-8 / lissajous pattern
        // Different frequencies and phases for organic feel
        // Drift range: roughly 15-85% of screen
        stateRef.current.positions = {
          p1: {
            x: 25 + Math.sin(t * 0.7) * 20 + Math.cos(t * 0.3) * 10,
            y: 20 + Math.cos(t * 0.5) * 15 + Math.sin(t * 0.4) * 8,
          },
          p2: {
            x: 75 + Math.sin(t * 0.4 + 2) * 18 + Math.cos(t * 0.6) * 12,
            y: 30 + Math.cos(t * 0.6 + 1) * 20 + Math.sin(t * 0.3) * 10,
          },
          p3: {
            x: 50 + Math.sin(t * 0.5 + 4) * 25 + Math.cos(t * 0.4) * 15,
            y: 80 + Math.cos(t * 0.4 + 3) * 12 + Math.sin(t * 0.5) * 8,
          },
        };
      }

      updateGradient(stateRef.current);
      rafId = window.requestAnimationFrame(tick);
    };

    // Initial render
    const now = new Date();
    stateRef.current.colors = getColorsForTime(now.getHours(), now.getMinutes());
    updateGradient(stateRef.current);

    rafId = window.requestAnimationFrame(tick);

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [debugMode, reducedMotion, updateGradient]);

  return (
    <>
      <div
        ref={containerRef}
        className="pointer-events-none fixed inset-0 z-0"
        aria-hidden="true"
        style={{
          // Initial background - will be replaced by JS
          backgroundColor: "#f5f6f3",
          // GPU compositing hints for iOS Safari
          transform: "translateZ(0)",
          WebkitTransform: "translateZ(0)",
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
        }}
      />
      {debugMode && (
        <div className="pointer-events-none fixed left-2 top-2 z-[100] rounded bg-black/80 px-2 py-1 font-mono text-[10px] text-white">
          BG Debug: 24h cycle in 60s
        </div>
      )}
    </>
  );
}
