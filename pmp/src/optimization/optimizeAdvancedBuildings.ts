// src/optimization/optimizeAdvancedBuildings.ts
import { Board, Building, getNeighbors, Terrain, TileData } from "../models/Board";
import { ADVANCED_BUILDINGS } from "../models/buildingTypes";

function getBuildingLevel(tile: TileData, board: Board): number {
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

export function calculateMarketBonus(board: Board): number {
  return board.tiles.reduce((acc, t) => acc + calculateMarketBonusForTile(t, board), 0);
}

function calculateMarketBonusForTile(tile: TileData, board: Board): number {
  if (tile.building !== Building.Market) return 0;
  let bonus = 0;
  const neighbors = getNeighbors(tile, board);
  for (const nbr of neighbors) {
    if (ADVANCED_BUILDINGS.includes(nbr.building)) {
      bonus += Math.min(getBuildingLevel(nbr, board), 8);
    }
  }
  return bonus;
}

export function removeAdvancedBuildings(board: Board): Board {
  return {
    ...board,
    tiles: board.tiles.map((t) =>
      ADVANCED_BUILDINGS.includes(t.building)
        ? {...t, building: Building.None}
        : {...t}
    ),
  };
}

function getNearestCity(tile: TileData, board: Board): TileData | null {
  let minDist = Infinity;
  let nearest: TileData | null = null;
  board.tiles.forEach((t) => {
    if (t.terrain === Terrain.City) {
      const dist = Math.abs(t.x - tile.x) + Math.abs(t.y - tile.y);
      if (dist < minDist) {
        minDist = dist;
        nearest = t;
      }
    }
  });
  return nearest;
}

function copyBoard(board: Board): Board {
  return {
    width: board.width,
    height: board.height,
    tiles: board.tiles.map((t) => ({...t})),
  };
}

/**
 * Quickly checks if the given advanced building can produce *some* market or adjacency bonus
 * if placed on this tile right now. If not, there's no point in even trying.
 */
function canProvideBonus(tile: TileData, board: Board, advBuilding: Building): boolean {
  // return true;
  switch (advBuilding) {
    case Building.Sawmill:
      // Sawmill is valuable only if it has at least 1 adjacent LumberHut
      return getNeighbors(tile, board).some(n => n.building === Building.LumberHut);
    case Building.Windmill:
      // Must have at least 1 adjacent Farm
      return getNeighbors(tile, board).some(n => n.building === Building.Farm);
    case Building.Forge:
      // Must have at least 1 adjacent Mine
      return getNeighbors(tile, board).some(n => n.building === Building.Mine);
    case Building.Market:
      return true;
    default:
      return true;
  }
}


/**
 * Asynchrone Optimierung mit Cancellation-Token.
 * @param board Das zu optimierende Board
 * @param cancelToken Token zum Abbruch
 * @param advancedOptions Auswahl der fortgeschrittenen Gebäudetypen:
 *        includeSawmill, includeWindmill, includeForge (Market wird immer berücksichtigt)
 */
export async function optimizeAdvancedBuildingsAsync(
  board: Board,
  cancelToken: { canceled: boolean },
  advancedOptions: { includeSawmill: boolean; includeWindmill: boolean; includeForge: boolean }
): Promise<Board> {
  const initialBoard = removeAdvancedBuildings(board);
  const candidateIndices = initialBoard.tiles
    .map((tile, index) =>
      // Nur Kandidaten, die bereits einer Stadt zugeordnet sind und leer sind:
      tile.terrain === Terrain.None && tile.building === Building.None && tile.cityId !== null ? index : -1
    )
    .filter((index) => index !== -1);

  let bestBonus = calculateMarketBonus(initialBoard);
  let bestBoard = copyBoard(initialBoard);
  let iterationCount = 0;

  // Map: cityKey -> Set von bereits platzierten fortgeschrittenen Gebäuden
  async function rec(i: number, currentBoard: Board, usedCityBuildings: Map<string, Set<Building>>): Promise<void> {
    if (cancelToken.canceled) return;
    iterationCount++;
    if (iterationCount % 10000 === 0) {
      console.log(`Iteration ${iterationCount}, candidate index ${i}, current best bonus: ${bestBonus}`);
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (cancelToken.canceled) return;
    }
    if (i === candidateIndices.length) {
      const bonus = calculateMarketBonus(currentBoard);
      if (bonus > bestBonus) {
        bestBonus = bonus;
        bestBoard = copyBoard(currentBoard);
        console.log(`New best bonus: ${bestBonus} after ${iterationCount} iterations.`);
      }
      return;
    }
    const idx = candidateIndices[i];
    const tile = currentBoard.tiles[idx];
    // Sicherstellen, dass das Tile in einer Stadt liegt
    if (!tile.cityId) {
      await rec(i + 1, currentBoard, usedCityBuildings);
      return;
    }
    // Option: keine Zuweisung
    await rec(i + 1, currentBoard, usedCityBuildings);
    if (cancelToken.canceled) return;
    const cityKey = tile.cityId;
    // Erstelle Optionsliste basierend auf den Checkbox-Optionen
    const options: Building[] = [];
    if (advancedOptions.includeSawmill) options.push(Building.Sawmill);
    if (advancedOptions.includeWindmill) options.push(Building.Windmill);
    if (advancedOptions.includeForge) options.push(Building.Forge);
    // Market wird immer berücksichtigt
    options.push(Building.Market);
    for (const option of options) {
      if (cancelToken.canceled) return;
      const usedSet = usedCityBuildings.get(cityKey) || new Set<Building>();
      if (usedSet.has(option)) continue;

    // check if placing `option` on this tile *can* yield any benefit ---
    if (!canProvideBonus(tile, currentBoard, option)) {
      // If it's guaranteed to produce no new bonus, skip it:
      continue;
    }

    // Place the building, continue recursion
      currentBoard.tiles[idx].building = option;
      usedSet.add(option);
      usedCityBuildings.set(cityKey, usedSet);
      await rec(i + 1, currentBoard, usedCityBuildings);
      currentBoard.tiles[idx].building = Building.None;
      usedSet.delete(option);
    }
  }

  await rec(0, initialBoard, new Map<string, Set<Building>>());
  console.log(`Optimization finished. Total iterations: ${iterationCount}. Best bonus: ${bestBonus}`);
  return bestBoard;
}
