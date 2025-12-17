export type Weights = {
  intercept: number;
  betaGini: number;
  betaInflation: number;
  betaUnemployment: number;
};

export const computeProbability = (
  gini: number,
  inflation: number,
  unemployment: number,
  weights: Weights
) => {
  const logit =
    weights.intercept +
    weights.betaGini * gini +
    weights.betaInflation * inflation +
    weights.betaUnemployment * unemployment;
  return 1 / (1 + Math.exp(-logit));
};
