// src/optimization/optimizeAdvancedBuildings.ts

import { Board, Building, getNeighbors, Terrain, TileData } from "../models/Board";
import { MARKET_CONTRIBUTIONG_BUILDINGS } from "../models/buildingTypes";
import { MAX_MARKET_LEVEL } from "../placement/placement";

/** Helper function to create a deep copy of the board */
function copyBoard(board: Board): Board {
  return {
    width: board.width,
    height: board.height,
    tiles: board.tiles.map(t => ({ ...t })),
  };
}

/** Returns the building level based on neighboring supporting buildings */
function getBuildingLevel(tile: TileData, board: Board): number {
  switch (tile.building) {
    case Building.Sawmill:
      return getNeighbors(tile, board).filter(n => n.building === Building.LumberHut).length;
    case Building.Windmill:
      return getNeighbors(tile, board).filter(n => n.building === Building.Farm).length;
    case Building.Forge:
      return getNeighbors(tile, board).filter(n => n.building === Building.Mine).length;
    default:
      return 0;
  }
}

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

/** Interface for a dynamic action that can be applied on a tile */
interface Action {
  id: string;
  description: string;
  cost: number; // Positive cost for placements, negative for removals
  /** Applies the action to the given tile (mutating it) */
  perform: (tile: TileData, board: Board) => void;
  /** Determines if the action can be applied to the given tile */
  canApply: (tile: TileData, board: Board) => boolean;
}

/** List of terrains where advanced building actions are allowed */
const ADV_BUILDINGS_TERRAIN = [Terrain.None, Terrain.Field];

/** Dynamic list of actions. You can extend this list with other actions later. */
const dynamicActions: Action[] = [
  {
    id: 'place-sawmill',
    description: 'Place Sawmill',
    cost: 5,
    perform: (tile, board) => {
      tile.building = Building.Sawmill;
    },
    canApply: (tile, board) => {
      if (!ADV_BUILDINGS_TERRAIN.includes(tile.terrain)) return false;
      if (tile.terrain !== Terrain.None) return false;
      if (tile.building !== Building.None) return false;
      if (!tile.cityId) return false;
      // Ensure the city does not already have a sawmill.
      if (board.tiles.some(t => t.cityId === tile.cityId && t.building === Building.Sawmill)) return false;
      // Require a neighboring LumberHut.
      return getNeighbors(tile, board).some(n => n.building === Building.LumberHut);
    },
  },
  {
    id: 'place-forge',
    description: 'Place Forge',
    cost: 5,
    perform: (tile, board) => {
      tile.building = Building.Forge;
    },
    canApply: (tile, board) => {
      if (!ADV_BUILDINGS_TERRAIN.includes(tile.terrain)) return false;
      if (tile.building !== Building.None) return false;
      if (!tile.cityId) return false;
      if (board.tiles.some(t => t.cityId === tile.cityId && t.building === Building.Forge)) return false;
      // Require a neighboring Mine.
      return getNeighbors(tile, board).some(n => n.building === Building.Mine);
    },
  },
  {
    id: 'place-windmill',
    description: 'Place Windmill',
    cost: 5,
    perform: (tile, board) => {
      tile.building = Building.Windmill;
    },
    canApply: (tile, board) => {
      if (!ADV_BUILDINGS_TERRAIN.includes(tile.terrain)) return false;
      if (tile.building !== Building.None) return false;
      if (!tile.cityId) return false;
      if (board.tiles.some(t => t.cityId === tile.cityId && t.building === Building.Windmill)) return false;
      // Require a neighboring Farm.
      return getNeighbors(tile, board).some(n => n.building === Building.Farm);
    },
  },
  {
    id: 'place-market',
    description: 'Place Market',
    cost: 5,
    perform: (tile, board) => {
      tile.building = Building.Market;
    },
    canApply: (tile, board) => {
      if (!ADV_BUILDINGS_TERRAIN.includes(tile.terrain)) return false;
      if (tile.building !== Building.None) return false;
      if (!tile.cityId) return false;
      if (board.tiles.some(t => t.cityId === tile.cityId && t.building === Building.Market)) return false;
      return true; // Market can always be placed if the tile is empty.
    },
  },
  {
    id: 'remove-forest',
    description: 'Remove Forest',
    cost: -1,
    perform: (tile, board) => {
      if (tile.terrain === Terrain.Forest) {
        tile.terrain = Terrain.None;
      }
    },
    canApply: (tile, board) => {
      if (tile.building !== Building.None) return false;
      return tile.terrain === Terrain.Forest;
    },
  },
];

/**
 * Asynchronous optimization function with dynamic actions, history logging,
 * stars budget tracking, and support for activeOptions.
 *
 * Instead of using a fixed candidate list, at each recursion step we build an
 * upfront list of candidate actions. For every tile that is part of a city,
 * we check each available action (filtered by advancedOptions) to see if it can apply.
 * We simulate each candidate action by temporarily applying it on a copy of the board,
 * then compute a score based on calculateMarketBonus (primary) and sumLevelsForFood (secondary).
 * The candidates are sorted in descending order so that the most promising actions are tried first.
 *
 * @param board The board to optimize.
 * @param cancelToken Token to cancel the process.
 * @param advancedOptions Options to enable or disable certain building actions.
 * @param progressCallback Callback to report progress (0-1).
 * @returns A Promise that resolves to the optimized board.
 */
