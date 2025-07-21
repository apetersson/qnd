// Monte Carlo Qualifier Simulator – updated for current standings
// Language: TypeScript (Node ≥18, ts-node, yarn)

interface Result {
  direct: number;
  playoff: number;
  fail: number;
  overall: number;
}

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

const HOME_BONUS = 100;    // elo pts

// Current standings (as of 10 June 2025)
const initialPts: Record<Team, number> = {
  "Bosnia-Herzegovina": 9,
  "Austria": 6,
  "Romania": 6,
  "Cyprus": 3,
  "San Marino": 0
};

// Remaining fixtures (home team first)
const REMAINING_MATCHES: Array<[Team, Team]> = [
  // September 2025
  ['Austria', 'Cyprus'],
  ['San Marino', 'Bosnia-Herzegovina'],
  ['Bosnia-Herzegovina', 'Austria'],
  ['Cyprus', 'Romania'],

  // October 2025
  ['Austria', 'San Marino'],
  ['Cyprus', 'Bosnia-Herzegovina'],
  ['San Marino', 'Cyprus'],
  ['Romania', 'Austria'],

  // November 2025
  ['Cyprus', 'Austria'],
  ['Bosnia-Herzegovina', 'Romania'],
  ['Austria', 'Bosnia-Herzegovina'],
  ['Romania', 'San Marino']
];

// -----------------------------------------------------------------------------
// Utility helpers
// -----------------------------------------------------------------------------

function eloWinProb(rA: number, rB: number): number {
  /** expected score of player A vs B */
  return 1 / (1 + Math.pow(10, (rB - rA) / 400));
}

interface PairOdds {
  home: Team;
  away: Team;
  pHomeWin: number;
  pDraw: number;
  pAwayWin: number;
}

function drawProb(deltaElo: number, r = 0.4): number {
  const w = 1 / (1 + Math.pow(10, -deltaElo / 400)); // binary win prob for home
  return 2 * w * (1 - w) * r;
}

function calcPairOdds(home: Team, away: Team) {
  const delta = (RATING[home] + HOME_BONUS) - RATING[away];
  const pDraw  = drawProb(delta);                 // replaces constant 0.25
  const pHomeW = (1 - pDraw) *
    (1 / (1 + Math.pow(10, -delta / 400)));
  const pAwayW = 1 - pHomeW - pDraw;
  return { pHomeWin: pHomeW, pDraw, pAwayWin: pAwayW };
}

// -----------------------------------------------------------------------------
// Monte Carlo core (updated for current standings)
// -----------------------------------------------------------------------------

function monteCarloQualification(
  nSim = 1_000_000,
  playoffWinProb = 0.5,
): Result {
  let direct = 0;
  let playoff = 0;
  let fail = 0;

  for (let sim = 0; sim < nSim; sim++) {
    // Start with current points
    const pts: Record<Team, number> = { ...initialPts };

    // Simulate remaining matches
    for (const [home, away] of REMAINING_MATCHES) {
      const { pHomeWin, pDraw } = calcPairOdds(home, away);
      const pAwayWin = 1 - pHomeWin - pDraw;
      const r = Math.random();
      if (r < pHomeWin) {
        pts[home] += 3;
      } else if (r < pHomeWin + pDraw) {
        pts[home] += 1;
        pts[away] += 1;
      } else {
        pts[away] += 3;
      }
    }

    // Standings by pts (random tie-breaker)
    const table = [...TEAMS].sort((a, b) => {
      if (pts[b] !== pts[a]) return pts[b] - pts[a];
      return Math.random() - 0.5;
    });
    const rank = table.indexOf("Austria") + 1;

    if (rank === 1) direct++;
    else if (rank === 2) playoff++;
    else fail++;
  }

  const directP = direct / nSim;
  const playoffP = playoff / nSim;
  return {
    direct: directP,
    playoff: playoffP,
    fail: fail / nSim,
    overall: directP + playoffP * playoffWinProb,
  };
}

// -----------------------------------------------------------------------------
// Pretty-print helpers
// -----------------------------------------------------------------------------
function pct(x: number): string {
  return (x * 100).toFixed(1) + "%";
}

function printRemainingMatchOdds(): void {
  console.log("\nOdds for remaining matches:\n");
  const matchData = REMAINING_MATCHES.map(([home, away]) => {
    const { pHomeWin, pDraw, pAwayWin } = calcPairOdds(home, away);
    return {
      Match: `${home} vs ${away}`,
      "Home Win": pct(pHomeWin),
      Draw: pct(pDraw),
      "Away Win": pct(pAwayWin),
    };
  });
  console.table(matchData);
}

// -----------------------------------------------------------------------------
// Script entry
// -----------------------------------------------------------------------------

(function main() {
  const sim = monteCarloQualification();
  console.log("\nQualification probabilities for Austria (1M sims):\n");
  console.table({
    "Direct Qualification": pct(sim.direct),
    "Playoff Qualification": pct(sim.playoff),
    "Elimination": pct(sim.fail),
    "Overall Chance": pct(sim.overall),
  });
  printRemainingMatchOdds();
})();