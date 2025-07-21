import * as fs from "node:fs";
import * as yaml from "js-yaml";

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

  // Precomputed data
  teamIdx: Map<string, number>;
  basePts: number[];
  precomputedFixtures: [number, number, number, number, number][]; // home_idx, away_idx, p_home, p_draw, p_away

  // Methods
  eloWinProb(rA: number, rB: number): number;
  drawProb(deltaElo: number): number;
}

const configPath = process.argv[2] || "groupH.json";
const configContent = fs.readFileSync(configPath, "utf-8");

let cfg: Config;
const ext = configPath.split(".").pop();

if (ext === "json") {
  cfg = JSON.parse(configContent);
} else if (ext === "yaml" || ext === "yml") {
  cfg = yaml.load(configContent) as Config;
} else {
  throw new Error(`Unsupported config file format: ${ext}`);
}

// Add methods to cfg
cfg.eloWinProb = function(rA: number, rB: number): number {
  return 1 / (1 + Math.pow(10, (rB - rA) / 400));
};

cfg.drawProb = function(deltaElo: number): number {
  const w = 1 / (1 + Math.pow(10, -deltaElo / 400));
  return 2 * w * (1 - w) * this.drawR;
};

// Precompute team indices and base points
cfg.teamIdx = new Map<string, number>();
cfg.basePts = new Array<number>(cfg.teams.length);
cfg.teams.forEach((team, i) => {
  cfg.teamIdx.set(team, i);
  cfg.basePts[i] = cfg.currentPoints[team];
});

// Precompute fixture odds with integer indices
cfg.precomputedFixtures = cfg.fixtures.map(([home, away]) => {
  const homeIdx = cfg.teamIdx.get(home)!;
  const awayIdx = cfg.teamIdx.get(away)!;

  const delta = (cfg.elo[home] + cfg.homeBonus) - cfg.elo[away];
  const pDraw = cfg.drawProb(delta);
  const pHome = (1 - pDraw) * cfg.eloWinProb(cfg.elo[home] + cfg.homeBonus, cfg.elo[away]);
  const pAway = 1 - pHome - pDraw;

  return [homeIdx, awayIdx, pHome, pDraw, pAway];
});

const TEAMS = cfg.teams;
type Team = (typeof TEAMS)[number];



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
    const pts: number[] = [...cfg.basePts]; // Use pre-computed base points

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

    // Optimized ranking: avoid dict lookups and string comparisons in hot loop
    // Create a list of (points, random_tiebreaker, team_index) tuples
    const teamScores: { points: number; tiebreaker: number; index: number }[] = [];
    for (let i = 0; i < pts.length; i++) {
      teamScores.push({ points: pts[i], tiebreaker: Math.random(), index: i });
    }

    // Sort based on points (descending) and tie-breaker (ascending)
    teamScores.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return a.tiebreaker - b.tiebreaker;
    });

    // Update tally using original team names
    tally[TEAMS[teamScores[0].index]].direct++;
    tally[TEAMS[teamScores[1].index]].playoff++;
    for (let i = 2; i < teamScores.length; i++) {
      tally[TEAMS[teamScores[i].index]].fail++;
    }
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
    cfg.precomputedFixtures.map(([homeIdx, awayIdx, pHome, pDraw, pAway]) => {
      return {
        Match: `${cfg.teams[homeIdx]} vs ${cfg.teams[awayIdx]}`,
        "Home Win": pct(pHome),
        Draw: pct(pDraw),
        "Away Win": pct(pAway),
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