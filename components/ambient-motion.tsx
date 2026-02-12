"use client";

import { useEffect, useRef } from "react";

export function AmbientMotion() {
  const layerARef = useRef<HTMLDivElement | null>(null);
  const layerBRef = useRef<HTMLDivElement | null>(null);
  const layerCRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let rafId = 0;

    const tick = (time: number) => {
      const t = time / 1000;

      const aX = Math.sin(t * 0.22) * 10;
      const aY = Math.cos(t * 0.18) * 8;
      const aScale = 1.06 + Math.sin(t * 0.14) * 0.08;
      const aOpacity = 0.18 + (Math.sin(t * 0.26) + 1) * 0.08;

      const bX = Math.cos(t * 0.2) * 9;
      const bY = Math.sin(t * 0.24) * 9;
      const bScale = 1.04 + Math.cos(t * 0.16) * 0.09;
      const bOpacity = 0.14 + (Math.cos(t * 0.28) + 1) * 0.075;

      const cX = Math.sin(t * 0.12) * 7;
      const cY = Math.cos(t * 0.16) * 6;
      const cScale = 1.01 + Math.sin(t * 0.2) * 0.06;
      const cOpacity = 0.08 + (Math.sin(t * 0.22) + 1) * 0.05;

      if (layerARef.current) {
        layerARef.current.style.transform = `translate3d(${aX}%, ${aY}%, 0) scale(${aScale})`;
        layerARef.current.style.opacity = String(aOpacity);
      }

      if (layerBRef.current) {
        layerBRef.current.style.transform = `translate3d(${bX}%, ${bY}%, 0) scale(${bScale})`;
        layerBRef.current.style.opacity = String(bOpacity);
      }

      if (layerCRef.current) {
        layerCRef.current.style.transform = `translate3d(${cX}%, ${cY}%, 0) scale(${cScale})`;
        layerCRef.current.style.opacity = String(cOpacity);
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
        className="absolute -left-1/3 -top-1/3 h-[180%] w-[180%] rounded-full blur-[64px]"
        style={{
          background:
            "radial-gradient(circle, rgba(186,214,195,0.5) 0%, rgba(186,214,195,0) 68%)"
        }}
      />
      <div
        ref={layerBRef}
        className="absolute -right-1/3 -bottom-1/3 h-[180%] w-[180%] rounded-full blur-[72px]"
        style={{
          background:
            "radial-gradient(circle, rgba(176,200,221,0.42) 0%, rgba(176,200,221,0) 70%)"
        }}
      />
      <div
        ref={layerCRef}
        className="absolute left-1/4 top-1/4 h-[140%] w-[140%] rounded-full blur-[88px]"
        style={{
          background:
            "radial-gradient(circle, rgba(219,206,183,0.32) 0%, rgba(219,206,183,0) 74%)"
        }}
      />
    </div>
  );
}
