// Run with: node deepseek-clock/pricing.test.cjs
// Exercise the actual inline schedule functions, without a DOM or a duplicate engine.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'pricing.json'), 'utf8'));
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(match => match[1]);
for (const source of scripts) new vm.Script(source);
const source = scripts.find(source => source.includes('function periodKeyAt('));
assert.ok(source, 'Inline pricing engine must exist');
function declaration(name) {
  const start = source.indexOf(`    function ${name}(`);
  assert.ok(start >= 0, `Missing ${name}`);
  const end = source.indexOf('\n    }', start);
  assert.ok(end > start);
  return source.slice(start, end + 6);
}
const functions = [
  'isResetProfile', 'validResetInstant', 'scheduleFormatter', 'zonedParts',
  'scheduleParts', 'scheduleDayParts', 'dateKeyInTimeZone', 'parseClockMinutes',
  'scheduleHasDay', 'isPublicHoliday', 'calendarDateNumber', 'isoDateNumber',
  'matchesScheduleWindow', 'isScheduleOffDay', 'isPeak', 'overridePeriodKey',
  'periodKeyAt', 'validatePricingConfig', 'nextBoundary', 'pricingPeriodsBetween',
  'outlookPeriods', 'isSpecialPeriodKey', 'drawNext24', 'formatWindow', 'sameLocalDate',
  'intervalsBetween', 'specialIntervalsBetween'
];
const context = vm.createContext({ config });
vm.runInContext(`
  const MINUTE = 60000, HOUR = 3600000, DAY = 24 * HOUR;
  const el = { track: {}, windows: {} };
  const fmtTime = new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit' });
  const fmtShortDate = new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric' });
  const WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const scheduleFormatterCache = new Map();
  let activeProfile;
  ${functions.map(declaration).join('\n')}
  validatePricingConfig(config);
  function sample(slug, instant) {
    activeProfile = config.profiles.find(profile => profile.slug === slug);
    if (!activeProfile) throw new Error('Unknown profile: ' + slug);
    const key = periodKeyAt(new Date(instant));
    return { key, badge: activeProfile.periods[key].badge };
  }
  function renderedOutlook(slug, instant) {
    sample(slug, instant);
    const now = new Date(instant);
    drawNext24(now);
    return { periods: outlookPeriods(now), html: el.windows.innerHTML, track: el.track.innerHTML };
  }
  function campaignArc(slug, instant) {
    sample(slug, instant);
    const now = new Date(instant);
    return specialIntervalsBetween(now, new Date(now.getTime() + DAY));
  }
`, context);
function sample(slug, instant) {
  return context.sample(slug, instant);
}

test('JSON and inline JavaScript parse; profiles and URL slugs are unique', () => {
  assert.equal(new Set(config.profiles.map(p => p.id)).size, config.profiles.length);
  assert.equal(new Set(config.profiles.map(p => p.slug)).size, config.profiles.length);
  assert.ok(config.profiles.some(p => p.id === config.defaultProfile));
  for (const p of config.profiles) {
    assert.match(p.verifiedAt, /^\d{4}-\d{2}-\d{2}$/);
    if (p.kind !== 'reset') new Intl.DateTimeFormat('en', { timeZone: p.schedule.timeZone });
  }
});

for (const [model, standard, discounted] of [['max', '0.5× credits', '0.2× credits'], ['plus', '0.1× credits', '0.04× credits']]) {
  const slug = model === 'max' ? 'qoder-qwen38-max' : 'qoder-qwen37-plus';
  test(`${slug}: Service Accounts use 01:00–07:00, including holidays/weekends`, () => {
    for (const date of ['2026-10-02', '2026-10-03']) {
      for (const [time, badge] of [['00:59:59', standard], ['01:00:00', discounted], ['06:59:59', discounted], ['07:00:00', standard], ['22:00:00', standard]]) {
        assert.equal(sample(slug + '-service-account', `${date}T${time}+08:00`).badge, badge, time);
      }
    }
    assert.equal(sample(slug, '2026-10-02T22:00:00+08:00').badge, discounted);
    assert.equal(sample(slug, '2026-10-02T07:00:00+08:00').badge, discounted);
    assert.equal(sample(slug, '2026-10-02T08:00:00+08:00').badge, standard);
  });
}

