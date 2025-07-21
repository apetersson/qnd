import { workerData, parentPort } from 'worker_threads';

// The workerData contains the config and simulation parameters
const { cfg: rawCfg, startIdx, endIdx } = workerData;

// Re-create methods and Map on the cfg object in the worker context
const cfg = {
    ...rawCfg,
    teamIdx: new Map(rawCfg.teamIdx), // Deserialize Map
};

// Redefine methods that couldn't be cloned
Object.assign(cfg, {
    eloWinProb: function(rA: number, rB: number): number {
      return 1 / (1 + Math.pow(10, (rB - rA) / 400));
    },
    drawProb: function(deltaElo: number): number {
      const w = 1 / (1 + Math.pow(10, -deltaElo / 400));
      return 2 * w * (1 - w) * this.drawR;
    }
});


const TEAMS = cfg.teams;
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

for (let s = startIdx; s < endIdx; s++) {
  const pts: number[] = [...cfg.basePts];

  for (const [homeIdx, awayIdx, pHome, pDraw] of cfg.precomputedFixtures) {
    const r = Math.random();
    if (r < pHome) {
      pts[homeIdx] += 3;
    } else if (r < pHome + pDraw) {
      pts[homeIdx] += 1;
      pts[awayIdx] += 1;
    } else {
      pts[awayIdx] += 3;
    }
  }

  const teamScores: { points: number; tiebreaker: number; index: number }[] = [];
  for (let i = 0; i < pts.length; i++) {
    teamScores.push({ points: pts[i], tiebreaker: Math.random(), index: i });
  }

  teamScores.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return a.tiebreaker - b.tiebreaker;
  });

  tally[TEAMS[teamScores[0].index]].direct++;
  tally[TEAMS[teamScores[1].index]].playoff++;
  for (let i = 2; i < teamScores.length; i++) {
    tally[TEAMS[teamScores[i].index]].fail++;
  }
}

parentPort!.postMessage(tally);