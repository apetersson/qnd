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
export interface Action {
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
export const dynamicActions: Action[] = [
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
  // New actions:
  {
    id: 'burn-forest',
    description: 'Burn Forest',
    cost: 5,
    perform: (tile, board) => {
      if (tile.terrain === Terrain.Forest) {
        tile.terrain = Terrain.Field;
      }
    },
    canApply: (tile, board) => {
      // Only allow burning if the tile is a forest and has no building.
      return tile.terrain === Terrain.Forest && tile.building === Building.None;
    },
  },
  {
    id: 'destroy-building',
    description: 'Destroy Building',
    cost: 5,
    perform: (tile, board) => {
      // Remove any building on the tile.
      tile.building = Building.None;
    },
    canApply: (tile, board) => {
      // Can only destroy if there's a building present.
      return tile.building !== Building.None;
    },
  },
  {
    id: 'grow-forest',
    description: 'Grow Forest',
    cost: 5,
    perform: (tile, board) => {
      // Transform an empty tile into a forest.
      tile.terrain = Terrain.Forest;
    },
    canApply: (tile, board) => {
      // Allow growth only if the tile is completely empty.
      return tile.terrain === Terrain.None && tile.building === Building.None;
    },
  },
  {
    id: 'add-lumber-hut',
    description: 'Add Lumber Hut',
    cost: 3,
    perform: (tile, board) => {
      tile.building = Building.LumberHut;
    },
    canApply: (tile, board) => {
      // Only allowed on forest tiles with no building.
      return tile.terrain === Terrain.Forest && tile.building === Building.None;
    },
  },
  {
    id: 'add-farm',
    description: 'Add Farm',
    cost: 5,
    perform: (tile, board) => {
      tile.building = Building.Farm;
    },
    canApply: (tile, board) => {
      // Only allowed on field tiles with no building.
      return tile.terrain === Terrain.Field && tile.building === Building.None;
    },
  },
  {
    id: 'add-mine',
    description: 'Add Mine',
    cost: 5,
    perform: (tile, board) => {
      tile.building = Building.Mine;
    },
    canApply: (tile, board) => {
      // Only allowed on mountain tiles with no building.
      return tile.terrain === Terrain.Mountain && tile.building === Building.None;
    },
  },
];

/**
 * Asynchronous optimization function with dynamic actions, history logging,
 * stars budget tracking, and support for an overall budget limit.
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
 * @param advancedOptions An object mapping dynamic action IDs to booleans.
 * @param overallBudget The maximum stars that can be spent.
 * @param progressCallback Callback to report progress (0-1).
 * @returns A Promise that resolves to the optimized board.
 */
export async function optimizeAdvancedBuildingsAsync(
  board: Board,
  cancelToken: { canceled: boolean },
  advancedOptions: Record<string, boolean>,
  overallBudget: number,
  progressCallback?: (progress: number) => void
): Promise<Board> {
  // Create an initial board copy.
  const initialBoard = copyBoard(board);

  const availableActions = dynamicActions.filter(action => {
    if (advancedOptions.hasOwnProperty(action.id)) {
      return advancedOptions[action.id];
    }
    return true;
  });
  // (Actions like place-market, remove-forest, burn-forest, destroy-building, and grow-forest are always allowed.)

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
   * The function enforces the overall budget by skipping any candidate that would exceed it,
   * and aborting the branch if the current cost already exceeds the budget.
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
    // Enforce overall budget limit.
    if (currentBudget > overallBudget) return;
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
          // Check if applying this action would exceed the overall budget.
          if (currentBudget + action.cost > overallBudget) continue;
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

    // Sort candidates descending by secondary score, then primary.
    candidateActions.sort((a, b) => {
      if (b.score.secondary !== a.score.secondary) return b.score.secondary - a.score.secondary;
      return b.score.primary - a.score.primary;
      // if (b.score.primary !== a.score.primary) return b.score.primary - a.score.primary;
      // return b.score.secondary - a.score.secondary;
    });

    // Iterate over candidate actions.
    for (const candidate of candidateActions) {
      if (cancelToken.canceled) return;
      // Skip candidate if adding its cost would exceed the overall budget.
      if (currentBudget + candidate.action.cost > overallBudget) continue;
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
