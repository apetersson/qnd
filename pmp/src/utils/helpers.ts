// src/utils/helpers.ts
import { Terrain, Building } from "../models/Board";

export function parseTerrainValue(value: string | undefined): Terrain {
  switch ((value || "").toUpperCase()) {
    case "FIELD":
      return Terrain.Field;
    case "FOREST":
      return Terrain.Forest;
    case "MOUNTAIN":
      return Terrain.Mountain;
    case "CITY":
      return Terrain.City;
    case "WATER":
      return Terrain.Water;
    default:
      return Terrain.None;
  }
}

export function parseBuildingValue(value: string | undefined): Building {
  switch ((value || "").toUpperCase()) {
    case "FARM":
      return Building.Farm;
    case "LUMBER_HUT":
      return Building.LumberHut;
    case "MINE":
      return Building.Mine;
    case "SAWMILL":
      return Building.Sawmill;
    case "WINDMILL":
      return Building.Windmill;
    case "FORGE":
      return Building.Forge;
    case "MARKET":
      return Building.Market;
    default:
      return Building.None;
  }
}

/**
 * Estimates the runtime of the brute-force optimization,
 * based on the number of eligible tiles and a given base (number of options per tile).
 * Total iterations = base^(eligibleCount), assuming 10,000 iterations per second.
 * log10(seconds) = eligibleCount * log10(base) - 4.
 */
export function estimateCompletionTime(eligibleCount: number, base: number): string {
  const estimatedTimeLog = eligibleCount * Math.log10(base) - 4;
  if (estimatedTimeLog < 9) {
    const timeSeconds = Math.pow(10, estimatedTimeLog);
    if (timeSeconds < 60) return `${timeSeconds.toFixed(2)} seconds`;
    if (timeSeconds < 3600) return `${(timeSeconds / 60).toFixed(2)} minutes`;
    if (timeSeconds < 86400) return `${(timeSeconds / 3600).toFixed(2)} hours`;
    if (timeSeconds < 31536000) return `${(timeSeconds / 86400).toFixed(2)} days`;
    return `${(timeSeconds / 31536000).toFixed(2)} years`;
  }
  return `approximately 10^${estimatedTimeLog.toFixed(2)} seconds`;
}
