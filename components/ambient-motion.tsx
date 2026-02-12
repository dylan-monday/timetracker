"use client";

import { useEffect, useRef } from "react";

// Toggle this to switch between debug (obvious motion) and production (subtle motion)
const DEBUG_MODE = true;

// Debug: high visibility to confirm animation works
// Production: subtle, premium, barely-there motion
const config = DEBUG_MODE
  ? {
      baseOpacity: 0.7,
      accentOpacity: 0.6,
      edgeOpacity: 0.5,
      baseBlur: 24,
      accentBlur: 28,
      edgeBlur: 8,
      // More saturated, visible colors for debug
      baseColor: "rgba(100, 200, 130, 0.5)",
      accentColor: "rgba(100, 160, 220, 0.5)",
      edgeColor: "rgba(180, 160, 120, 0.4)"
    }
  : {
      baseOpacity: 0.35,
      accentOpacity: 0.3,
      edgeOpacity: 0.25,
      baseBlur: 40,
      accentBlur: 44,
      edgeBlur: 20,
      // Subtle, muted colors for production
      baseColor: "rgba(109, 182, 140, 0.25)",
      accentColor: "rgba(116, 163, 213, 0.25)",
      edgeColor: "rgba(180, 165, 140, 0.2)"
    };

export function AmbientMotion() {
  const layerBaseRef = useRef<HTMLDivElement | null>(null);
  const layerAccentRef = useRef<HTMLDivElement | null>(null);
  const layerEdgeRef = useRef<HTMLDivElement | null>(null);
  const probeRef = useRef<HTMLDivElement | null>(null);
  const probeDotRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let rafId = 0;

    const tick = (time: number) => {
      const t = time / 1000;

      // Base layer - green tinted, top-left area
      const baseX = Math.sin(t * 0.16) * 96;
      const baseY = Math.cos(t * 0.14) * 72;
      const baseScale = 1.03 + Math.sin(t * 0.08) * 0.06;
      const baseRotate = Math.sin(t * 0.05) * 5;

      // Accent layer - blue tinted, top-right area
      const accentX = Math.cos(t * 0.13) * 86;
      const accentY = Math.sin(t * 0.15) * 64;
      const accentScale = 1.02 + Math.cos(t * 0.07) * 0.08;
      const accentRotate = Math.cos(t * 0.06) * -7;

      // Edge layer - warm neutral, center area
      const edgeX = Math.sin(t * 0.11) * 64;
      const edgeY = Math.cos(t * 0.12) * 54;
      const edgeScale = 1 + Math.sin(t * 0.09) * 0.05;
      const edgeRotate = Math.cos(t * 0.05) * 4;

      // Probe indicator
      const probeX = Math.sin(t * 1.05) * 22;

      if (layerBaseRef.current) {
        layerBaseRef.current.style.transform = `translate3d(${baseX}px, ${baseY}px, 0) rotate(${baseRotate}deg) scale(${baseScale})`;
      }

      if (layerAccentRef.current) {
        layerAccentRef.current.style.transform = `translate3d(${accentX}px, ${accentY}px, 0) rotate(${accentRotate}deg) scale(${accentScale})`;
      }

      if (layerEdgeRef.current) {
        layerEdgeRef.current.style.transform = `translate3d(${edgeX}px, ${edgeY}px, 0) rotate(${edgeRotate}deg) scale(${edgeScale})`;
      }

      if (probeRef.current) {
        probeRef.current.style.transform = `translate3d(${probeX}px, 0, 0)`;
      }

      if (probeDotRef.current) {
        probeDotRef.current.style.transform = `translate3d(${probeX}px, 0, 0)`;
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-[1] overflow-hidden">
      {/* Base layer - green, top-left */}
      <div
        ref={layerBaseRef}
        className="absolute -left-[20vw] -top-[15vh] h-[80vh] w-[75vw] rounded-[40%]"
        style={{
          background: `radial-gradient(circle at 45% 45%, ${config.baseColor} 0%, transparent 70%)`,
          filter: `blur(${config.baseBlur}px)`,
          opacity: config.baseOpacity
        }}
      />
      {/* Accent layer - blue, top-right */}
      <div
        ref={layerAccentRef}
        className="absolute -right-[18vw] top-[5vh] h-[72vh] w-[65vw] rounded-[35%]"
        style={{
          background: `radial-gradient(circle at 55% 50%, ${config.accentColor} 0%, transparent 70%)`,
          filter: `blur(${config.accentBlur}px)`,
          opacity: config.accentOpacity
        }}
      />
      {/* Edge layer - warm neutral, center */}
      <div
        ref={layerEdgeRef}
        className="absolute left-[20vw] top-[30vh] h-[50vh] w-[50vw] rounded-[30%]"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${config.edgeColor} 0%, transparent 65%)`,
          filter: `blur(${config.edgeBlur}px)`,
          opacity: config.edgeOpacity
        }}
      />
      {/* Motion probe - confirms animation loop is running */}
      {DEBUG_MODE && (
        <div
          ref={probeRef}
          className="fixed bottom-2 left-[5.2rem] z-[70] flex h-4 w-16 items-center rounded-full border border-black/30 bg-black/15 px-1"
        >
          <div ref={probeDotRef} className="h-2 w-2 rounded-full bg-black/70" title="motion probe" />
        </div>
      )}
    </div>
  );
}
