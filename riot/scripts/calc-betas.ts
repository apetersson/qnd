import fs from "fs";
import path from "path";
import yaml from "yaml";

type Case = {
  name: string;
  gini: number;
  inflation: number;
  unemployment: number;
  year: number;
};

type Dataset = {
  positives: Case[];
  negatives: Case[];
};

type Vector = number[];
type Matrix = number[][];

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
const predict = (x: Vector, w: Vector) => sigmoid(x.reduce((s, v, i) => s + v * w[i], 0));

const transpose = (m: Matrix): Matrix => m[0].map((_, i) => m.map((row) => row[i]));

// Gauss-Jordan solve for small systems
const solve = (A: Matrix, b: Vector): Vector => {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let r = i + 1; r < n; r++) {
      if (Math.abs(M[r][i]) > Math.abs(M[maxRow][i])) maxRow = r;
    }
    [M[i], M[maxRow]] = [M[maxRow], M[i]];
    const pivot = M[i][i] || 1e-12;
    for (let c = i; c <= n; c++) M[i][c] /= pivot;
    for (let r = 0; r < n; r++) {
      if (r === i) continue;
      const factor = M[r][i];
      for (let c = i; c <= n; c++) M[r][c] -= factor * M[i][c];
    }
  }
  return M.map((row) => row[n]);
};

const trainLogReg = (
  X: Matrix,
  y: Vector,
  opts: { lambda?: number; maxIter?: number; weights?: Vector } = {}
): Vector => {
  const n = X.length;
  const k = X[0].length;
  const lambda = opts.lambda ?? 1.0; // mimic scikit's default L2 (C=1)
  const sampleW = opts.weights ?? new Array(n).fill(1);
  let w = new Array(k).fill(0);

  for (let iter = 0; iter < (opts.maxIter ?? 100); iter++) {
    const p = X.map((row) => sigmoid(row.reduce((s, val, idx) => s + val * w[idx], 0)));
    const grad = new Array(k).fill(0);
    const hess = Array.from({ length: k }, () => new Array(k).fill(0));

    for (let i = 0; i < n; i++) {
      const pi = p[i];
      const wi = pi * (1 - pi) * sampleW[i];
      const diff = (pi - y[i]) * sampleW[i];
      for (let a = 0; a < k; a++) {
        grad[a] += diff * X[i][a];
        for (let b = 0; b < k; b++) {
          hess[a][b] += wi * X[i][a] * X[i][b];
        }
      }
    }

    // L2 regularization (exclude intercept index 0)
    for (let j = 1; j < k; j++) {
      grad[j] += lambda * w[j];
      hess[j][j] += lambda;
    }

    // Average gradient over samples
    const norm = sampleW.reduce((s, v) => s + v, 0);
    for (let j = 0; j < k; j++) grad[j] /= norm;
    for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) hess[a][b] /= norm;

    const delta = solve(hess, grad);
    let deltaNorm = 0;
    for (let j = 0; j < k; j++) {
      w[j] -= delta[j];
      deltaNorm += delta[j] * delta[j];
    }
    if (Math.sqrt(deltaNorm) < 1e-6) break;
  }

  return w;
};

