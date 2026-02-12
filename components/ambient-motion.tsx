"use client";

import { useEffect, useRef } from "react";

export function AmbientMotion() {
  const layerARef = useRef<HTMLDivElement | null>(null);
  const layerBRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let rafId = 0;

    const tick = (time: number) => {
      const t = time / 1000;

      const aX = Math.sin(t * 0.22) * 5.5;
      const aY = Math.cos(t * 0.18) * 4.5;
      const aScale = 1.05 + Math.sin(t * 0.14) * 0.05;
      const aOpacity = 0.18 + (Math.sin(t * 0.26) + 1) * 0.04;

      const bX = Math.cos(t * 0.2) * 4.8;
      const bY = Math.sin(t * 0.24) * 5.2;
      const bScale = 1.02 + Math.cos(t * 0.16) * 0.06;
      const bOpacity = 0.15 + (Math.cos(t * 0.28) + 1) * 0.035;

      if (layerARef.current) {
        layerARef.current.style.transform = `translate3d(${aX}%, ${aY}%, 0) scale(${aScale})`;
        layerARef.current.style.opacity = String(aOpacity);
      }

      if (layerBRef.current) {
        layerBRef.current.style.transform = `translate3d(${bX}%, ${bY}%, 0) scale(${bScale})`;
        layerBRef.current.style.opacity = String(bOpacity);
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      <div
        ref={layerARef}
        className="absolute -left-1/3 -top-1/3 h-[180%] w-[180%] rounded-full bg-[radial-gradient(circle,rgba(186,214,195,0.34)_0%,rgba(186,214,195,0)_65%)] blur-[64px]"
      />
      <div
        ref={layerBRef}
        className="absolute -right-1/3 -bottom-1/3 h-[180%] w-[180%] rounded-full bg-[radial-gradient(circle,rgba(176,200,221,0.28)_0%,rgba(176,200,221,0)_68%)] blur-[72px]"
      />
    </div>
  );
}
