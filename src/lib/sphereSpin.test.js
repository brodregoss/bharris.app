import test from 'node:test';
import assert from 'node:assert/strict';
import {
  identityOrientation,
  initialOrientation,
  orthonormalize,
  project,
  spinLocalYaw,
  spinPitch,
  spinScreen,
  spinYaw,
} from './sphereSpin.js';

function frontLocal(m) {
  return [m[6], m[7], m[8]];
}

function moveFront(m, turn) {
  const [x, y, z] = frontLocal(m);
  turn();
  return project(m, x, y, z);
}

test('a rightward drag moves the front of the sphere right', () => {
  const m = identityOrientation();
  const next = moveFront(m, () => spinYaw(m, 0.25));
  assert.ok(next[0] > 0.2);
  assert.ok(Math.abs(next[1]) < 0.001);
  assert.ok(next[2] > 0.9);
});

test('a downward drag moves the front of the sphere down', () => {
  const m = identityOrientation();
  const next = moveFront(m, () => spinPitch(m, 0.25));
  assert.ok(Math.abs(next[0]) < 0.001);
  assert.ok(next[1] > 0.2);
  assert.ok(next[2] > 0.9);
});

test('drag direction stays put after the sphere rolls past vertical', () => {
  const tumbles = [
    [2.4, -2.2],
    [-3.1, 1.7],
    [0.4, Math.PI],
    [Math.PI, Math.PI],
    [-1.2, 4.2],
  ];
  for (const [yaw, pitch] of tumbles) {
    const right = identityOrientation();
    spinScreen(right, yaw, pitch);
    const rightMove = moveFront(right, () => spinYaw(right, 0.2));
    assert.ok(rightMove[0] > 0.15, `yaw inverted after ${yaw}, ${pitch}`);
    assert.ok(rightMove[2] > 0.9);

    const down = identityOrientation();
    spinScreen(down, yaw, pitch);
    const downMove = moveFront(down, () => spinPitch(down, 0.2));
    assert.ok(downMove[1] > 0.15, `pitch inverted after ${yaw}, ${pitch}`);
    assert.ok(downMove[2] > 0.9);
  }
});

test('the resting tilt matches the original pose', () => {
  const yaw = 0.7;
  const pitch = 0.35;
  const z1 = Math.cos(yaw);
  const expected = [
    Math.sin(yaw),
    -z1 * Math.sin(pitch),
    z1 * Math.cos(pitch),
  ];
  const actual = project(initialOrientation(), 0, 0, 1);
  actual.forEach((value, index) => {
    assert.ok(Math.abs(value - expected[index]) < 1e-10);
  });
});

test('local idle spin keeps the poles on the sphere axis', () => {
  const m = initialOrientation();
  const north = project(m, 0, 1, 0);
  spinLocalYaw(m, 1.3);
  const spun = project(m, 0, 1, 0);
  north.forEach((value, index) => {
    assert.ok(Math.abs(value - spun[index]) < 1e-10);
  });
});

test('orthonormalize keeps a rotation a rotation', () => {
  const m = initialOrientation();
  spinScreen(m, 1.2, -0.8);
  m[0] *= 1.02;
  m[4] *= 0.98;
  orthonormalize(m);
  const x = [m[0], m[1], m[2]];
  const y = [m[3], m[4], m[5]];
  const z = [m[6], m[7], m[8]];
  assert.ok(Math.abs(Math.hypot(...x) - 1) < 1e-10);
  assert.ok(Math.abs(Math.hypot(...y) - 1) < 1e-10);
  assert.ok(Math.abs(x[0] * y[0] + x[1] * y[1] + x[2] * y[2]) < 1e-10);
  const cross = [
    x[1] * y[2] - x[2] * y[1],
    x[2] * y[0] - x[0] * y[2],
    x[0] * y[1] - x[1] * y[0],
  ];
  cross.forEach((value, index) => {
    assert.ok(Math.abs(value - z[index]) < 1e-10);
  });
});
