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

function copyBoard(board: Board): Board {
  return {
    width: board.width,
    height: board.height,
    tiles: board.tiles.map((t) => ({ ...t })),
  };
}

/**
 * Computes the immediate benefit if the advanced building is placed on this tile.
 */
function immediateBenefit(tile: TileData, board: Board, advBuilding: Building): number {
  switch (advBuilding) {
    case Building.Sawmill:
      return getNeighbors(tile, board).filter(n => n.building === Building.LumberHut).length;
    case Building.Windmill:
      return getNeighbors(tile, board).filter(n => n.building === Building.Farm).length;
    case Building.Forge:
      return getNeighbors(tile, board).filter(n => n.building === Building.Mine).length;
    case Building.Market:
      return calculateMarketBonusForTile({ ...tile, building: Building.Market }, board);
    default:
      return 0;
  }
}

/**
 * Checks whether placing the given advanced building on this tile can produce any bonus.
 */
function canProvideBonus(tile: TileData, board: Board, advBuilding: Building): boolean {
  switch (advBuilding) {
    case Building.Sawmill:
      return getNeighbors(tile, board).some(n => n.building === Building.LumberHut);
    case Building.Windmill:
      return getNeighbors(tile, board).some(n => n.building === Building.Farm);
    case Building.Forge:
      return getNeighbors(tile, board).some(n => n.building === Building.Mine);
    case Building.Market:
      return true;
    default:
      return true;
  }
}

/**
 * Asynchronous optimization with cancellation token.
 * @param board The board to optimize.
 * @param cancelToken Token to cancel the process.
 * @param advancedOptions Options for advanced buildings:
 *        includeSawmill, includeWindmill, includeForge (Market is always considered)
 */
export async function optimizeAdvancedBuildingsAsync(
  board: Board,
  cancelToken: { canceled: boolean },
  advancedOptions: { includeSawmill: boolean; includeWindmill: boolean; includeForge: boolean }
): Promise<Board> {
  // Copy the board while preserving existing advanced buildings.
  const initialBoard = copyBoard(board);

  // Pre-populate the map with advanced buildings already present.
  const initialUsedCityBuildings = new Map<string, Set<Building>>();
  for (const tile of initialBoard.tiles) {
    if (tile.cityId && ADVANCED_BUILDINGS.includes(tile.building)) {
      if (!initialUsedCityBuildings.has(tile.cityId)) {
        initialUsedCityBuildings.set(tile.cityId, new Set<Building>());
      }
      initialUsedCityBuildings.get(tile.cityId)!.add(tile.building);
    }
  }

  // Build candidate indices for empty tiles assigned to a city.
  const candidateObjs = initialBoard.tiles.map((tile, index) => {
    if (tile.terrain === Terrain.None && tile.building === Building.None && tile.cityId !== null) {
      const opts: Building[] = [];
      if (advancedOptions.includeSawmill) opts.push(Building.Sawmill);
      if (advancedOptions.includeWindmill) opts.push(Building.Windmill);
      if (advancedOptions.includeForge) opts.push(Building.Forge);
      opts.push(Building.Market);
      const maxBenefit = Math.max(...opts.map(option => immediateBenefit(tile, initialBoard, option)));
      return { index, maxBenefit };
    }
    return null;
  }).filter((x): x is { index: number; maxBenefit: number } => x !== null);
  candidateObjs.sort((a, b) => b.maxBenefit - a.maxBenefit);
  const candidateIndices = candidateObjs.map(obj => obj.index);

  let bestBonus = calculateMarketBonus(initialBoard);
  let bestBoard = copyBoard(initialBoard);
  let iterationCount = 0;

  // Recursive function with used advanced buildings tracked per city.
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
    if (!tile.cityId) {
      await rec(i + 1, currentBoard, usedCityBuildings);
      return;
    }
    // Option: do not place an advanced building on this tile.
    await rec(i + 1, currentBoard, usedCityBuildings);
    if (cancelToken.canceled) return;
    const cityKey = tile.cityId;
    const options: Building[] = [];
    if (advancedOptions.includeSawmill) options.push(Building.Sawmill);
    if (advancedOptions.includeWindmill) options.push(Building.Windmill);
    if (advancedOptions.includeForge) options.push(Building.Forge);
    options.push(Building.Market);

    // Sort the options based on immediate benefit (highest first).
    const sortedOptions = options.slice().sort(
      (a, b) => immediateBenefit(tile, currentBoard, b) - immediateBenefit(tile, currentBoard, a)
    );

    for (const option of sortedOptions) {
      if (cancelToken.canceled) return;
      const usedSet = usedCityBuildings.get(cityKey) || new Set<Building>();
      if (usedSet.has(option)) continue;
      if (!canProvideBonus(tile, currentBoard, option)) continue;

      // Place the building and continue recursion.
      currentBoard.tiles[idx].building = option;
      usedSet.add(option);
      usedCityBuildings.set(cityKey, usedSet);
      await rec(i + 1, currentBoard, usedCityBuildings);
      // Backtrack.
      currentBoard.tiles[idx].building = Building.None;
      usedSet.delete(option);
    }
  }

  await rec(0, initialBoard, new Map(initialUsedCityBuildings));
  console.log(`Optimization finished. Total iterations: ${iterationCount}. Best bonus: ${bestBonus}`);
  return bestBoard;
}