const main = () => {
  const dataUrl = new URL("../data/protests.yaml", import.meta.url);
  const dataPath = path.resolve(dataUrl.pathname);
  const raw = fs.readFileSync(dataPath, "utf8");
  const parsed = yaml.parse(raw) as Dataset;

  const rows: { x: number[]; y: number; w: number; name: string; label: "pos" | "neg"; year: number }[] = [];
  const useCore = process.argv.includes("--core");
  const downweightPos = Number(process.env.POS_WEIGHT ?? "0.5"); // e.g. 0.5 to reflect 50% confidence
  const coreNames = new Set<string>([
    "Argentina Crisis 2001",
    "Hong Kong Protests 2019",
    "Chile Protests 2019",
    "Watts Riots 1965",
    "Detroit Riots 1967",
    "NYC Blackout Riot 1977",
    "Brixton Uprising 1981",
    "LA Riots 1992",
    "Banlieue Riots 2005",
    "Greek Riots 2008",
    "Yellow Vests 2018",
    "Chile Protests 2019 (alt)",
  ]);

  const positives = useCore ? parsed.positives.filter((c) => coreNames.has(c.name)) : parsed.positives;

  positives.forEach((c) =>
    rows.push({ x: [1, c.gini, c.inflation, c.unemployment], y: 1, w: downweightPos, name: c.name, label: "pos", year: c.year })
  );
  parsed.negatives.forEach((c) =>
    rows.push({ x: [1, c.gini, c.inflation, c.unemployment], y: 0, w: 1, name: c.name, label: "neg", year: c.year })
  );

  const X = rows.map((r) => r.x);
  const y = rows.map((r) => r.y);
  const weights = rows.map((r) => r.w);

  const w = trainLogReg(X, y, { weights });
  const preds = X.map((row) => predict(row, w));
  const posProbs = preds.filter((_, i) => rows[i].y === 1);
  const negProbs = preds.filter((_, i) => rows[i].y === 0);
  const mean = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / (arr.length || 1);
  const avgPos = mean(posProbs);
  const avgNeg = mean(negProbs);

  // Calibrate intercept so that mean P on positives ~= 0.5 (keeps slopes fixed)
  const logits = X.map((row) => row.reduce((s, v, i) => s + v * w[i], 0));
  const posIdx = rows.map((r, i) => (r.y === 1 ? i : -1)).filter((i) => i >= 0);
  const posLogits = posIdx.map((i) => logits[i]);
  const target = 0.5;
  let lo = -15, hi = 15, delta = 0;
  for (let iter = 0; iter < 50; iter++) {
    const mid = (lo + hi) / 2;
    const m = mean(posLogits.map((z) => sigmoid(z + mid)));
    if (m > target) {
      hi = mid;
    } else {
      lo = mid;
    }
    delta = mid;
  }
  const calibratedIntercept = w[0] + delta;
  const calibratedW = [calibratedIntercept, ...w.slice(1)];
  const calibratedPreds = X.map((row) => predict(row, calibratedW));
  const calAvgPos = mean(calibratedPreds.filter((_, i) => rows[i].y === 1));
  const calAvgNeg = mean(calibratedPreds.filter((_, i) => rows[i].y === 0));

  const [intercept, betaGini, betaInflation, betaUnemployment] = w;

  console.log("---- Riot Logistic Regression (YAML-driven) ----");
  console.log(
    `Samples: ${rows.length} (${positives.length} positives / ${parsed.negatives.length} negatives)${
      useCore ? " [core subset]" : ""
    }, pos_weight=${downweightPos}`
  );
  console.log(`β₀ (intercept): ${intercept.toFixed(6)}`);
  console.log(`β_gini:         ${betaGini.toFixed(6)}`);
  console.log(`β_inflation:    ${betaInflation.toFixed(6)}`);
  console.log(`β_unemployment: ${betaUnemployment.toFixed(6)}`);
  console.log(`Avg P(riot) on positives: ${avgPos.toFixed(3)} | negatives: ${avgNeg.toFixed(3)}`);
  console.log(`Calibrated β₀ (target mean pos=0.5): ${calibratedIntercept.toFixed(6)}`);
  console.log(`Calibrated Avg P(riot) -> positives: ${calAvgPos.toFixed(3)} | negatives: ${calAvgNeg.toFixed(3)}`);
  console.log("\nPaste these into the UI defaults if desired.");

  console.log("\nBacktest predictions (all samples):");
  rows
    .map((r, i) => ({ ...r, p: preds[i] }))
    .sort((a, b) => a.p - b.p)
    .forEach((r) => {
      const tag = r.label === "pos" ? "POS" : "NEG";
      console.log(`${tag} | ${r.year} | ${r.name} | ${r.p.toFixed(3)}`);
    });
};

main();
