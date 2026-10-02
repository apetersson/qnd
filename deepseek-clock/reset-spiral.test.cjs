// Run with: node --test deepseek-clock/reset-spiral.test.cjs
// Test the actual inline geometry and animation controller, not a second engine.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

process.env.TZ = 'Europe/Vienna';
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const source = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
  .map(match => match[1]).find(script => script.includes('function resetSpiralGeometry('));
new vm.Script(source);
function declaration(name) {
  const start = source.indexOf(`    function ${name}(`);
  assert.ok(start >= 0, `Missing ${name}`);
  const end = source.indexOf('\n    }', start);
  assert.ok(end > start);
  return source.slice(start, end + 6);
}
const constants = ['MINUTE', 'HOUR', 'CLOCK_CENTER', 'CLOCK_RADIUS', 'RESET_ORBIT_PITCH', 'RESET_ORBIT_TURNS', 'DIAL_TRANSITION_MS']
  .map(name => source.match(new RegExp(`    const ${name} = [^;]+;`))[0]).join('\n');
const functions = ['point', 'dialRange', 'angleForDialMinutes', 'wallMinute', 'dialMinutesOf', 'hourHandAngle', 'resetSpiralGeometry', 'easeInOutCubic'];
const context = vm.createContext({});
vm.runInContext(`${constants}\nlet dialHours = 12;\n${functions.map(declaration).join('\n')}`, context);
const HOUR = 3600000;
const now = new Date('2026-10-02T08:00:00Z');
const radius = point => Math.hypot(point.x - 210, point.y - 210);
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function near(actual, expected, tolerance = 1e-8) {
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} should be near ${expected}`);
}
function geometry(remaining, from, to = from, progress = 0, start = now) {
  return context.resetSpiralGeometry(new Date(start.getTime() + remaining * HOUR), start, from, to, progress);
}
function pathPoints(shape) {
  return [...shape.path.matchAll(/[ML] (-?[\d.]+) (-?[\d.]+)/g)]
    .map(([, x, y]) => ({ x: Number(x), y: Number(y) }));
}

test('Each turn adds one dial period and 14px, with an exact landing time', () => {
  for (const mode of [12, 24]) {
    for (const turns of [0.25, 1, 2, 3, 4]) {
      const shape = geometry(turns * mode, mode);
      near(radius(shape.position), 171 + turns * 14);
      near(radius(shape.landing), 171);
      near(shape.landingAngle - shape.angle, turns * 360);
      assert.equal(shape.beyond, false);
      assert.equal(shape.reached, false);
    }
  }
});

test('Both directions start and finish at exactly the static geometry', () => {
  for (const from of [12, 24]) {
    const to = from === 12 ? 24 : 12;
    for (const remaining of [-1, 0, 0.5, 12, 24, 36, 48, 60, 96, 120]) {
      assert.deepEqual(geometry(remaining, from, to, 0), geometry(remaining, from));
      assert.deepEqual(geometry(remaining, from, to, 1), geometry(remaining, to));
    }
  }
});

test('Every in-between trajectory is an inward spiral, with its star attached', () => {
  for (const remaining of [1, 24, 36, 60, 120]) {
    for (const from of [12, 24]) {
      const to = from === 12 ? 24 : 12;
      for (const progress of [0, 0.125, 0.25, 0.5, 0.75, 0.875, 1]) {
        const shape = geometry(remaining, from, to, progress);
        const points = pathPoints(shape);
        near(distance(points[0], shape.position), 0, 0.008);
        near(distance(points.at(-1), shape.landing), 0, 0.008);
        const outerRadius = radius(shape.position);
        assert.ok(outerRadius > 171, 'Not a circle on the rim');
        points.forEach((point, index) => {
          near(radius(point), outerRadius + (171 - outerRadius) * index / (points.length - 1), 0.008);
        });
        const reverse = geometry(remaining, to, from, 1 - progress);
        near(distance(shape.position, reverse.position), 0);
        near(distance(shape.landing, reverse.landing), 0);
        near(shape.angle, reverse.angle);
        near(shape.landingAngle, reverse.landingAngle);
      }
    }
  }
});

test('Winding stays continuous when a distant reset enters or leaves the four-turn limit', () => {
  for (const from of [12, 24]) {
    const to = from === 12 ? 24 : 12;
    let previous = geometry(60, from, to, 0);
    for (let frame = 1; frame <= 1000; frame++) {
      const shape = geometry(60, from, to, frame / 1000);
      assert.ok(distance(previous.position, shape.position) < 5, 'No cap-boundary jump');
      assert.ok(radius(shape.position) <= 227 + 1e-8);
      assert.ok((radius(shape.position) - radius(previous.position)) * (to - from) < 1e-8);
      previous = shape;
    }
  }
  assert.equal(geometry(60, 12).beyond, true);
  assert.equal(geometry(60, 24).beyond, false);
});

test('Reached timers remain on the landing dot throughout the transition', () => {
  for (const remaining of [-5, 0]) {
    for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
      const shape = geometry(remaining, 12, 24, progress);
      assert.equal(shape.reached, true);
      assert.equal(shape.beyond, false);
      near(distance(shape.position, shape.landing), 0);
    }
  }
});

test('DST changes keep elapsed-hour turns and local-time landing positions', () => {
  for (const start of [new Date('2026-03-28T22:30:00Z'), new Date('2026-10-24T22:30:00Z')]) {
    const at = new Date(start.getTime() + 36 * HOUR);
    assert.notEqual(start.getTimezoneOffset(), at.getTimezoneOffset());
    for (const mode of [12, 24]) {
      const shape = geometry(36, mode, mode, 0, start);
      near(radius(shape.position), 171 + 36 / mode * 14);
      near(shape.landingAngle, context.hourHandAngle(at, mode));
    }
  }
});

function animationHarness({ mode = 12, reduced = false, hidden = false } = {}) {
  const frames = new Map();
  const listeners = new Map();
  const samples = [];
  let sequence = 0;
  const document = {
    hidden,
    addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener: name => listeners.delete(name)
  };
  const harness = vm.createContext({
    samples, document, initialMode: mode,
    window: { matchMedia: () => ({ matches: reduced }) },
    requestAnimationFrame: callback => { frames.set(++sequence, callback); return sequence; },
    cancelAnimationFrame: handle => frames.delete(handle),
    el: { clockWrap: { classList: { add() {}, remove() {} } } }
  });
  vm.runInContext(`
    const DIAL_TRANSITION_MS = 880;
    let dialHours = initialMode, dialTransitioning = false;
    function isResetProfile() { return true; }
    function hourHandAngle(date, mode) { return mode; }
    function saveDialMode() {}
    function updateDialModeUi() {}
    function setHourHandAngle() {}
    function drawTicks() {}
    function prepareDialScaleTransition() { return () => {}; }
    function drawResetMarkers(now, from = dialHours, to = from, progress = 0) { samples.push({ from, to, progress }); }
    function drawRoundClock(now) { drawResetMarkers(now); }
    function applyDialMode() { drawResetMarkers(new Date()); }
    function state() { return { mode: dialHours, busy: dialTransitioning }; }
    ${declaration('easeInOutCubic')}
    ${declaration('animateDialMode')}
  `, harness);
  return { harness, frames, listeners, document, samples, step(timestamp) {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach(callback => callback(timestamp));
  } };
}

test('Animation controller sends intermediate geometry in both directions, then settles', () => {
  for (const mode of [12, 24]) {
    const run = animationHarness({ mode });
    const to = mode === 12 ? 24 : 12;
    run.harness.animateDialMode(to);
    assert.equal(run.harness.state().busy, true);
    run.step(0);
    run.step(440);
    assert.equal(run.samples.at(-1).from, mode);
    assert.equal(run.samples.at(-1).to, to);
    assert.equal(run.samples.at(-1).progress, 0.5);
    run.harness.animateDialMode(mode); // Ignore a second toggle while busy.
    assert.equal(run.harness.state().mode, to);
    run.step(880);
    assert.equal(run.harness.state().busy, false);
    assert.equal(run.samples.at(-1).from, to);
    assert.equal(run.samples.at(-1).to, to);
    assert.equal(run.frames.size, 0);
    assert.equal(run.listeners.size, 0);
  }
});

test('Reduced motion, hidden tabs and visibility interruption never strand the spiral', () => {
  for (const options of [{ reduced: true }, { hidden: true }]) {
    const run = animationHarness(options);
    run.harness.animateDialMode(24);
    assert.equal(run.harness.state().mode, 24);
    assert.equal(run.harness.state().busy, false);
    assert.equal(run.frames.size, 0);
    assert.equal(run.samples.at(-1).to, 24);
  }
  const run = animationHarness();
  run.harness.animateDialMode(24);
  run.step(0);
  run.step(300);
  run.document.hidden = true;
  run.listeners.get('visibilitychange')();
  assert.equal(run.harness.state().busy, false);
  assert.equal(run.samples.at(-1).to, 24);
  assert.equal(run.frames.size, 0);
  assert.equal(run.listeners.size, 0);
});
