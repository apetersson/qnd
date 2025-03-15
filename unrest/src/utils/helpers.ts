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
 * Schätzt die Laufzeit der Brute-Force-Optimierung,
 * basierend auf der Anzahl leerer Kandidaten-Tiles.
 * Maximale Kombinationen = 5^(emptyCandidateCount) (5 Möglichkeiten pro Tile)
 * Bei 10.000 Iterationen pro Sekunde.
 */
export function estimateCompletionTime(emptyCandidateCount: number): string {
  const estimatedTimeLog = emptyCandidateCount * Math.log10(5) - 4;
  if (estimatedTimeLog < 9) {
    const timeSeconds = Math.pow(10, estimatedTimeLog);
    if (timeSeconds < 60) return `${timeSeconds.toFixed(2)} Sekunden`;
    if (timeSeconds < 3600) return `${(timeSeconds / 60).toFixed(2)} Minuten`;
    if (timeSeconds < 86400) return `${(timeSeconds / 3600).toFixed(2)} Stunden`;
    if (timeSeconds < 31536000) return `${(timeSeconds / 86400).toFixed(2)} Tage`;
    return `${(timeSeconds / 31536000).toFixed(2)} Jahre`;
  }
  return `etwa 10^${estimatedTimeLog.toFixed(2)} Sekunden`;
}
