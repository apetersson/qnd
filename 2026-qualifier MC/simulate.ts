// Monte Carlo Qualifier Simulator – UEFA Group H (runs only the remaining fixtures)
// Language: TypeScript (Node ≥18, ts‑node, yarn)
// Usage:
//   yarn add -D typescript ts-node @types/node
//   yarn ts-node monte_carlo_groupH.ts
// -----------------------------------------------------------------------------
// This version bakes in the *current* standings (after 10 Jun 2025) and
// simulates only the 12 matches still to be played. It prints overall
// qualification odds for Austria *and* the win/draw/loss probabilities for each
// upcoming game.
// -----------------------------------------------------------------------------

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

// EloRatings.net – country ratings captured 2025‑07‑21
const RATING: Record<Team, number> = {
  // "Austria": 2101,
  // "Bosnia-Herzegovina": 1853,
  // "Romania": 1990,
  // "Cyprus": 2018,
  // "San Marino": 1326,
  "Austria": 1844,
  "Bosnia-Herzegovina": 1522,
  "Romania": 1680,
  "Cyprus": 1299,
  "San Marino": 845,
};

// Table after 8/20 matches (10 Jun 2025)
const INITIAL_POINTS: Record<Team, number> = {
  "Austria": 6,
  "Bosnia-Herzegovina": 9,
  "Romania": 6,
  "Cyprus": 3,
  "San Marino": 0,
};

// Remaining fixtures with real dates (CET/CEST)
const REMAINING_FIXTURES: Array<{ home: Team; away: Team; date: string }> = [
  { home: "Austria",           away: "Cyprus",            date: "2025-09-06" },
  { home: "San Marino",        away: "Bosnia-Herzegovina",date: "2025-09-06" },
  { home: "Bosnia-Herzegovina",away: "Austria",           date: "2025-09-09" },
  { home: "Cyprus",            away: "Romania",           date: "2025-09-09" },
  { home: "Austria",           away: "San Marino",        date: "2025-10-09" },
  { home: "Cyprus",            away: "Bosnia-Herzegovina",date: "2025-10-09" },
  { home: "San Marino",        away: "Cyprus",            date: "2025-10-12" },
  { home: "Romania",           away: "Austria",           date: "2025-10-12" },
  { home: "Cyprus",            away: "Austria",           date: "2025-11-15" },
  { home: "Bosnia-Herzegovina",away: "Romania",           date: "2025-11-15" },
  { home: "Austria",           away: "Bosnia-Herzegovina",date: "2025-11-18" },
  { home: "Romania",           away: "San Marino",        date: "2025-11-18" },
];

const HOME_BONUS = 100; // Elo pts
const DRAW_P = 0.25;    // Constant draw probability

// -----------------------------------------------------------------------------
// Utility helpers
// -----------------------------------------------------------------------------
function eloWinProb(rA: number, rB: number): number {
  return 1 / (1 + Math.pow(10, (rB - rA) / 400));
}

function calcPairOdds(home: Team, away: Team) {
  const winExpect = eloWinProb(RATING[home] + HOME_BONUS, RATING[away]);
  const pHomeWin = (1 - DRAW_P) * winExpect;
  const pAwayWin = (1 - DRAW_P) * (1 - winExpect);
  return { pHomeWin, pDraw: DRAW_P, pAwayWin };
}

// -----------------------------------------------------------------------------
// Monte Carlo core – simulate only the unplayed matches
// -----------------------------------------------------------------------------
function monteCarloQualification(nSim = 1_000_000, playoffWinProb = 0.5): Result {
  let direct = 0;
  let playoff = 0;
  let fail = 0;

  for (let sim = 0; sim < nSim; sim++) {
    const pts: Record<Team, number> = { ...INITIAL_POINTS };

    for (const { home, away } of REMAINING_FIXTURES) {
      const { pHomeWin, pDraw } = calcPairOdds(home, away);
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

    // Standings (random tie‑breaker)
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
// Pretty‑print helpers
// -----------------------------------------------------------------------------
function pct(x: number): string {
  return (x * 100).toFixed(1) + "%";
}

function printRemainingOdds(): void {
  console.log("\nOdds for each remaining fixture:\n");
  console.table(
    REMAINING_FIXTURES.map(({ home, away, date }) => {
      const { pHomeWin, pDraw, pAwayWin } = calcPairOdds(home, away);
      return {
        Date: date,
        Match: `${home} vs ${away}`,
        "Home Win": pct(pHomeWin),
        Draw: pct(pDraw),
        "Away Win": pct(pAwayWin),
      };
    }),
  );
}

// -----------------------------------------------------------------------------
// Script entry
// -----------------------------------------------------------------------------
(function main() {
  const sim = monteCarloQualification();
  console.log("\nQualification probabilities (1 000 000 sims):\n", sim);
  printRemainingOdds();
})();
