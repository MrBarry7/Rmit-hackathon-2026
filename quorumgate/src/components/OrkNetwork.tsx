"use client";

import { useEffect, useRef } from "react";

// Animated picture of what makes Tide different: an identity key that exists only as SHARDS spread
// across a decentralised network of nodes (ORKs). Pulses travel between nodes toward the centre,
// where the key only "forms" momentarily when enough shards cooperate — no node ever holds it whole.
// Purely decorative; respects prefers-reduced-motion.
export function OrkNetwork({ className, nodes = 22, threshold = 14 }: { className?: string; nodes?: number; threshold?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;

    let w = 0, h = 0, raf = 0, t = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    type Node = { a: number; r: number; speed: number; wob: number; x: number; y: number; lit: number };
    const ns: Node[] = Array.from({ length: nodes }, (_, i) => ({
      a: (i / nodes) * Math.PI * 2 + Math.random() * 0.25,
      r: 0.62 + Math.random() * 0.34,
      speed: (0.0006 + Math.random() * 0.0006) * (i % 2 ? 1 : -1),
      wob: Math.random() * Math.PI * 2,
      x: 0, y: 0, lit: 0,
    }));
    type Pulse = { from: number; to: number; p: number; v: number; toCore: boolean };
    let pulses: Pulse[] = [];
    let coreGlow = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width; h = rect.height;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    const spawn = () => {
      const from = Math.floor(Math.random() * nodes);
      const toCore = Math.random() < 0.45;
      const to = toCore ? -1 : (from + 1 + Math.floor(Math.random() * 4)) % nodes;
      pulses.push({ from, to, p: 0, v: 0.008 + Math.random() * 0.01, toCore });
    };

    const draw = () => {
      t += 1;
      const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.46;
      const isDark = dark();
      const line = isDark ? "rgba(140,150,255," : "rgba(80,90,220,";
      ctx.clearRect(0, 0, w, h);

      for (const n of ns) {
        n.a += reduce ? 0 : n.speed;
        const rr = R * (n.r + Math.sin(t * 0.01 + n.wob) * 0.02);
        n.x = cx + Math.cos(n.a) * rr;
        n.y = cy + Math.sin(n.a) * rr * 0.78;
        n.lit *= 0.95;
      }

      // mesh
      for (let i = 0; i < nodes; i++) {
        for (let j = i + 1; j < nodes; j++) {
          const d = Math.hypot(ns[i].x - ns[j].x, ns[i].y - ns[j].y);
          if (d < R * 0.75) {
            ctx.strokeStyle = `${line}${(1 - d / (R * 0.75)) * 0.22})`;
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(ns[i].x, ns[i].y); ctx.lineTo(ns[j].x, ns[j].y); ctx.stroke();
          }
        }
        ctx.strokeStyle = `${line}0.05)`;
        ctx.beginPath(); ctx.moveTo(ns[i].x, ns[i].y); ctx.lineTo(cx, cy); ctx.stroke();
      }

      // pulses
      if (!reduce && t % 9 === 0 && pulses.length < 26) spawn();
      pulses = pulses.filter((p) => {
        p.p += p.v;
        const a = ns[p.from];
        const bx = p.toCore ? cx : ns[p.to].x, by = p.toCore ? cy : ns[p.to].y;
        const x = a.x + (bx - a.x) * p.p, y = a.y + (by - a.y) * p.p;
        const g = ctx.createRadialGradient(x, y, 0, x, y, 7);
        g.addColorStop(0, p.toCore ? "rgba(52,199,89,0.95)" : "rgba(10,132,255,0.95)");
        g.addColorStop(1, "rgba(10,132,255,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill();
        if (p.p >= 1) {
          if (p.toCore) coreGlow = Math.min(1, coreGlow + 1 / threshold * 3);
          else ns[p.to].lit = 1;
          return false;
        }
        return true;
      });

      // nodes (each holds a shard)
      for (const n of ns) {
        ctx.fillStyle = isDark ? "rgba(28,28,30,0.95)" : "rgba(255,255,255,0.95)";
        ctx.strokeStyle = `rgba(94,92,230,${0.55 + n.lit * 0.45})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(n.x, n.y, 6 + n.lit * 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = `rgba(94,92,230,${0.6 + n.lit * 0.4})`;
        ctx.beginPath(); ctx.arc(n.x, n.y, 2.2, 0, Math.PI * 2); ctx.fill();
      }

      // core: the key only appears while enough shards cooperate, then dissolves again
      coreGlow *= 0.985;
      const cr = 16 + coreGlow * 14;
      const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, cr * 3);
      cg.addColorStop(0, `rgba(52,199,89,${0.25 + coreGlow * 0.5})`);
      cg.addColorStop(1, "rgba(52,199,89,0)");
      ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(cx, cy, cr * 3, 0, Math.PI * 2); ctx.fill();
      ctx.setLineDash([3, 5]);
      ctx.strokeStyle = `rgba(52,199,89,${0.35 + coreGlow * 0.6})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, cr, t * 0.01, t * 0.01 + Math.PI * 2 * Math.max(coreGlow, 0.08)); ctx.stroke();
      ctx.setLineDash([]);

      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [nodes, threshold]);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
}
