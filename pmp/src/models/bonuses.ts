import { Board, Building, getNeighbors, TileData } from "./Board";
import { ADVANCED_BUILDINGS, MARKET_CONTRIBUTIONG_BUILDINGS } from "./buildingTypes";
import { getBuildingLevel, MAX_MARKET_LEVEL } from "../placement/placement";

/** Calculates the market bonus for a tile if it holds a Market building */
export function calculateMarketBonusForTile(tile: TileData, board: Board): number {
  if (tile.building !== Building.Market) return 0;
  let bonus = 0;
  const neighbors = getNeighbors(tile, board);
  for (const nbr of neighbors) {
    if (MARKET_CONTRIBUTIONG_BUILDINGS.includes(nbr.building)) {
      bonus += Math.min(getBuildingLevel(nbr, board), 8);
    }
  }
  return Math.min(bonus, MAX_MARKET_LEVEL);
}

/** Calculates the overall market bonus for the board */
export function calculateMarketBonus(board: Board): number {
  return board.tiles.reduce((acc, t) => acc + calculateMarketBonusForTile(t, board), 0);
}

/** A secondary metric (e.g., sum of building levels) used to break ties */
export function sumLevelsForFood(board: Board): number {
  let sum = 0;
  const buildingFactors: Record<Building, number> = {
    MONUMENT: 3,
    [Building.LumberHut]: 1,
    [Building.Farm]: 2,
    [Building.Mine]: 2,
    [Building.Sawmill]: 1,
    [Building.Windmill]: 1,
    [Building.Forge]: 2,
    [Building.None]: 0,
    [Building.Market]: 0
  };

  for (const tile of board.tiles) {
    if (tile.building !== Building.None) {
      // For advanced buildings (market contributing), multiply getBuildingLevel by factor.
      if (ADVANCED_BUILDINGS.includes(tile.building)) {
        sum += getBuildingLevel(tile, board) * buildingFactors[tile.building];
      } else if (
        tile.building === Building.LumberHut ||
        tile.building === Building.Farm ||
        tile.building === Building.Mine
      ) {
        // Basic resource buildings contribute their flat star value.
        sum += buildingFactors[tile.building];
      }
    }
  }
  return sum;
}