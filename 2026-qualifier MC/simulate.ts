// Monte Carlo Qualifier Simulator – updated for current standings
// Language: TypeScript (Node ≥18, ts-node, yarn)

interface TeamResult {
  direct: number;
  playoff: number;
  fail: number;
  overall: number;
}

type ResultTable = Record<Team, TeamResult>;

const TEAMS = [
  "Austria",
  "Bosnia-Herzegovina",
  "Romania",
  "Cyprus",
  "San Marino",
] as const;

type Team = (typeof TEAMS)[number];

// Elo ratings from https://www.eloratings.net/ (as of 2025-07-21)
const RATING: Record<Team, number> = {
  "Austria": 2101,
  "Bosnia-Herzegovina": 1853,
  "Romania": 1990,
  "Cyprus": 2018,
  "San Marino": 1326,

  // "Austria": 1844,
  // "Bosnia-Herzegovina": 1522,
  // "Romania": 1680,
  // "Cyprus": 1299,
  // "San Marino": 845,
};

// Current points after MD2 for AUT, MD3‑4 for others (10 Jun 2025)
const INITIAL_POINTS: Record<Team, number> = {
  "Bosnia-Herzegovina": 9,
  "Austria": 6,
  "Romania": 6,
  "Cyprus": 3,
  "San Marino": 0,
};

// Remaining fixtures (home first)
const FIXTURES: Array<[Team, Team]> = [
  // September 2025
  ["Austria", "Cyprus"],
  ["San Marino", "Bosnia-Herzegovina"],
  ["Bosnia-Herzegovina", "Austria"],
  ["Cyprus", "Romania"],
  // October 2025
  ["Austria", "San Marino"],
  ["Cyprus", "Bosnia-Herzegovina"],
  ["San Marino", "Cyprus"],
  ["Romania", "Austria"],
  // November 2025
  ["Cyprus", "Austria"],
  ["Bosnia-Herzegovina", "Romania"],
  ["Austria", "Bosnia-Herzegovina"],
  ["Romania", "San Marino"],
];

const HOME_BONUS = 100; // Elo pts

// -----------------------------------------------------------------------------
// Probability helpers
// -----------------------------------------------------------------------------

function eloWinProb(rA: number, rB: number): number {
  return 1 / (1 + Math.pow(10, (rB - rA) / 400));
}

function drawProb(deltaElo: number, r = 0.4): number {
  const w = 1 / (1 + Math.pow(10, -deltaElo / 400));
  return 2 * w * (1 - w) * r;
}

function matchOdds(home: Team, away: Team) {
  const delta = (RATING[home] + HOME_BONUS) - RATING[away];
  const pDraw = drawProb(delta);
  const pHome = (1 - pDraw) * eloWinProb(RATING[home] + HOME_BONUS, RATING[away]);
  const pAway = 1 - pHome - pDraw;
  return {pHome, pDraw, pAway};
}

// -----------------------------------------------------------------------------
// Monte‑Carlo core (simulates only remaining matches)
// -----------------------------------------------------------------------------
function simulate(nSim = 1_000_000, playoffWinProb = 0.5): ResultTable {
  // counters per team
  const tally: Record<Team, { direct: number; playoff: number; fail: number }> =
    TEAMS.reduce((acc, t) => ({...acc, [t]: {direct: 0, playoff: 0, fail: 0}}),
      {} as any);

  for (let s = 0; s < nSim; s++) {
    const pts: Record<Team, number> = {...INITIAL_POINTS};

    for (const [home, away] of FIXTURES) {
      const {pHome, pDraw} = matchOdds(home, away);
      const r = Math.random();
      if (r < pHome) {
        pts[home] += 3;
      } else if (r < pHome + pDraw) {
        pts[home] += 1;
        pts[away] += 1;
      } else {
        pts[away] += 3;
      }
    }

    // order table, random tie‑break
    const ranking = [...TEAMS].sort((a, b) => {
      if (pts[b] !== pts[a]) return pts[b] - pts[a];
      return Math.random() - 0.5;
    });

    tally[ranking[0]].direct++;
    tally[ranking[1]].playoff++;
    ranking.slice(2).forEach((t) => tally[t].fail++);
  }

  // convert counts → probabilities
  const res: ResultTable = {} as any;
  for (const t of TEAMS) {
    const d = tally[t].direct / nSim;
    const p = tally[t].playoff / nSim;
    const f = tally[t].fail / nSim;
    res[t] = {direct: d, playoff: p, fail: f, overall: d + p * playoffWinProb};
  }
  return res;
}

// -----------------------------------------------------------------------------
// Pretty printers
// -----------------------------------------------------------------------------
const pct = (x: number) => (x * 100).toFixed(1) + "%";

function showTeamOdds(table: ResultTable): void {
  console.log("\nQualification probabilities (1 000 000 sims):\n");
  const view: Record<string, Record<string, string>> = {};
  for (const t of TEAMS) {
    view[t] = {
      "Direct": pct(table[t].direct),
      "Playoff": pct(table[t].playoff),
      "Eliminated": pct(table[t].fail),
      "Overall": pct(table[t].overall),
    };
  }
  console.table(view);
}

function showMatchOdds(): void {
  console.log("\nOdds for each remaining fixture:\n");
  console.table(
    FIXTURES.map(([h, a]) => {
      const {pHome, pDraw, pAway} = matchOdds(h, a);
      return {
        Match: `${h} vs ${a}`,
        "Home Win": pct(pHome),
        Draw: pct(pDraw),
        "Away Win": pct(pAway),
      };
    }),
  );
}

// -----------------------------------------------------------------------------
// Entry point
// -----------------------------------------------------------------------------

(function main() {
  const results = simulate();
  showTeamOdds(results);
  showMatchOdds();
})();