// Screen-space spin for the home sphere.
// Yaw and pitch are applied in the view, so a drag keeps the same direction
// after the sphere has rolled past the top or bottom.

function rotateX(m, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const a3 = m[3];
  const a4 = m[4];
  const a5 = m[5];
  const a6 = m[6];
  const a7 = m[7];
  const a8 = m[8];
  m[3] = c * a3 - s * a6;
  m[4] = c * a4 - s * a7;
  m[5] = c * a5 - s * a8;
  m[6] = s * a3 + c * a6;
  m[7] = s * a4 + c * a7;
  m[8] = s * a5 + c * a8;
}

function rotateY(m, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const a0 = m[0];
  const a1 = m[1];
  const a2 = m[2];
  const a6 = m[6];
  const a7 = m[7];
  const a8 = m[8];
  m[0] = c * a0 + s * a6;
  m[1] = c * a1 + s * a7;
  m[2] = c * a2 + s * a8;
  m[6] = -s * a0 + c * a6;
  m[7] = -s * a1 + c * a7;
  m[8] = -s * a2 + c * a8;
}

export function identityOrientation() {
  return [1, 0, 0, 0, 1, 0, 0, 0, 1];
}

// +yaw moves the front of the sphere to the right.
export function spinYaw(m, angle) {
  if (angle) rotateY(m, angle);
}

// +pitch moves the front of the sphere down, matching a downward drag.
export function spinPitch(m, angle) {
  if (angle) rotateX(m, -angle);
}

export function spinScreen(m, yaw, pitch) {
  spinYaw(m, yaw);
  spinPitch(m, pitch);
}

// Idle turn around the sphere's own axis, so a tilted ball keeps its tilt.
export function spinLocalYaw(m, angle) {
  if (!angle) return;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const c0 = m[0];
  const c2 = m[2];
  const c3 = m[3];
  const c5 = m[5];
  const c6 = m[6];
  const c8 = m[8];
  m[0] = c * c0 - s * c2;
  m[3] = c * c3 - s * c5;
  m[6] = c * c6 - s * c8;
  m[2] = s * c0 + c * c2;
  m[5] = s * c3 + c * c5;
  m[8] = s * c6 + c * c8;
}

export function orthonormalize(m) {
  let x0 = m[0];
  let x1 = m[1];
  let x2 = m[2];
  let len = Math.hypot(x0, x1, x2) || 1;
  x0 /= len;
  x1 /= len;
  x2 /= len;

  const dot = m[3] * x0 + m[4] * x1 + m[5] * x2;
  let y0 = m[3] - dot * x0;
  let y1 = m[4] - dot * x1;
  let y2 = m[5] - dot * x2;
  len = Math.hypot(y0, y1, y2) || 1;
  y0 /= len;
  y1 /= len;
  y2 /= len;

  m[0] = x0;
  m[1] = x1;
  m[2] = x2;
  m[3] = y0;
  m[4] = y1;
  m[5] = y2;
  m[6] = x1 * y2 - x2 * y1;
  m[7] = x2 * y0 - x0 * y2;
  m[8] = x0 * y1 - x1 * y0;
}

export function project(m, x, y, z) {
  return [
    m[0] * x + m[1] * y + m[2] * z,
    m[3] * x + m[4] * y + m[5] * z,
    m[6] * x + m[7] * y + m[8] * z,
  ];
}

export function initialOrientation() {
  const m = identityOrientation();
  spinYaw(m, 0.7);
  rotateX(m, 0.35);
  return m;
}
