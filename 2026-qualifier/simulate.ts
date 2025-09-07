import * as fs from "node:fs";
import * as yaml from "js-yaml";
import { Worker } from "worker_threads";
import * as os from "os";
import * as path from "path";

// --- Option Parsing ---
const args = process.argv.slice(2);
const options = {
  configFile: args.find(a => !a.startsWith('--')) || 'groupH.json',
  algo: args.find(a => a.startsWith('--algo='))?.split('=')[1] || 'scan',
  worker: args.find(a => a.startsWith('--worker='))?.split('=')[1] || 'threads',
  prng: args.find(a => a.startsWith('--prng='))?.split('=')[1] || 'xorshift32',
};

console.log('Running with options:', options);


interface TeamResult {
  direct: number;
  playoff: number;
  fail: number;
  overall: number;
}

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
  teamIdx: Map<string, number>;
  basePts: number[];
  precomputedFixtures: [number, number, number, number, number][];
  eloWinProb(rA: number, rB: number): number;
  drawProb(deltaElo: number): number;
}

const configContent = fs.readFileSync(options.configFile, "utf-8");

let cfg: Config;
const ext = options.configFile.split(".").pop();

if (ext === "json") {
  cfg = JSON.parse(configContent);
} else if (ext === "yaml" || ext === "yml") {
  cfg = yaml.load(configContent) as Config;
} else {
  throw new Error(`Unsupported config file format: ${ext}`);
}

cfg.eloWinProb = (rA: number, rB: number) => 1 / (1 + Math.pow(10, (rB - rA) / 400));
cfg.drawProb = function (deltaElo: number) {
  const w = 1 / (1 + Math.pow(10, -deltaElo / 400));
  return 2 * w * (1 - w) * this.drawR;
};

cfg.teamIdx = new Map<string, number>();
cfg.basePts = [];
cfg.teams.forEach((team, i) => {
  cfg.teamIdx.set(team, i);
  cfg.basePts[i] = cfg.currentPoints[team];
});

cfg.precomputedFixtures = cfg.fixtures.map(([home, away]) => {
  const homeIdx = cfg.teamIdx.get(home)!;
  const awayIdx = cfg.teamIdx.get(away)!;
  const delta = cfg.elo[home] + cfg.homeBonus - cfg.elo[away];
  const pDraw = cfg.drawProb(delta);
  const pHome = (1 - pDraw) * cfg.eloWinProb(cfg.elo[home] + cfg.homeBonus, cfg.elo[away]);
  const pAway = 1 - pHome - pDraw;
  return [homeIdx, awayIdx, pHome, pDraw, pAway];
});

const TEAMS = cfg.teams;
type Team = (typeof TEAMS)[number];

async function simulate(): Promise<ResultTable> {
  const numCores = os.cpus().length;
  const simsPerWorker = Math.floor(cfg.numberOfSimulations / numCores);
  const promises: Promise<Record<Team, TallyCount>>[] = [];

  console.log(`Using ${numCores} cores for simulation...`);

  const serializableCfg = {
    ...cfg,
    teamIdx: Array.from(cfg.teamIdx.entries()),
  };
  delete (serializableCfg as any).eloWinProb;
  delete (serializableCfg as any).drawProb;

  for (let i = 0; i < numCores; i++) {
    const startIdx = i * simsPerWorker;
    const endIdx = i === numCores - 1 ? cfg.numberOfSimulations : startIdx + simsPerWorker;

    const workerPromise = new Promise<Record<Team, TallyCount>>((resolve, reject) => {
      const workerData = { cfg: serializableCfg, startIdx, endIdx, opts: options, workerId: i };

      if (options.worker === 'web') {
        const worker = new (globalThis as any).Worker(new URL('./simulate_web_worker.js', import.meta.url).href, { type: 'module' });
        worker.onmessage = (event: any) => {
          resolve(event.data);
          worker.terminate();
        };
        worker.onerror = (err: any) => reject(err);
        worker.postMessage(workerData);
      } else { // Default to threads
        const worker = new Worker(path.join(__dirname, 'simulate_worker.js'), { workerData });
        worker.on("message", resolve);
        worker.on("error", reject);
        worker.on("exit", (code) => {
          if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
        });
      }
    });
    promises.push(workerPromise);
  }

  const workerResults = await Promise.all(promises);

  const finalTally: Record<Team, TallyCount> = TEAMS.reduce(
    (acc, t) => ({ ...acc, [t]: { direct: 0, playoff: 0, fail: 0 } }),
    {} as Record<Team, TallyCount>
  );

  for (const workerResult of workerResults) {
    for (const t of TEAMS) {
      finalTally[t].direct += workerResult[t].direct;
      finalTally[t].playoff += workerResult[t].playoff;
      finalTally[t].fail += workerResult[t].fail;
    }
  }

  const res = {} as ResultTable;
  for (const t of TEAMS) {
    const d = finalTally[t].direct / cfg.numberOfSimulations;
    const p = finalTally[t].playoff / cfg.numberOfSimulations;
    const f = finalTally[t].fail / cfg.numberOfSimulations;
    res[t] = { direct: d, playoff: p, fail: f, overall: d + p * cfg.playoffWinProb };
  }

  return res;
}

const pct = (x: number) => (x * 100).toFixed(1) + "%";

function showTeamOdds(table: ResultTable): void {
  console.log(`\nQualification probabilities (${cfg.numberOfSimulations} sims):\n`);
  console.table(
    TEAMS.map(t => ({
      Team: t,
      Direct: pct(table[t].direct),
      Playoff: pct(table[t].playoff),
      Eliminated: pct(table[t].fail),
      Overall: pct(table[t].overall),
    }))
  );
}

function showMatchOdds(): void {
  console.log("\nOdds for each remaining fixture:\n");
  console.table(
    cfg.precomputedFixtures.map(([homeIdx, awayIdx, pHome, pDraw, pAway]) => ({
      Match: `${cfg.teams[homeIdx]} vs ${cfg.teams[awayIdx]} `,
      "Home Win": pct(pHome),
      Draw: pct(pDraw),
      "Away Win": pct(pAway),
    }))
  );
}

(async function main() {
  console.log("Starting Monte Carlo simulation...");
  console.time("Simulation time");
  const results = await simulate();
  console.timeEnd("Simulation time");
  showTeamOdds(results);
  showMatchOdds();
})();
