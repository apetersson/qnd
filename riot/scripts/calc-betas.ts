import fs from "fs";
import path from "path";
import yaml from "yaml";

type Case = {
  name: string;
  gini: number;
  inflation: number;
  unemployment: number;
};

type Dataset = {
  positives: Case[];
  negatives: Case[];
};

type Vector = number[];
type Matrix = number[][];

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

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

const trainLogReg = (X: Matrix, y: Vector, opts: { lambda?: number; maxIter?: number } = {}): Vector => {
  const n = X.length;
  const k = X[0].length;
  const lambda = opts.lambda ?? 1.0; // mimic scikit's default L2 (C=1)
  let w = new Array(k).fill(0);

  for (let iter = 0; iter < (opts.maxIter ?? 100); iter++) {
    const p = X.map((row) => sigmoid(row.reduce((s, val, idx) => s + val * w[idx], 0)));
    const grad = new Array(k).fill(0);
    const hess = Array.from({ length: k }, () => new Array(k).fill(0));

    for (let i = 0; i < n; i++) {
      const pi = p[i];
      const wi = pi * (1 - pi);
      const diff = pi - y[i];
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
    for (let j = 0; j < k; j++) grad[j] /= n;
    for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) hess[a][b] /= n;

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

  const rows: { x: number[]; y: number }[] = [];
  const useCore = process.argv.includes("--core");
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

  positives.forEach((c) => rows.push({ x: [1, c.gini, c.inflation, c.unemployment], y: 1 }));
  parsed.negatives.forEach((c) => rows.push({ x: [1, c.gini, c.inflation, c.unemployment], y: 0 }));

  const X = rows.map((r) => r.x);
  const y = rows.map((r) => r.y);

  const w = trainLogReg(X, y);

  const [intercept, betaGini, betaInflation, betaUnemployment] = w;

  console.log("---- Riot Logistic Regression (YAML-driven) ----");
  console.log(
    `Samples: ${rows.length} (${positives.length} positives / ${parsed.negatives.length} negatives)${
      useCore ? " [core subset]" : ""
    }`
  );
  console.log(`β₀ (intercept): ${intercept.toFixed(6)}`);
  console.log(`β_gini:         ${betaGini.toFixed(6)}`);
  console.log(`β_inflation:    ${betaInflation.toFixed(6)}`);
  console.log(`β_unemployment: ${betaUnemployment.toFixed(6)}`);
  console.log("\nPaste these into the UI defaults if desired.");
};

main();
