// Typescript rewrite with updated ratings and Monte Carlo simulation
// This script simulates Austria's qualification chances for the 2026 FIFA World Cup
// using updated country ratings from Soccer-Rating.com.

interface Result {
  direct: number;
  playoff: number;
  fail: number;
  overall: number;
}

function monteCarloQualification(
  nSim: number = 100000,
  playoffWinProb: number = 0.5,
): Result {
  const teams = ["Austria", "Bosnia-Herzegovina", "Romania", "Cyprus", "San Marino"];

  const rating: Record<string, number> = {
    "Austria": 2101,
    "Bosnia-Herzegovina": 1853,
    "Romania": 1990,
    "Cyprus": 2018,
    "San Marino": 1326,
  };

  const HOME_BONUS = 100;
  const DRAW_P = 0.25;

  let direct = 0;
  let playoff = 0;
  let fail = 0;

  for (let sim = 0; sim < nSim; sim++) {
    const pts: Record<string, number> = {
      "Austria": 0,
      "Bosnia-Herzegovina": 0,
      "Romania": 0,
      "Cyprus": 0,
      "San Marino": 0,
    };

    // Double round-robin
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        const t1 = teams[i];
        const t2 = teams[j];
        // Play both home and away
        for (const [home, away] of [[t1, t2], [t2, t1]]) {
          const d = (rating[home] + HOME_BONUS) - rating[away];
          const winExpect = 1 / (1 + Math.pow(10, -d / 400));

          const pHomeWin = (1 - DRAW_P) * winExpect;
          const pAwayWin = (1 - DRAW_P) * (1 - winExpect);

          const r = Math.random();
          if (r < pHomeWin) {
            pts[home] += 3;
          } else if (r < pHomeWin + DRAW_P) {
            pts[home] += 1;
            pts[away] += 1;
          } else {
            pts[away] += 3;
          }
        }
      }
    }

    // Determine standings
    const table = [...teams].sort((a, b) => {
      if (pts[b] !== pts[a]) return pts[b] - pts[a];
      return Math.random() - 0.5; // random tiebreaker
    });

    const position = table.indexOf("Austria") + 1;

    if (position === 1) {
      direct += 1;
    } else if (position === 2) {
      playoff += 1;
    } else {
      fail += 1;
    }
  }

  const directP = direct / nSim;
  const playoffP = playoff / nSim;
  const overallP = directP + playoffP * playoffWinProb;

  return {
    direct: directP,
    playoff: playoffP,
    fail: fail / nSim,
    overall: overallP,
  };
}

console.log(monteCarloQualification());