export async function optimizeAdvancedBuildingsAsync(
  board: Board,
  cancelToken: { canceled: boolean },
  advancedOptions: { includeSawmill: boolean; includeWindmill: boolean; includeForge: boolean },
  progressCallback?: (progress: number) => void
): Promise<Board> {
  // Create an initial board copy.
  const initialBoard = copyBoard(board);

  // Filter dynamic actions based on advancedOptions.
  const availableActions = dynamicActions.filter(action => {
    if (action.id === 'place-sawmill' && !advancedOptions.includeSawmill) return false;
    if (action.id === 'place-forge' && !advancedOptions.includeForge) return false;
    if (action.id === 'place-windmill' && !advancedOptions.includeWindmill) return false;
    return true;
  });
  // (Actions like place-market or remove-forest are always allowed.)

  let bestBonus = calculateMarketBonus(initialBoard);
  let bestSecondary = sumLevelsForFood(initialBoard);
  let bestBoard = copyBoard(initialBoard);
  let iterationCount = 0;
  let bestHistory: string[] = [];
  let bestBudget = 0;

  /**
   * Recursive function that, at each call, builds an upfront list of candidate actions
   * for the current board state. Each candidate is simulated to compute a score,
   * then the candidates are sorted and applied in order.
   *
   * @param currentBoard Current board state.
   * @param currentHistory Array recording the history of actions taken.
   * @param currentBudget The accumulated stars budget.
   */
  async function rec(
    currentBoard: Board,
    currentHistory: string[],
    currentBudget: number
  ): Promise<void> {
    if (cancelToken.canceled) return;
    iterationCount++;
    if (iterationCount % 1000 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
      if (cancelToken.canceled) return;
      // progressCallback?.(iterationCount / 100000); // Example progress update.
    }
    // Build the list of candidate actions for the current board.
    const candidateActions: { index: number; action: Action; score: { primary: number; secondary: number } }[] = [];
    for (let i = 0; i < currentBoard.tiles.length; i++) {
      const tile = currentBoard.tiles[i];
      if (!tile.cityId) continue;
      for (const action of availableActions) {
        if (action.canApply(tile, currentBoard)) {
          const tempBoard = copyBoard(currentBoard);
          // Apply the action on the candidate tile in the temporary board.
          action.perform(tempBoard.tiles[i], tempBoard);
          const primary = calculateMarketBonus(tempBoard);
          const secondary = sumLevelsForFood(tempBoard);
          candidateActions.push({ index: i, action, score: { primary, secondary } });
        }
      }
    }

    // If no candidate actions, then we've reached a leaf.
    if (candidateActions.length === 0) {
      const bonus = calculateMarketBonus(currentBoard);
      const secondary = sumLevelsForFood(currentBoard);
      if (bonus > bestBonus || (bonus === bestBonus && secondary > bestSecondary)) {
        bestBonus = bonus;
        bestSecondary = secondary;
        bestBoard = copyBoard(currentBoard);
        bestHistory = [...currentHistory];
        bestBudget = currentBudget;
        console.log(`New best bonus: ${bestBonus} (Secondary: ${secondary}) after ${iterationCount} iterations.`);
      }
      return;
    }

    // Sort candidates descending by primary score, then by secondary.
    candidateActions.sort((a, b) => {
      if (b.score.secondary !== a.score.secondary) return b.score.secondary - a.score.secondary;
      return b.score.primary - a.score.primary;
      // if (b.score.primary !== a.score.primary) return b.score.primary - a.score.primary;
      // return b.score.secondary - a.score.secondary;
    });

    // Iterate over candidate actions.
    for (const candidate of candidateActions) {
      if (cancelToken.canceled) return;
      const idx = candidate.index;
      const tile = currentBoard.tiles[idx];
      // Save original tile for backtracking.
      const originalTile: TileData = { ...tile };

      // Log the action.
      currentHistory.push(
        `${candidate.action.description} at (${tile.x},${tile.y})` +
        (tile.cityId ? ` in city ${tile.cityId}` : "") +
        ` (cost: ${candidate.action.cost})`
      );

      // Apply the candidate action.
      candidate.action.perform(tile, currentBoard);

      // Recurse with the updated board, history, and budget.
      await rec(currentBoard, currentHistory, currentBudget + candidate.action.cost);

      // Backtrack: restore original tile state and remove logged action.
      currentBoard.tiles[idx] = { ...originalTile };
      currentHistory.pop();
    }
  }

  // Start the recursion.
  await rec(initialBoard, [], 0);

  // Output the results.
  console.log(`Optimization finished. Total iterations: ${iterationCount}. Best bonus: ${bestBonus}`);
  console.log("Optimization history (actions):", bestHistory);
  console.log("Total stars budget used:", bestBudget);

  return bestBoard;
}
