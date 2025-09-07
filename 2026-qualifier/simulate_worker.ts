import { workerData, parentPort } from 'worker_threads';

const { cfg: rawCfg, startIdx, endIdx, workerId } = workerData;

// A simple seeded PRNG (xorshift32)
let seed = (Date.now() + workerId) | 0;
function xorshift32() {
  seed ^= seed << 13;
  seed ^= seed >> 17;
  seed ^= seed << 5;
  return (seed >>> 0) / 0x100000000;
}

const cfg = {
    ...rawCfg,
    teamIdx: new Map(rawCfg.teamIdx),
};

const TEAMS = cfg.teams;
const NUM_TEAMS = TEAMS.length;
type Team = (typeof TEAMS)[number];

interface TallyCount {
  direct: number;
  playoff: number;
  fail: number;
}

const tally: Record<Team, TallyCount> = TEAMS.reduce(
  (acc, t) => ({ ...acc, [t]: { direct: 0, playoff: 0, fail: 0 } }),
  {} as Record<Team, TallyCount>
);

const pts = new Int32Array(cfg.basePts);

for (let s = startIdx; s < endIdx; s++) {
  for (let i = 0; i < NUM_TEAMS; i++) {
    pts[i] = cfg.basePts[i];
  }

  for (const [homeIdx, awayIdx, pHome, pDraw] of cfg.precomputedFixtures) {
    const r = xorshift32();
    if (r < pHome) {
      pts[homeIdx] += 3;
    } else if (r < pHome + pDraw) {
      pts[homeIdx] += 1;
      pts[awayIdx] += 1;
    } else {
      pts[awayIdx] += 3;
    }
  }

  let first = 0, second = 1;
  if (pts[1] > pts[0] || (pts[1] === pts[0] && xorshift32() < 0.5)) {
    first = 1;
    second = 0;
  }

  for (let i = 2; i < NUM_TEAMS; i++) {
    if (pts[i] > pts[first] || (pts[i] === pts[first] && xorshift32() < 0.5)) {
      second = first;
      first = i;
    } else if (pts[i] > pts[second] || (pts[i] === pts[second] && xorshift32() < 0.5)) {
      second = i;
    }
  }

  tally[TEAMS[first]].direct++;
  tally[TEAMS[second]].playoff++;
  for (let i = 0; i < NUM_TEAMS; i++) {
    if (i !== first && i !== second) {
      tally[TEAMS[i]].fail++;
    }
  }
}

parentPort!.postMessage(tally);