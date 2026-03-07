"use client";

import { useEffect, useRef } from "react";

interface Confetto {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  color: string;
  width: number;
  height: number;
  opacity: number;
  wobble: number;
  wobbleSpeed: number;
  shape: "rect" | "circle" | "strip";
}

const COLORS = [
  "#FF4444", "#4488FF", "#44FF88", "#FFD700",
  "#CC44FF", "#FF8844", "#00FFFF", "#FF00CC",
  "#66FF66", "#FF6699", "#FFFFFF", "#AAD4FF",
];

const BURST_COUNT = 6;
const BURST_INTERVAL = 800;
const PIECES_PER_BURST = 60;

function createConfetto(canvasW: number): Confetto {
  const shape = (["rect", "circle", "strip"] as const)[Math.floor(Math.random() * 3)];
  return {
    x: Math.random() * canvasW,
    y: -(Math.random() * 40 + 10),
    vx: (Math.random() - 0.5) * 6,
    vy: Math.random() * 3 + 2,
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: (Math.random() - 0.5) * 0.15,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    width: shape === "strip" ? Math.random() * 3 + 2 : Math.random() * 8 + 4,
    height: shape === "strip" ? Math.random() * 14 + 8 : Math.random() * 8 + 4,
    opacity: 1,
    wobble: Math.random() * Math.PI * 2,
    wobbleSpeed: Math.random() * 0.08 + 0.03,
    shape,
  };
}

export function Confetti() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const confetti: Confetto[] = [];
    let burstsLeft = BURST_COUNT;

    // Initial burst
    for (let i = 0; i < PIECES_PER_BURST; i++) {
      confetti.push(createConfetto(canvas.width));
    }
    burstsLeft--;

    // Staggered bursts
    const burstTimers: ReturnType<typeof setTimeout>[] = [];
    for (let b = 1; b <= burstsLeft; b++) {
      burstTimers.push(
        setTimeout(() => {
          for (let i = 0; i < PIECES_PER_BURST; i++) {
            confetti.push(createConfetto(canvas.width));
          }
        }, b * BURST_INTERVAL),
      );
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = confetti.length - 1; i >= 0; i--) {
        const c = confetti[i];

        // Physics
        c.vy += 0.12;
        c.vx *= 0.99;
        c.wobble += c.wobbleSpeed;
        c.x += c.vx + Math.sin(c.wobble) * 0.8;
        c.y += c.vy;
        c.rotation += c.rotationSpeed;

        // Fade out near bottom
        if (c.y > canvas.height * 0.75) {
          c.opacity = Math.max(0, 1 - (c.y - canvas.height * 0.75) / (canvas.height * 0.25));
        }

        // Draw
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.rotation);
        ctx.globalAlpha = c.opacity;
        ctx.fillStyle = c.color;

        if (c.shape === "circle") {
          ctx.beginPath();
          ctx.arc(0, 0, c.width / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-c.width / 2, -c.height / 2, c.width, c.height);
        }

        ctx.restore();

        // Remove if off screen or invisible
        if (c.y > canvas.height + 20 || c.opacity <= 0) {
          confetti.splice(i, 1);
        }
      }

      if (confetti.length > 0) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      burstTimers.forEach(clearTimeout);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 9999 }}
    />
  );
}
