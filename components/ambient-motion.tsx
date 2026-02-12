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

      const aX = Math.sin(t * 0.08) * 7;
      const aY = Math.cos(t * 0.07) * 6;
      const aScale = 1.04 + Math.sin(t * 0.05) * 0.04;

      const bX = Math.cos(t * 0.09) * 6;
      const bY = Math.sin(t * 0.1) * 7;
      const bScale = 1.03 + Math.cos(t * 0.06) * 0.05;

      const cX = Math.sin(t * 0.06) * 5;
      const cY = Math.cos(t * 0.08) * 5;
      const cScale = 1.01 + Math.sin(t * 0.05) * 0.04;

      if (layerARef.current) {
        layerARef.current.style.transform = `translate3d(${aX}%, ${aY}%, 0) scale(${aScale})`;
      }

      if (layerBRef.current) {
        layerBRef.current.style.transform = `translate3d(${bX}%, ${bY}%, 0) scale(${bScale})`;
      }

      if (layerCRef.current) {
        layerCRef.current.style.transform = `translate3d(${cX}%, ${cY}%, 0) scale(${cScale})`;
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
          background: "radial-gradient(circle, rgba(186,214,195,0.28) 0%, rgba(186,214,195,0) 68%)",
          opacity: 0.22
        }}
      />
      <div
        ref={layerBRef}
        className="absolute -right-1/3 -bottom-1/3 h-[180%] w-[180%] rounded-full blur-[72px]"
        style={{
          background: "radial-gradient(circle, rgba(176,200,221,0.24) 0%, rgba(176,200,221,0) 70%)",
          opacity: 0.2
        }}
      />
      <div
        ref={layerCRef}
        className="absolute left-1/4 top-1/4 h-[140%] w-[140%] rounded-full blur-[88px]"
        style={{
          background: "radial-gradient(circle, rgba(219,206,183,0.18) 0%, rgba(219,206,183,0) 74%)",
          opacity: 0.16
        }}
      />
    </div>
  );
}
