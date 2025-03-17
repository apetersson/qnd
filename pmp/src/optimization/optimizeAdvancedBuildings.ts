// src/optimization/optimizeAdvancedBuildings.ts
import { Board, Building, getNeighbors, Terrain, TileData } from "../models/Board";
import { ADVANCED_BUILDINGS, MARKET_CONTRIBUTIONG_BUILDINGS } from "../models/buildingTypes";
import { MAX_MARKET_LEVEL } from "../placement/placement";

function getBuildingLevel(tile: TileData, board: Board): number {
  switch (tile.building) {
    case Building.Sawmill:
      return getNeighbors(tile, board).filter((n) => n.building === Building.LumberHut).length;
    case Building.Windmill:
      return getNeighbors(tile, board).filter((n) => n.building === Building.Farm).length;
    case Building.Forge:
      return getNeighbors(tile, board).filter((n) => n.building === Building.Mine).length;
    default:
      return 0;
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
    if (MARKET_CONTRIBUTIONG_BUILDINGS.includes(nbr.building)) {
      bonus += Math.min(getBuildingLevel(nbr, board), 8);
    }
  }
  return Math.min(bonus, MAX_MARKET_LEVEL);
}

function copyBoard(board: Board): Board {
  return {
    width: board.width,
    height: board.height,
    tiles: board.tiles.map((t) => ({...t})),
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
      return calculateMarketBonusForTile({...tile, building: Building.Market}, board);
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
 * Asynchronous optimization with cancellation token and progress reporting.
 *
 * @param board The board to optimize.
 * @param cancelToken Token to cancel the process.
 * @param advancedOptions Options for advanced buildings.
 * @param progressCallback Callback to report progress (0-1).
 */
export async function optimizeAdvancedBuildingsAsync(
  board: Board,
  cancelToken: { canceled: boolean },
  advancedOptions: { includeSawmill: boolean; includeWindmill: boolean; includeForge: boolean },
  progressCallback?: (progress: number) => void
): Promise<Board> {
  // Kopiere das Board und behalte bereits vorhandene fortgeschrittene Gebäude.
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
      return {index, maxBenefit};
    }
    return null;
  }).filter((x): x is { index: number; maxBenefit: number } => x !== null);
  candidateObjs.sort((a, b) => b.maxBenefit - a.maxBenefit);
  const candidateIndices = candidateObjs.map(obj => obj.index);

  let bestBonus = calculateMarketBonus(initialBoard);
  let bestSecondary = sumLevelsForFood(initialBoard);

  let bestBoard = copyBoard(initialBoard);
  let iterationCount = 0;

  /**
   * Recursive optimization function.
   * @param i Current candidate index.
   * @param currentBoard Current board state.
   * @param usedCityBuildings Map tracking used advanced buildings per city.
   * @param progressMin Lower bound of progress for this recursion.
   * @param progressMax Upper bound of progress for this recursion.
   */
  async function rec(
    i: number,
    currentBoard: Board,
    usedCityBuildings: Map<string, Set<Building>>,
    progressMin: number,
    progressMax: number
  ): Promise<void> {
    if (cancelToken.canceled) return;
    iterationCount++;
    if (iterationCount % 100000 === 0) {
      const currentProgress = progressMin + (i / candidateIndices.length) * (progressMax - progressMin);
      console.log(`Progress: ${(currentProgress * 100).toFixed(2)}%`);
      progressCallback?.(currentProgress);
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (cancelToken.canceled) return;
    }
    if (i === candidateIndices.length) {
      const bonus = calculateMarketBonus(currentBoard);
      const secondary = sumLevelsForFood(currentBoard);
      if (bonus > bestBonus || (bonus === bestBonus && secondary > bestSecondary)) {
        bestBonus = bonus;
        bestSecondary = secondary;
        bestBoard = copyBoard(currentBoard);
        console.log(`New best bonus: ${bestBonus} (Advanced levels: ${secondary}) after ${iterationCount} iterations.`);
      }
      return;
    }
    const candidateRange = (progressMax - progressMin) / candidateIndices.length;
    // Option: do not place an advanced building on this tile.
    await rec(i + 1, currentBoard, usedCityBuildings, progressMin + i * candidateRange, progressMin + (i + 1) * candidateRange);
    if (cancelToken.canceled) return;
    const idx = candidateIndices[i];
    const tile = currentBoard.tiles[idx];
    if (!tile.cityId) {
      await rec(i + 1, currentBoard, usedCityBuildings, progressMin + i * candidateRange, progressMin + (i + 1) * candidateRange);
      return;
    }
    const cityKey = tile.cityId;
    const options: Building[] = [];
    if (advancedOptions.includeSawmill) options.push(Building.Sawmill);
    if (advancedOptions.includeWindmill) options.push(Building.Windmill);
    if (advancedOptions.includeForge) options.push(Building.Forge);
    options.push(Building.Market);
    const sortedOptions = options.slice();
    sortedOptions.sort((a, b) => immediateBenefit(tile, currentBoard, b) - immediateBenefit(tile, currentBoard, a)
    );
    for (const option of sortedOptions) {
      if (cancelToken.canceled) return;
      const usedSet = usedCityBuildings.get(cityKey) || new Set<Building>();
      if (usedSet.has(option)) continue;
      if (!canProvideBonus(tile, currentBoard, option)) continue;
      currentBoard.tiles[idx].building = option;
      usedSet.add(option);
      usedCityBuildings.set(cityKey, usedSet);
      await rec(i + 1, currentBoard, usedCityBuildings, progressMin + i * candidateRange, progressMin + (i + 1) * candidateRange);
      currentBoard.tiles[idx].building = Building.None;
      usedSet.delete(option);
    }
  }

  await rec(0, initialBoard, new Map(initialUsedCityBuildings), 0, 1);
  console.log(`Optimization finished. Total iterations: ${iterationCount}. Best bonus: ${bestBonus}`);
  return bestBoard;
}

function sumLevelsForFood(board: Board): number {
  let sum = 0;
  for (const tile of board.tiles) {
    if (MARKET_CONTRIBUTIONG_BUILDINGS.includes(tile.building)) {
      if (tile.building === Building.Market) {
        sum += calculateMarketBonusForTile(tile, board);
      } else {
        sum += getBuildingLevel(tile, board);
      }
    }
  }
  return sum;
}

export { sumLevelsForFood };
