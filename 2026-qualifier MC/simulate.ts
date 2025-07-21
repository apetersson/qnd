// Monte Carlo Qualifier Simulator – updated to print one‑off odds for every pairing
// Language: TypeScript (Node ≥18, ts-node, yarn)
// To run:
//   yarn add -D ts-node typescript @types/node
//   yarn ts-node monte_carlo_sim_updated.ts

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

// Soccer‑Rating country ratings captured 2025‑07‑21
const RATING: Record<Team, number> = {
  "Austria": 2101,
  "Bosnia-Herzegovina": 1853,
  "Romania": 1990,
  "Cyprus": 2018,
  "San Marino": 1326,
};

const HOME_BONUS = 100;    // elo pts
const DRAW_P = 0.25;       // constant draw probability

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

function calcPairOdds(home: Team, away: Team): PairOdds {
  const winExpect = eloWinProb(RATING[home] + HOME_BONUS, RATING[away]);
  const pHomeWin = (1 - DRAW_P) * winExpect;
  const pAwayWin = (1 - DRAW_P) * (1 - winExpect);
  return {
    home,
    away,
    pHomeWin,
    pDraw: DRAW_P,
    pAwayWin,
  };
}

// -----------------------------------------------------------------------------
// Monte Carlo core
// -----------------------------------------------------------------------------

function monteCarloQualification(
  nSim = 100_000,
  playoffWinProb = 0.5,
): Result {
  let direct = 0;
  let playoff = 0;
  let fail = 0;

  for (let sim = 0; sim < nSim; sim++) {
    const pts: Record<Team, number> = {
      "Austria": 0,
      "Bosnia-Herzegovina": 0,
      "Romania": 0,
      "Cyprus": 0,
      "San Marino": 0,
    };

    // double round‑robin
    for (let i = 0; i < TEAMS.length; i++) {
      for (let j = i + 1; j < TEAMS.length; j++) {
        const t1 = TEAMS[i];
        const t2 = TEAMS[j];

        for (const [home, away] of [[t1, t2] as const, [t2, t1] as const]) {
          const { pHomeWin, pDraw } = calcPairOdds(home, away);
          const pAwayWin = 1 - pHomeWin - pDraw; // should equal calcPairOdds(...).pAwayWin
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
      }
    }

    // standings by pts (random tie‑breaker)
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

function printPairOdds(): void {
  console.log("\nOne‑off match odds (home listed first):\n");
  console.table(
    TEAMS.flatMap((h) =>
      TEAMS.filter((a) => a !== h).map((a) => {
        const { pHomeWin, pDraw, pAwayWin } = calcPairOdds(h, a);
        return {
          Match: `${h} vs ${a}`,
          "Home Win": pct(pHomeWin),
          Draw: pct(pDraw),
          "Away Win": pct(pAwayWin),
        };
      }),
    ),
  );
}

// -----------------------------------------------------------------------------
// Script entry
// -----------------------------------------------------------------------------

(function main() {
  const sim = monteCarloQualification();
  console.log("\nQualification probabilities (100 000 sims):\n", sim);
  printPairOdds();
})();
