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
  'periodKeyAt', 'availableProfiles', 'validatePricingConfig', 'nextBoundary', 'pricingPeriodsBetween',
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
  assert.match(config.profiles.find(p => p.slug === 'ollama').schedule.sourceNote, /retired Sep 25, 2026/);
  assert.doesNotMatch(config.profiles.find(p => p.slug === 'deepseek').model, /alias routed/);
});

test('B.AI October 4 offers switch at exactly 10:00 SGT, not at midnight', () => {
  for (const instant of ['2026-10-03T17:00:00+08:00', '2026-10-04T00:00:00+08:00', '2026-10-04T09:59:59.999+08:00']) {
    assert.equal(sample('bai', instant).key, 'campaign30');
    assert.equal(sample('bai-glm53-flash', instant).badge, '0.3× base');
  }
  for (const instant of ['2026-10-04T10:00:00+08:00', '2026-10-04T02:00:00Z', '2026-10-04T04:00:00+02:00']) {
    assert.equal(sample('bai', instant).badge, '0.6× off-peak');
    assert.equal(sample('bai-glm53-flash', instant).badge, '0.7× base');
  }
  assert.equal(sample('bai', '2026-09-25T14:59:59+08:00').key, 'campaign10');
  assert.equal(sample('bai', '2026-09-25T15:00:00+08:00').key, 'campaign30');
});

test('B.AI 60% offer retains peak/off-peak phases and holiday/weekend exceptions', () => {
  for (const instant of ['2026-10-04T10:30:00+08:00', '2026-10-07T09:30:00+08:00', '2026-10-10T09:30:00+08:00']) {
    assert.equal(sample('bai', instant).key, 'campaign60OffPeak');
  }
  for (const [time, expected] of [
    ['08:59:59', 'campaign60OffPeak'], ['09:00:00', 'campaign60Peak'],
    ['11:59:59', 'campaign60Peak'], ['12:00:00', 'campaign60OffPeak'],
    ['13:59:59', 'campaign60OffPeak'], ['14:00:00', 'campaign60Peak'],
    ['17:59:59', 'campaign60Peak'], ['18:00:00', 'campaign60OffPeak']
  ]) {
    assert.equal(sample('bai', `2026-10-08T${time}+08:00`).key, expected, time);
  }
  assert.equal(sample('bai-v4-pro', '2026-10-08T09:00:00+08:00').badge, '2× idle');
});

test('B.AI outlook shows the changeover and does not invent an offer expiry', () => {
  const before = context.renderedOutlook('bai-glm53-flash', '2026-10-04T01:30:00Z');
  assert.equal(before.periods[0].end.toISOString(), '2026-10-04T02:00:00.000Z');
  assert.match(before.html, /0\.3× base/);
  assert.match(before.html, /0\.7× base/);
  const after = context.renderedOutlook('bai-glm53-flash', '2026-10-04T02:00:00Z');
  assert.equal(after.periods.length, 1);
  assert.equal(after.periods[0].hasKnownEnd, false);
  assert.match(after.html, /Now · Campaign · 70%/);
  assert.doesNotMatch(after.html, /h remaining/);
  const flash = context.renderedOutlook('bai', '2026-10-08T08:30:00+08:00');
  assert.match(flash.html, /0\.6× peak/);
  assert.match(flash.html, /0\.6× off-peak/);
});

