"use client";

import { useEffect, useRef } from "react";

// Toggle this to switch between debug (obvious motion) and production (subtle motion)
const DEBUG_MODE = true;

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

  // Debug: unmissable solid colors. Production: subtle gradients
  const layers = DEBUG_MODE
    ? {
        base: { bg: "#22c55e", opacity: 0.8, blur: 0 }, // solid green
        accent: { bg: "#3b82f6", opacity: 0.7, blur: 0 }, // solid blue
        edge: { bg: "#f59e0b", opacity: 0.6, blur: 0 } // solid amber
      }
    : {
        base: { bg: "rgba(109, 182, 140, 0.3)", opacity: 0.4, blur: 40 },
        accent: { bg: "rgba(116, 163, 213, 0.3)", opacity: 0.35, blur: 44 },
        edge: { bg: "rgba(180, 165, 140, 0.25)", opacity: 0.3, blur: 30 }
      };

  return (
    <div className="pointer-events-none fixed inset-0 z-[5] overflow-hidden">
      {/* Base layer - green, top-left quadrant */}
      <div
        ref={layerBaseRef}
        className="absolute rounded-full"
        style={{
          left: "5%",
          top: "10%",
          width: "50vw",
          height: "50vh",
          background: layers.base.bg,
          filter: layers.base.blur ? `blur(${layers.base.blur}px)` : undefined,
          opacity: layers.base.opacity
        }}
      />
      {/* Accent layer - blue, top-right quadrant */}
      <div
        ref={layerAccentRef}
        className="absolute rounded-full"
        style={{
          right: "5%",
          top: "15%",
          width: "45vw",
          height: "45vh",
          background: layers.accent.bg,
          filter: layers.accent.blur ? `blur(${layers.accent.blur}px)` : undefined,
          opacity: layers.accent.opacity
        }}
      />
      {/* Edge layer - amber, center-bottom */}
      <div
        ref={layerEdgeRef}
        className="absolute rounded-full"
        style={{
          left: "25%",
          top: "40%",
          width: "40vw",
          height: "40vh",
          background: layers.edge.bg,
          filter: layers.edge.blur ? `blur(${layers.edge.blur}px)` : undefined,
          opacity: layers.edge.opacity
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
