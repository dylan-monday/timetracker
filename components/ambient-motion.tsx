"use client";

import { useEffect, useRef } from "react";

interface Orb {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseOpacity: number;
  opacity: number;
  pulsePhase: number;
  pulseSpeed: number;
}

export function AmbientMotion() {
  const layerBaseRef = useRef<HTMLDivElement | null>(null);
  const layerAccentRef = useRef<HTMLDivElement | null>(null);
  const layerEdgeRef = useRef<HTMLDivElement | null>(null);

  // Store orb state in refs to persist across frames
  const orbsRef = useRef<Orb[]>([
    { x: 10, y: 15, vx: 0.015, vy: 0.012, baseOpacity: 0.55, opacity: 0.55, pulsePhase: 0, pulseSpeed: 0.4 },
    { x: 60, y: 10, vx: -0.012, vy: 0.018, baseOpacity: 0.5, opacity: 0.5, pulsePhase: 2, pulseSpeed: 0.35 },
    { x: 30, y: 50, vx: 0.018, vy: -0.014, baseOpacity: 0.45, opacity: 0.45, pulsePhase: 4, pulseSpeed: 0.45 }
  ]);

  useEffect(() => {
    let rafId = 0;
    let lastTime = 0;

    const tick = (time: number) => {
      const deltaTime = lastTime ? (time - lastTime) / 16.67 : 1; // Normalize to ~60fps
      lastTime = time;
      const t = time / 1000;

      const orbs = orbsRef.current;
      const refs = [layerBaseRef, layerAccentRef, layerEdgeRef];

      // Boundaries for bouncing (percentage of viewport)
      const minX = -15;
      const maxX = 70;
      const minY = -10;
      const maxY = 60;

      orbs.forEach((orb, i) => {
        // Update position
        orb.x += orb.vx * deltaTime;
        orb.y += orb.vy * deltaTime;

        // Bounce off edges with slight randomization
        if (orb.x <= minX || orb.x >= maxX) {
          orb.vx *= -1;
          orb.vx += (Math.random() - 0.5) * 0.004; // Add slight randomness
          orb.x = Math.max(minX, Math.min(maxX, orb.x));
        }
        if (orb.y <= minY || orb.y >= maxY) {
          orb.vy *= -1;
          orb.vy += (Math.random() - 0.5) * 0.004;
          orb.y = Math.max(minY, Math.min(maxY, orb.y));
        }

        // Subtle opacity pulsing
        orb.opacity = orb.baseOpacity + Math.sin(t * orb.pulseSpeed + orb.pulsePhase) * 0.08;

        // Apply transform
        const ref = refs[i];
        if (ref.current) {
          ref.current.style.transform = `translate3d(${orb.x}vw, ${orb.y}vh, 0)`;
          ref.current.style.opacity = String(orb.opacity);
        }
      });

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-[5] overflow-hidden">
      {/* Green orb */}
      <div
        ref={layerBaseRef}
        className="absolute rounded-full"
        style={{
          width: "55vw",
          height: "55vh",
          background: "radial-gradient(circle, rgba(100, 200, 130, 0.7) 0%, rgba(100, 200, 130, 0) 70%)",
          filter: "blur(60px)"
        }}
      />
      {/* Blue orb */}
      <div
        ref={layerAccentRef}
        className="absolute rounded-full"
        style={{
          width: "50vw",
          height: "50vh",
          background: "radial-gradient(circle, rgba(100, 160, 220, 0.65) 0%, rgba(100, 160, 220, 0) 70%)",
          filter: "blur(55px)"
        }}
      />
      {/* Amber/warm orb */}
      <div
        ref={layerEdgeRef}
        className="absolute rounded-full"
        style={{
          width: "45vw",
          height: "45vh",
          background: "radial-gradient(circle, rgba(220, 180, 100, 0.5) 0%, rgba(220, 180, 100, 0) 70%)",
          filter: "blur(50px)"
        }}
      />
    </div>
  );
}
