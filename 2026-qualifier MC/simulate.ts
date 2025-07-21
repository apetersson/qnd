import * as fs from "node:fs";

interface TeamResult {
  direct: number;
  playoff: number;
  fail: number;
  overall: number;
}

// A helper interface to define the shape of the simulation counters.
interface TallyCount {
  direct: number;
  playoff: number;
  fail: number;
}

type ResultTable = Record<Team, TeamResult>;

interface Config {
  numberOfSimulations: number;
  teams: string[];
  elo: Record<string, number>;
  homeBonus: number;
  currentPoints: Record<string, number>;
  fixtures: [string, string][];
  drawR: number;
  playoffWinProb: number;
}

const cfg: Config = JSON.parse(fs.readFileSync("qualifier_config.json", "utf-8"));

const TEAMS = cfg.teams;
type Team = (typeof TEAMS)[number];

const RATING: Record<Team, number> = cfg.elo;
const INITIAL_POINTS: Record<Team, number> = cfg.currentPoints;
const FIXTURES: Array<[Team, Team]> = cfg.fixtures as [Team, Team][];
const HOME_BONUS: number = cfg.homeBonus;
const DRAW_R: number = cfg.drawR;
const DEFAULT_PLAYOFF: number = cfg.playoffWinProb;

// -----------------------------------------------------------------------------
// Probability helpers
// -----------------------------------------------------------------------------

function eloWinProb(rA: number, rB: number): number {
  return 1 / (1 + Math.pow(10, (rB - rA) / 400));
}

function drawProb(deltaElo: number): number {
  const w = 1 / (1 + Math.pow(10, -deltaElo / 400));
  return 2 * w * (1 - w) * DRAW_R;
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
function simulate(): ResultTable {
  // counters per team, initialized to zero for each outcome.
  // Using a specific type assertion `as Record<...>` instead of `as any`.
  const tally: Record<Team, TallyCount> =
    TEAMS.reduce((acc, t) => ({...acc, [t]: {direct: 0, playoff: 0, fail: 0}}),
      {} as Record<Team, TallyCount>);

  for (let s = 0; s < cfg.numberOfSimulations; s++) {
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
  // Initialize with a specific type assertion instead of `as any`.
  // This informs TypeScript that the object will conform to `ResultTable`
  // once it has been populated by the loop.
  const res = {} as ResultTable;
  for (const t of TEAMS) {
    const d = tally[t].direct / cfg.numberOfSimulations;
    const p = tally[t].playoff / cfg.numberOfSimulations;
    const f = tally[t].fail / cfg.numberOfSimulations;
    res[t] = {direct: d, playoff: p, fail: f, overall: d + p * cfg.playoffWinProb};
  }
  return res;
}

// -----------------------------------------------------------------------------
// Pretty printers
// -----------------------------------------------------------------------------
const pct = (x: number) => (x * 100).toFixed(1) + "%";

function showTeamOdds(table: ResultTable): void {
  console.log(`
Qualification probabilities (${cfg.numberOfSimulations} sims):\n`);
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
  console.log("Starting Monte Carlo simulation...");
  // Start a timer with a descriptive label
  console.time("Simulation time");

  const results = simulate();

  // Stop the timer and print the elapsed time to the console
  console.timeEnd("Simulation time");

  showTeamOdds(results);
  showMatchOdds();
})();