test('Qoder CN Flash remains free after the superseded September deadline', () => {
  assert.equal(sample('qoder-qwen38-flash', '2026-09-18T09:59:59+08:00').badge, '0.1× credits');
  for (const instant of ['2026-09-18T10:00:00+08:00', '2026-10-01T00:00:00+08:00', '2026-10-02T12:00:00+08:00']) {
    assert.equal(sample('qoder-qwen38-flash', instant).badge, 'Free');
  }
  const profile = config.profiles.find(p => p.slug === 'qoder-qwen38-flash');
  assert.equal(profile.provider, 'Qoder CN');
  assert.match(profile.schedule.sourceNote, /Teams and Enterprise editions are excluded/);
  assert.equal(profile.schedule.overrides[0].endAt, undefined);
});

test('Open-ended offers never display the search horizon as a campaign end', () => {
  const result = context.renderedOutlook('qoder-qwen38-flash', '2026-10-02T12:00:00+08:00');
  assert.equal(result.periods.length, 1);
  assert.equal(result.periods[0].hasKnownEnd, false);
  assert.match(result.html, /Now · Free promotion/);
  assert.doesNotMatch(result.html, /h remaining|Oct 11|Oct 3/);
  assert.match(result.track, /width:100%/);
  const arcs = context.campaignArc('qoder-qwen38-flash', '2026-10-02T12:00:00+08:00');
  assert.equal(arcs.length, 1);
  assert.equal(arcs[0].end - arcs[0].start, 24 * 3600000);
  assert.equal(arcs[0].actualEnd, null);
});

test('Finite offers still show their actual end beyond the 24-hour viewport', () => {
  const result = context.renderedOutlook('baidu-qianfan-glm53', '2026-10-02T12:00:00+08:00');
  assert.equal(result.periods[0].hasKnownEnd, true);
  assert.equal(result.periods[0].end.toISOString(), '2026-10-07T16:00:00.000Z');
  assert.match(result.html, /h remaining/);
});

test('Alibaba Global API uses billing-time day/night list-price discounts', () => {
  for (const date of ['2026-10-02', '2026-10-03']) {
    for (const [time, badge] of [['07:59:59', '0.4× list'], ['08:00:00', '0.8× list'], ['21:59:59', '0.8× list'], ['22:00:00', '0.4× list']]) {
      assert.equal(sample('alibaba-qwen37-plus-api', `${date}T${time}+08:00`).badge, badge);
    }
  }
  const profile = config.profiles.find(p => p.slug === 'alibaba-qwen37-plus-api');
  assert.match(profile.schedule.sourceNote, /excludes regional deployments and the dated/);
});

test('DeepSeek holiday ends October 7; weekends stay off-peak', () => {
  assert.equal(sample('deepseek', '2026-10-07T09:30:00+08:00').key, 'offPeak');
  assert.equal(sample('deepseek', '2026-10-08T09:00:00+08:00').key, 'peak');
  assert.equal(sample('deepseek', '2026-10-08T12:00:00+08:00').key, 'offPeak');
  assert.equal(sample('deepseek', '2026-10-10T09:30:00+08:00').key, 'offPeak');
  assert.equal(sample('tencent', '2026-10-07T09:30:00+08:00').key, 'peak');
});

test('Z.ai all-day discount and Baidu campaign stop after October 7', () => {
  assert.equal(sample('zai', '2026-10-07T14:00:00+08:00').key, 'promotion');
  assert.equal(sample('zai', '2026-10-08T14:00:00+08:00').key, 'peak');
  assert.equal(sample('baidu-qianfan-glm53', '2026-10-07T23:59:59+08:00').key, 'campaign');
  assert.equal(sample('baidu-qianfan-glm53', '2026-10-08T00:00:00+08:00').key, 'peak');
  assert.equal(sample('zai-glm53-flash', '2026-10-02T23:00:00+08:00').key, 'campaign');
  assert.match(config.profiles.find(p => p.slug === 'zai-glm53-flash').periods.campaign.detail, /AutoClaw/);
});

test('Unverified routing is not newly date-stamped; retired names are not advertised', () => {
  assert.equal(config.profiles.find(p => p.slug === 'aihubmix').verifiedAt, '2026-10-01');
  assert.equal(config.profiles.find(p => p.slug === 'ollama').model, 'DeepSeek V4.1 Flash / V4 Pro');
  assert.doesNotMatch(config.profiles.find(p => p.slug === 'deepseek').model, /alias routed/);
});