test('B.AI model-page offers remain scoped and no new offer has an invented end date', () => {
  for (const [slug, rate, source] of [
    ['bai-glm52', '0.6× base', 'https://docs.b.ai/llmservice/models/glm-5-2/'],
    ['bai-glm53', '0.9× base', 'https://docs.b.ai/llmservice/models/glm-5-3/'],
    ['bai-mimo26-flash', '0.1× base'], ['bai-qwen38-flash', '0.3× base'], ['bai-mimo26-pro', '0.5× base']
  ]) {
    assert.equal(sample(slug, '2026-10-04T10:00:00+08:00').badge, rate);
    if (source) assert.equal(config.profiles.find(p => p.slug === slug).source, source);
  }
  for (const slug of ['bai', 'bai-glm53-flash']) {
    const profile = config.profiles.find(p => p.slug === slug);
    assert.doesNotMatch(profile.kicker + ' ' + profile.policyNote, /Oct 3(?:\s|,|$)/);
    const offers = profile.schedule.overrides.filter(o => o.startAt === '2026-10-04T10:00:00+08:00');
    assert.equal(offers.length, slug === 'bai' ? 2 : 1);
    for (const rule of offers) {
      assert.equal(rule.endAt, undefined);
      assert.equal(rule.endDate, undefined);
    }
  }
});

test('SiliconFlow CN Flash has half-price tokens at 02:00–08:00 every day', () => {
  for (const date of ['2026-10-04', '2026-10-05', '2026-10-08', '2026-10-10']) {
    for (const [time, key, badge] of [
      ['00:00:00', 'peak', '1×'], ['01:59:59', 'peak', '1×'],
      ['02:00:00', 'offPeak', '0.5×'], ['07:59:59', 'offPeak', '0.5×'],
      ['08:00:00', 'peak', '1×'], ['23:59:59', 'peak', '1×']
    ]) {
      const result = sample('siliconflow', date + 'T' + time + '+08:00');
      assert.equal(result.key, key, date + ' ' + time);
      assert.equal(result.badge, badge);
    }
  }
  assert.equal(sample('siliconflow', '2026-10-04T18:00:00Z').key, 'offPeak');
  assert.equal(sample('siliconflow', '2026-10-04T20:00:00+02:00').key, 'offPeak');
  assert.equal(sample('siliconflow', '2026-10-05T00:00:00Z').key, 'peak');
});

test('SiliconFlow outlook spans midnight with real phase ends and no inherited holidays', () => {
  const profile = config.profiles.find(p => p.slug === 'siliconflow');
  assert.equal(profile.model, 'DeepSeek V4 Flash');
  assert.equal(profile.product, 'CN API');
  assert.equal(profile.schedule.publicHolidayDates, undefined);
  assert.match(profile.schedule.sourceNote, /effective Sep 1, 2026/);
  assert.match(profile.schedule.sourceNote, /no published end date/);
  const result = context.renderedOutlook('siliconflow', '2026-10-04T12:00:00+08:00');
  assert.equal(result.periods[0].end.toISOString(), '2026-10-04T18:00:00.000Z');
  assert.equal(result.periods[1].end.toISOString(), '2026-10-05T00:00:00.000Z');
  assert.equal(result.periods[2].end.toISOString(), '2026-10-05T18:00:00.000Z');
  assert.match(result.html, /50% of the standard input, cached-input and output prices/);
  assert.match(result.html, /0\.5×/);
  // The direct API has holiday/weekend exemptions; this CN route does not.
  assert.equal(sample('deepseek', '2026-10-04T12:00:00+08:00').key, 'offPeak');
  assert.equal(sample('siliconflow', '2026-10-04T12:00:00+08:00').key, 'peak');
});

test('Partially verified policies and disabled Codex keep previous verification dates', () => {
  assert.equal(config.profiles.find(p => p.slug === 'aihubmix').verifiedAt, '2026-10-01');
  const codex = config.profiles.find(p => p.slug === 'codex');
  assert.equal(codex.verifiedAt, '2026-10-02');
  assert.equal(codex.enabled, false);
  for (const slug of ['deepseek', 'zai-glm53-flash', 'tencent', 'baidu-qianfan-deepseek', 'baidu-qianfan-glm53']) {
    assert.equal(config.profiles.find(p => p.slug === slug).verifiedAt, '2026-10-02', slug);
  }
  assert.match(config.profiles.find(p => p.slug === 'zai-glm53-flash').policyNote, /final night is unverified/);
  for (const profile of config.profiles.filter(p => !['aihubmix', 'codex', 'deepseek', 'zai-glm53-flash', 'tencent', 'baidu-qianfan-deepseek', 'baidu-qianfan-glm53'].includes(p.slug))) {
    assert.equal(profile.verifiedAt, '2026-10-08', profile.slug);
  }
});

