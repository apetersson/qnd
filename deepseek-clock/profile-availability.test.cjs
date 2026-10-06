// Run with: node --test deepseek-clock/profile-availability.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'pricing.json'), 'utf8'));
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const source = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
  .map(match => match[1]).find(script => script.includes('function availableProfiles('));
function declaration(name) {
  const start = source.indexOf(`    function ${name}(`);
  assert.ok(start >= 0, `Missing ${name}`);
  const end = source.indexOf('\n    }', start);
  return source.slice(start, end + 6);
}
function harness() {
  const context = vm.createContext({ config: structuredClone(config), URLSearchParams });
  const hashChange = source.match(/window\.addEventListener\('hashchange', \(\) => \{([\s\S]*?)\n    \}\);/)[1];
  vm.runInContext(`
    const DAY = 24 * 60 * 60 * 1000;
    let pricingConfig = config, activeProfile, lastTimelineMinute, dialTransitioning = false;
    const window = { location: { hash: '' }, history: {
      replaceState(_state, _title, hash) { window.location.hash = hash; }
    } };
    function node() {
      return { dataset: {}, children: [], setAttribute() {}, addEventListener() {},
        replaceChildren() { this.children = []; },
        append(...children) { this.children.push(...children); },
        appendChild(child) { this.children.push(child); }
      };
    }
    const document = { createElement: node };
    const el = { profileOptions: node() };
    function applyProfileUi() {}
    function updateDialModeUi() {}
    function renderProfileMenu() {}
    function update() {}
    ${['availableProfiles', 'normalizedProviderKey', 'profileIdFromHash', 'syncProfileHash',
      'selectProfile', 'populateProfileMenu', 'isResetProfile', 'validResetInstant',
      'calendarDateNumber', 'isoDateNumber', 'validatePricingConfig'].map(declaration).join('\n')}
    function navigate(hash) { window.location.hash = hash; ${hashChange} }
    function initialSelection(hash) {
      window.location.hash = hash;
      selectProfile(profileIdFromHash() || pricingConfig.defaultProfile, false);
      return activeProfile.id;
    }
    function selected() { return activeProfile.id; }
    function menuIds() { populateProfileMenu(); return el.profileOptions.children.map(option => option.dataset.profileId); }
  `, context);
  return context;
}

test('Codex is reversibly disabled; all other profiles remain available', () => {
  const h = harness();
  const codex = h.config.profiles.find(profile => profile.slug === 'codex');
  assert.equal(codex.enabled, false);
  assert.deepEqual(Array.from(codex.events), [], 'The global reset has been removed');
  const expected = config.profiles.filter(profile => profile.id !== codex.id).map(profile => profile.id);
  assert.deepEqual(Array.from(h.menuIds()), expected);
  h.validatePricingConfig(h.config);
});

test('Disabled slug, provider name and ID fall back to DeepSeek on load and hash changes', () => {
  const h = harness();
  for (const value of ['codex', 'Codex', 'CODEX', 'codex-reset', 'codex_reset']) {
    assert.equal(h.initialSelection('#provider=' + value), 'deepseek-v4');
    h.selectProfile('ollama-deepseek-v4');
    h.navigate('#provider=' + value);
    assert.equal(h.selected(), 'deepseek-v4');
  }
  h.selectProfile('codex-reset');
  assert.equal(h.selected(), 'deepseek-v4', 'Direct selection cannot bypass disabled status');
  assert.equal(h.initialSelection('#provider=ollama'), 'ollama-deepseek-v4');
  assert.equal(h.initialSelection(''), 'deepseek-v4');
});

test('Re-enabling a profile restores both its option and direct links', () => {
  const h = harness();
  h.config.profiles.find(profile => profile.slug === 'codex').enabled = true;
  assert.ok(h.menuIds().includes('codex-reset'));
  assert.equal(h.initialSelection('#provider=codex'), 'codex-reset');
});

test('Disabled defaults are skipped and invalid availability flags are rejected', () => {
  const h = harness();
  h.config.defaultProfile = 'codex-reset';
  assert.equal(h.initialSelection(''), 'deepseek-v4');
  h.config.profiles[0].enabled = 'false';
  assert.throws(() => h.validatePricingConfig(h.config), /Invalid enabled flag/);
  h.config.profiles.forEach(profile => { profile.enabled = false; });
  assert.throws(() => h.validatePricingConfig(h.config), /at least one enabled profile/);
});
