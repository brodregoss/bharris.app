import React from 'react';
import {
  initialOrientation,
  orthonormalize,
  spinLocalYaw,
  spinScreen,
} from '@/lib/sphereSpin';

const COUNT = 780;
const IDLE_SPIN = 0.0024;
const DRAG = 0.0042;
const MAX_SPEED = 0.05;

function buildPoints(count) {
  const pts = new Array(count);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i += 1) {
    const y = 1 - (i / (count - 1)) * 2;
    const radius = Math.sqrt(1 - y * y);
    const theta = golden * i;
    pts[i] = [Math.cos(theta) * radius, y, Math.sin(theta) * radius];
  }
  return pts;
}

const POINTS = buildPoints(COUNT);
const PHRASE = 'there are 1,200 new millionaires made every day';

export default function DotSphere({ className = '' }) {
  const canvasRef = React.useRef(null);
  const wrapRef = React.useRef(null);
  const textRef = React.useRef(null);
  const motion = React.useRef({
    dragging: false,
    lastX: 0,
    lastY: 0,
    orient: initialOrientation(),
    velYaw: 0,
    velPitch: 0,
    frameUsed: 0,
    open: false,
    spread: 0,
  });

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    let running = true;

    const paint = () => {
      const rect = wrap.getBoundingClientRect();
      const size = Math.max(1, Math.floor(Math.min(rect.width, rect.height)));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const px = Math.floor(size * dpr);
      if (canvas.width !== px || canvas.height !== px) {
        canvas.width = px;
        canvas.height = px;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);

      const spin = motion.current;
      spin.frameUsed = 0;
      if (!spin.dragging) {
        spinScreen(spin.orient, spin.velYaw, spin.velPitch);
        spin.velYaw *= 0.99;
        spin.velPitch *= 0.99;
        if (!reduce && Math.hypot(spin.velYaw, spin.velPitch) < 0.0015) {
          spinLocalYaw(spin.orient, IDLE_SPIN);
        }
      }
      orthonormalize(spin.orient);

      const color = getComputedStyle(canvas).color || '#fff';
      const cx = size / 2;
      const cy = size / 2;
      const radius = size * 0.46;
      const target = spin.open ? 1 : 0;
      if (reduce) spin.spread = target;
      else spin.spread += (target - spin.spread) * 0.14;
      if (Math.abs(target - spin.spread) < 0.004) spin.spread = target;
      const spread = spin.spread;
      if (textRef.current) {
        textRef.current.style.opacity = String(spread);
        textRef.current.hidden = spread === 0;
      }
      const outer = radius * (1 + spread * 0.04);
      const hole = spread * radius * 0.56;
      const m = spin.orient;
      const dots = new Array(POINTS.length);
      for (let i = 0; i < POINTS.length; i += 1) {
        const [x0, y0, z0] = POINTS[i];
        dots[i] = {
          x: m[0] * x0 + m[1] * y0 + m[2] * z0,
          y: m[3] * x0 + m[4] * y0 + m[5] * z0,
          z: m[6] * x0 + m[7] * y0 + m[8] * z0,
        };
      }
      dots.sort((a, b) => a.z - b.z);
      for (const dot of dots) {
        const depth = (dot.z + 1) / 2;
        const radial = Math.hypot(dot.x, dot.y);
        const dist = hole + radial * (outer - hole);
        const ang = radial > 0.0001 ? Math.atan2(dot.y, dot.x) : 0;
        ctx.globalAlpha = 0.28 + depth * 0.72;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(ang) * dist, cy + Math.sin(ang) * dist, 1.15 + depth * 2.7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const loop = () => {
      if (!running) return;
      paint();
      frame = window.requestAnimationFrame(loop);
    };
    frame = window.requestAnimationFrame(loop);
    return () => {
      running = false;
      window.cancelAnimationFrame(frame);
    };
  }, []);

  const rotateBy = (dx, dy) => {
    const spin = motion.current;
    let yaw = dx * DRAG;
    let pitch = dy * DRAG;
    const room = MAX_SPEED - spin.frameUsed;
    if (room <= 0) return;
    const mag = Math.hypot(yaw, pitch);
    if (mag > room) {
      yaw *= room / mag;
      pitch *= room / mag;
    }
    spin.frameUsed += Math.hypot(yaw, pitch);
    spinScreen(spin.orient, yaw, pitch);
    spin.velYaw = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, spin.velYaw * 0.45 + yaw * 0.85));
    spin.velPitch = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, spin.velPitch * 0.45 + pitch * 0.85));
  };

  return (
    <div
      ref={wrapRef}
      role="application"
      aria-label="Drag to spin. Double-click to open."
      className={`relative cursor-grab touch-none select-none active:cursor-grabbing ${className}`}
      style={{ containerType: 'inline-size' }}
      onDoubleClick={() => {
        motion.current.open = !motion.current.open;
      }}
      onPointerDown={(event) => {
        const spin = motion.current;
        spin.dragging = true;
        spin.velYaw = 0;
        spin.velPitch = 0;
        spin.lastX = event.clientX;
        spin.lastY = event.clientY;
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const spin = motion.current;
        if (!spin.dragging) return;
        rotateBy(event.clientX - spin.lastX, event.clientY - spin.lastY);
        spin.lastX = event.clientX;
        spin.lastY = event.clientY;
      }}
      onPointerUp={(event) => {
        motion.current.dragging = false;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      }}
      onPointerCancel={() => {
        motion.current.dragging = false;
      }}
    >
      <canvas ref={canvasRef} className="h-full w-full text-foreground" aria-hidden="true" />
      <p
        ref={textRef}
        hidden
        className="pointer-events-none absolute left-1/2 top-1/2 w-[38%] -translate-x-1/2 -translate-y-1/2 text-center font-normal leading-snug text-foreground"
        style={{ opacity: 0, fontSize: 'clamp(12px, 4.2cqw, 20px)' }}
      >
        {PHRASE}
      </p>
    </div>
  );
}