test('Expired Baidu campaign headings describe current standard pricing', () => {
  for (const slug of ['baidu-qianfan-deepseek', 'baidu-qianfan-glm53']) {
    const profile = config.profiles.find(p => p.slug === slug);
    assert.equal(profile.product, 'Qianfan API');
    assert.equal(profile.temporary, false);
    assert.match(profile.source, /\/doc\/qianfan\//);
    assert.doesNotMatch([profile.title, profile.subtitle, profile.kicker].join(' '), /campaign|limited-time|40% off/i);
    assert.match(profile.schedule.sourceNote, /campaign ended Oct 7/);
    assert.doesNotMatch(sample(slug, '2026-10-08T07:01:18Z').key, /^campaign/);
  }
  assert.equal(sample('baidu-qianfan-deepseek', '2026-10-08T07:01:18Z').badge, '2× idle');
  assert.equal(sample('baidu-qianfan-glm53', '2026-10-08T07:01:18Z').badge, '1× base');
  assert.match(config.profiles.find(p => p.slug === 'zai-glm53-flash').policyNote, /campaign has ended/);
});

test('Baidu retains its stated cutoff and explicitly labels the unverified time zone', () => {
  for (const slug of ['baidu-qianfan-deepseek', 'baidu-qianfan-glm53']) {
    const profile = config.profiles.find(p => p.slug === slug);
    assert.equal(profile.verifiedAt, '2026-10-02');
    assert.match(profile.policyNote, /does not explicitly label a time zone/);
    assert.match(profile.schedule.sourceNote, /2026-10-07 23:59/);
    // Existing interpretation: the published 23:59 minute is inclusive, Beijing assumed.
    assert.match(sample(slug, '2026-10-07T15:59:59.999Z').key, /^campaign/);
    assert.doesNotMatch(sample(slug, '2026-10-07T16:00:00Z').key, /^campaign/);
    const outlook = context.renderedOutlook(slug, '2026-10-07T23:30:00+08:00');
    assert.equal(outlook.periods[0].end.toISOString(), '2026-10-07T16:00:00.000Z');
  }
});

test('Z.ai date-only cutoff retains the documented final-night uncertainty', () => {
  assert.equal(sample('zai', '2026-10-07T23:59:59.999+08:00').key, 'promotion');
  assert.equal(sample('zai', '2026-10-08T00:00:00+08:00').key, 'offPeak');
  // Regression for the existing window-start-date interpretation, not provider confirmation.
  assert.equal(sample('zai-glm53-flash', '2026-10-08T08:59:59.999+08:00').key, 'campaign');
  assert.equal(sample('zai-glm53-flash', '2026-10-08T09:00:00+08:00').key, 'offPeak');
  assert.equal(sample('zai-glm53-flash', '2026-10-08T14:00:00+08:00').key, 'peak');
  assert.equal(sample('zai-glm53-flash', '2026-10-08T23:00:00+08:00').key, 'offPeak');
  assert.match(config.profiles.find(p => p.slug === 'zai-glm53-flash').policyNote, /final night is unverified/);
});

test('Expired Qoder Max discounts do not survive their exact end instant', () => {
  assert.equal(sample('qoder-qwen37-max', '2026-09-30T21:59:59+08:00').badge, '0.5× credits');
  for (const instant of ['2026-09-30T22:00:00+08:00', '2026-10-06T23:00:00+08:00', '2026-10-07T04:00:00+08:00']) {
    assert.equal(sample('qoder-qwen37-max', instant).badge, '0.5× credits');
  }
  const result = context.renderedOutlook('qoder-qwen37-max', '2026-10-06T12:00:00+08:00');
  assert.equal(result.periods.length, 1);
  assert.equal(result.periods[0].hasKnownEnd, false);
});
