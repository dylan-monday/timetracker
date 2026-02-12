"use client";

import { useEffect, useRef } from "react";

/**
 * Ambient Motion - Living background that reminds you time is passing
 *
 * Design intent (from spec):
 * - "User can immediately perceive that background is alive"
 * - "Calm, intentional, premium" - not frantic or gimmicky
 * - Long cycles (20-60s), gentle pulse via scale/position
 * - Soft atmospheric color masses with diffused edges
 */

export function AmbientMotion() {
  const field1Ref = useRef<HTMLDivElement>(null);
  const field2Ref = useRef<HTMLDivElement>(null);
  const field3Ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    let rafId = 0;

    const tick = (time: number) => {
      const t = time / 1000;

      // Field 1: Green - slow diagonal drift with breathing scale
      // ~45 second full cycle
      const f1x = Math.sin(t * 0.14) * 18 + Math.cos(t * 0.09) * 12;
      const f1y = Math.cos(t * 0.11) * 15 + Math.sin(t * 0.07) * 10;
      const f1scale = 1 + Math.sin(t * 0.08) * 0.12;
      const f1rotate = Math.sin(t * 0.05) * 8;

      // Field 2: Blue - different phase, slightly faster
      // ~35 second full cycle
      const f2x = Math.cos(t * 0.17) * 20 + Math.sin(t * 0.12) * 14;
      const f2y = Math.sin(t * 0.13) * 18 + Math.cos(t * 0.08) * 12;
      const f2scale = 1 + Math.cos(t * 0.1) * 0.1;
      const f2rotate = Math.cos(t * 0.06) * -6;

      // Field 3: Warm amber - slowest, largest movement
      // ~55 second full cycle
      const f3x = Math.sin(t * 0.1) * 22 + Math.cos(t * 0.06) * 16;
      const f3y = Math.cos(t * 0.08) * 20 + Math.sin(t * 0.05) * 14;
      const f3scale = 1 + Math.sin(t * 0.06) * 0.15;
      const f3rotate = Math.sin(t * 0.04) * 10;

      if (field1Ref.current) {
        field1Ref.current.style.transform = `translate3d(${f1x}vw, ${f1y}vh, 0) scale(${f1scale}) rotate(${f1rotate}deg)`;
      }
      if (field2Ref.current) {
        field2Ref.current.style.transform = `translate3d(${f2x}vw, ${f2y}vh, 0) scale(${f2scale}) rotate(${f2rotate}deg)`;
      }
      if (field3Ref.current) {
        field3Ref.current.style.transform = `translate3d(${f3x}vw, ${f3y}vh, 0) scale(${f3scale}) rotate(${f3rotate}deg)`;
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);

    return () => window.cancelAnimationFrame(rafId);
  }, []);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[1] overflow-hidden"
      aria-hidden="true"
    >
      {/* Field 1: Green - positioned upper left, drifts across */}
      <div
        ref={field1Ref}
        className="absolute will-change-transform"
        style={{
          left: "-10%",
          top: "-5%",
          width: "70vw",
          height: "70vh",
          background: "radial-gradient(ellipse 80% 70% at 40% 40%, rgba(120, 200, 140, 0.5) 0%, rgba(120, 200, 140, 0.2) 40%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />

      {/* Field 2: Blue - positioned upper right, counter-drifts */}
      <div
        ref={field2Ref}
        className="absolute will-change-transform"
        style={{
          right: "-15%",
          top: "0%",
          width: "65vw",
          height: "65vh",
          background: "radial-gradient(ellipse 75% 80% at 60% 45%, rgba(110, 170, 220, 0.45) 0%, rgba(110, 170, 220, 0.18) 45%, transparent 70%)",
          filter: "blur(35px)",
        }}
      />

      {/* Field 3: Warm amber - positioned lower center, slow breathe */}
      <div
        ref={field3Ref}
        className="absolute will-change-transform"
        style={{
          left: "10%",
          bottom: "-20%",
          width: "80vw",
          height: "60vh",
          background: "radial-gradient(ellipse 70% 60% at 50% 60%, rgba(220, 185, 120, 0.4) 0%, rgba(220, 185, 120, 0.15) 50%, transparent 75%)",
          filter: "blur(45px)",
        }}
      />
    </div>
  );
}
