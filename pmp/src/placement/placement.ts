// src/placement/placement.ts
import { Board, Building, getNeighbors, Terrain, TileData } from "../models/Board";
import { ADVANCED_BUILDINGS } from "../models/buildingTypes";

export function getBuildingLevel(tile: TileData, board: Board): number {
  switch (tile.building) {
    case Building.Sawmill:
      return getNeighbors(tile, board).filter((n) => n.building === Building.LumberHut).length;
    case Building.Windmill:
      return getNeighbors(tile, board).filter((n) => n.building === Building.Farm).length;
    case Building.Forge:
      return getNeighbors(tile, board).filter((n) => n.building === Building.Mine).length;
    default:
      return 1;
  }
}

export const MAX_MARKET_LEVEL = 8;

export function getMarketLevel(tile: TileData, board: Board): number {
  let sum = 0;
  const neighbors = getNeighbors(tile, board);
  for (const nbr of neighbors) {
    if (ADVANCED_BUILDINGS.includes(nbr.building)) {
      sum += getBuildingLevel(nbr, board);
    }
  }
  return Math.min(sum, MAX_MARKET_LEVEL);
}

export function placeBasicResourceBuildings(board: Board): Board {
  const newBoard: Board = {...board, tiles: board.tiles.map((t) => ({...t}))};
  newBoard.tiles.forEach((tile, i) => {
    // Only place basic buildings in tiles assigned to a city
    if (tile.cityId === null) return;
    if (tile.building !== Building.None) return;
    if (tile.terrain === Terrain.Field) {
      newBoard.tiles[i].building = Building.Farm;
    } else if (tile.terrain === Terrain.Forest) {
      newBoard.tiles[i].building = Building.LumberHut;
    } else if (tile.terrain === Terrain.Mountain) {
      newBoard.tiles[i].building = Building.Mine;
    }
  });
  return newBoard;
}

/**
 * Places advanced buildings (S, W, O, M) only in city areas.
 * For each city (identified by cityId), for each advanced type – if not already present –
 * selects the optimal, empty tile (terrain === NONE, building === NONE) with maximum potential.
 */
export function placeAdvancedBuildingsSimple(board: Board): Board {
  const newBoard: Board = {...board, tiles: board.tiles.map(t => ({...t}))};

  // Get all existing city IDs
  const cityIds = Array.from(
    new Set(newBoard.tiles.filter(t => t.cityId !== null).map(t => t.cityId))
  ) as string[];

  // Use the imported ADVANCED_BUILDINGS constant
  for (const cityId of cityIds) {
    for (const advType of ADVANCED_BUILDINGS) {
      const alreadyPlaced = newBoard.tiles.some(
        t => t.cityId === cityId && t.building === advType
      );
      if (alreadyPlaced) continue;

      // Filter all candidate tiles in the city that are empty
      const candidates = newBoard.tiles.filter(
        t => t.cityId === cityId && t.terrain === Terrain.None && t.building === Building.None
      );
      let bestCandidate: TileData | null = null;
      let bestPotential = 0;
      for (const candidate of candidates) {
        let potential = 0;
        if (advType === Building.Market) {
          potential = getMarketLevel(candidate, newBoard);
        } else {
          // Simulate setting the advanced building; use getBuildingLevel as an indicator
          const simulatedTile: TileData = {...candidate, building: advType};
          potential = getBuildingLevel(simulatedTile, newBoard);
        }
        if (potential > bestPotential) {
          bestPotential = potential;
          bestCandidate = candidate;
        }
      }
      // Place the advanced building if a candidate is found and potential > 0
      if (bestCandidate && bestPotential > 0) {
        const idx = newBoard.tiles.findIndex(
          t => t.x === bestCandidate!.x && t.y === bestCandidate!.y
        );
        if (idx !== -1) {
          newBoard.tiles[idx].building = advType;
        }
      }
    }
  }
  return newBoard;
}

export function removeNonContributingBasicBuildings(board: Board): Board {
  const newBoard: Board = {...board, tiles: board.tiles.map((t) => ({...t}))};
  newBoard.tiles.forEach((tile, i) => {
    if (tile.building === Building.Farm) {
      const supports = getNeighbors(tile, newBoard).some((n) => n.building === Building.Windmill);
      if (!supports) {
        newBoard.tiles[i].building = Building.None;
      }
    } else if (tile.building === Building.LumberHut) {
      const supports = getNeighbors(tile, newBoard).some((n) => n.building === Building.Sawmill);
      if (!supports) {
        newBoard.tiles[i].building = Building.None;
      }
    } else if (tile.building === Building.Mine) {
      const supports = getNeighbors(tile, newBoard).some((n) => n.building === Building.Forge);
      if (!supports) {
        newBoard.tiles[i].building = Building.None;
      }
    }
  });
  return newBoard;
}
