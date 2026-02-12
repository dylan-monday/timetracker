"use client";

import { useEffect, useRef } from "react";

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

      const baseX = Math.sin(t * 0.16) * 96;
      const baseY = Math.cos(t * 0.14) * 72;
      const baseScale = 1.03 + Math.sin(t * 0.08) * 0.06;
      const baseRotate = Math.sin(t * 0.05) * 5;

      const accentX = Math.cos(t * 0.13) * 86;
      const accentY = Math.sin(t * 0.15) * 64;
      const accentScale = 1.02 + Math.cos(t * 0.07) * 0.08;
      const accentRotate = Math.cos(t * 0.06) * -7;

      const edgeX = Math.sin(t * 0.11) * 64;
      const edgeY = Math.cos(t * 0.12) * 54;
      const edgeScale = 1 + Math.sin(t * 0.09) * 0.05;
      const edgeRotate = Math.cos(t * 0.05) * 4;

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
      <div
        ref={layerBaseRef}
        className="absolute -left-[25vw] -top-[18vh] h-[76vh] w-[72vw] rounded-[28%] blur-[32px]"
        style={{
          background:
            "radial-gradient(circle at 42% 42%, rgba(109,182,140,0.36) 0%, rgba(109,182,140,0.16) 48%, rgba(109,182,140,0) 74%)",
          mixBlendMode: "multiply",
          opacity: 0.46
        }}
      />
      <div
        ref={layerAccentRef}
        className="absolute -right-[22vw] top-[8vh] h-[68vh] w-[62vw] rounded-[24%] blur-[34px]"
        style={{
          background:
            "radial-gradient(circle at 50% 48%, rgba(116,163,213,0.38) 0%, rgba(116,163,213,0.18) 50%, rgba(116,163,213,0) 76%)",
          mixBlendMode: "multiply",
          opacity: 0.42
        }}
      />
      <div
        ref={layerEdgeRef}
        className="absolute left-[24vw] top-[34vh] h-[44vh] w-[44vw] rounded-[22%] border border-[#3e5568]/35 blur-[10px]"
        style={{
          background:
            "radial-gradient(circle at 45% 45%, rgba(79,109,135,0.18) 0%, rgba(79,109,135,0.07) 50%, rgba(79,109,135,0) 76%)",
          mixBlendMode: "multiply",
          opacity: 0.34
        }}
      />
      <div
        ref={probeRef}
        className="fixed bottom-2 left-[5.2rem] z-[70] flex h-4 w-16 items-center rounded-full border border-black/20 bg-black/10 px-1"
      >
        <div ref={probeDotRef} className="h-2 w-2 rounded-full bg-black/60" title="motion probe" />
      </div>
    </div>
  );
}
