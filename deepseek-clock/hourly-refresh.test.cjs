const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const source = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
  .map(match => match[1]).find(script => script.includes('function startHourlyRefresh('));
const start = source.indexOf('    function startHourlyRefresh(');
const end = source.indexOf('\n    }', start);
assert.ok(start >= 0 && end > start);
const declaration = source.slice(start, end + 6);
const HOUR = 3600000;

function harness() {
  let now = 0;
  let reloads = 0;
  let tick;
  let interval;
  const events = {};
  const document = { hidden: false, addEventListener: (name, callback) => { events[name] = callback; } };
  const navigator = { onLine: true };
  const window = {
    location: { hash: '#provider=ollama', reload: () => { reloads++; } },
    addEventListener: (name, callback) => { events[name] = callback; }
  };
  const context = vm.createContext({
    Date: { now: () => now }, document, navigator, window,
    setInterval(callback, delay) { tick = callback; interval = delay; }
  });
  vm.runInContext(declaration + '\nstartHourlyRefresh();', context);
  return { document, navigator, window, events,
    advance(value) { now = value; }, tick() { tick(); },
    reloads: () => reloads, interval: () => interval };
}

test('Clock reloads once per hour without changing the provider URL', () => {
  const h = harness();
  assert.equal(h.interval(), HOUR);
  h.advance(HOUR - 1);
  h.tick();
  assert.equal(h.reloads(), 0);
  h.advance(HOUR);
  h.tick();
  assert.equal(h.reloads(), 1);
  assert.equal(h.window.location.hash, '#provider=ollama');
  h.events.visibilitychange();
  h.tick();
  assert.equal(h.reloads(), 1, 'Only one navigation is scheduled');
});

test('Suspended tabs refresh on becoming visible only when overdue', () => {
  const h = harness();
  h.advance(HOUR - 1);
  h.events.visibilitychange();
  assert.equal(h.reloads(), 0);
  h.document.hidden = true;
  h.advance(4 * HOUR);
  h.events.visibilitychange();
  assert.equal(h.reloads(), 0);
  h.document.hidden = false;
  h.events.visibilitychange();
  assert.equal(h.reloads(), 1);
});

test('Offline tabs retain their loaded clock and refresh once back online', () => {
  const h = harness();
  h.navigator.onLine = false;
  h.advance(HOUR);
  h.tick();
  h.events.visibilitychange();
  assert.equal(h.reloads(), 0);
  h.navigator.onLine = true;
  h.events.online();
  assert.equal(h.reloads(), 1);
});

test('Refresh starts even when the initial pricing request fails', () => {
  assert.match(source, /startHourlyRefresh\(\);\s*initialize\(\);/);
});
