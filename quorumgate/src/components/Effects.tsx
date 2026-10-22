"use client";

import { useEffect, useRef, useState } from "react";

const GLYPHS = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#$%&@*";

/** Text that "decrypts": random glyphs resolve left-to-right into the real value when `active` turns on. */
export function ScrambleText({ text, active, delay = 0 }: { text: string; active: boolean; delay?: number }) {
  const [out, setOut] = useState(text);
  const prev = useRef(active);

  useEffect(() => {
    const turnedOn = active && !prev.current;
    prev.current = active;
    if (!turnedOn || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setOut(text);
      return;
    }
    let frame = 0;
    let raf = 0;
    const total = 28 + text.length;
    const start = performance.now() + delay;
    const tick = (now: number) => {
      if (now < start) { raf = requestAnimationFrame(tick); return; }
      frame += 1;
      const resolved = Math.floor((frame / total) * text.length * 1.4);
      setOut(
        text.split("").map((ch, i) => (ch === " " || i < resolved ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0])).join("")
      );
      if (resolved < text.length) raf = requestAnimationFrame(tick);
      else setOut(text);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, active, delay]);

  return <>{out}</>;
}

/** Wallet-card tilt: follows the pointer in 3D and moves a glare highlight. */
export function TiltCard({ className, children }: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || e.pointerType === "touch") return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    el.style.setProperty("--rx", `${(0.5 - y) * 8}deg`);
    el.style.setProperty("--ry", `${(x - 0.5) * 10}deg`);
    el.style.setProperty("--gx", `${x * 100}%`);
    el.style.setProperty("--gy", `${y * 100}%`);
  };
  const reset = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  };
  return (
    <div ref={ref} className={`tilt ${className ?? ""}`} onPointerMove={onMove} onPointerLeave={reset}>
      {children}
      <span className="tilt-glare" aria-hidden="true" />
    </div>
  );
}

/** Soft spotlight that follows the cursor across every `.panel` on the page. */
export function Spotlight() {
  useEffect(() => {
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        document.querySelectorAll<HTMLElement>(".panel").forEach((el) => {
          const r = el.getBoundingClientRect();
          el.style.setProperty("--mx", `${e.clientX - r.left}px`);
          el.style.setProperty("--my", `${e.clientY - r.top}px`);
        });
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => { window.removeEventListener("pointermove", onMove); cancelAnimationFrame(raf); };
  }, []);
  return null;
}

/** Counts up to a number when it changes. */
export function CountUp({ value }: { value: number }) {
  const [n, setN] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now(), a = from.current, b = value;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 500);
      setN(Math.round(a + (b - a) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = b;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{n}</>;
}
