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

      const aX = Math.sin(t * 0.12) * 14;
      const aY = Math.cos(t * 0.1) * 12;
      const aScale = 1.04 + Math.sin(t * 0.08) * 0.06;
      const aRotate = Math.sin(t * 0.06) * 5;

      const bX = Math.cos(t * 0.1) * 12;
      const bY = Math.sin(t * 0.12) * 13;
      const bScale = 1.02 + Math.cos(t * 0.08) * 0.06;
      const bRotate = Math.cos(t * 0.07) * -6;

      const cX = Math.sin(t * 0.06) * 5;
      const cY = Math.cos(t * 0.08) * 5;
      const cScale = 1.01 + Math.sin(t * 0.05) * 0.04;

      if (layerARef.current) {
        layerARef.current.style.transform = `translate3d(${aX}%, ${aY}%, 0) rotate(${aRotate}deg) scale(${aScale})`;
      }

      if (layerBRef.current) {
        layerBRef.current.style.transform = `translate3d(${bX}%, ${bY}%, 0) rotate(${bRotate}deg) scale(${bScale})`;
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
        className="absolute -left-1/3 -top-1/3 h-[180%] w-[180%] rounded-[24%] blur-[8px]"
        style={{
          background: "radial-gradient(circle, rgba(22,40,60,0.28) 0%, rgba(22,40,60,0.06) 60%, rgba(22,40,60,0) 75%)",
          outline: "1px solid rgba(16,34,52,0.22)",
          opacity: 0.28
        }}
      />
      <div
        ref={layerBRef}
        className="absolute -right-1/3 -bottom-1/3 h-[180%] w-[180%] rounded-[22%] blur-[10px]"
        style={{
          background: "radial-gradient(circle, rgba(36,58,84,0.24) 0%, rgba(36,58,84,0.06) 62%, rgba(36,58,84,0) 78%)",
          outline: "1px solid rgba(26,50,76,0.2)",
          opacity: 0.24
        }}
      />
      <div
        ref={layerCRef}
        className="absolute left-1/4 top-1/4 h-[140%] w-[140%] rounded-[28%] blur-[16px]"
        style={{
          background: "radial-gradient(circle, rgba(20,20,24,0.14) 0%, rgba(20,20,24,0.04) 60%, rgba(20,20,24,0) 76%)",
          opacity: 0.16
        }}
      />
    </div>
  );
}
