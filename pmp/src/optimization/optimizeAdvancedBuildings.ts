// src/optimization/optimizeAdvancedBuildings.ts

import { Board, Building, getNeighbors, TileData } from "../models/Board";
import { ADVANCED_BUILDINGS, MARKET_CONTRIBUTIONG_BUILDINGS } from "../models/buildingTypes";
import { getBuildingLevel, MAX_MARKET_LEVEL } from "../placement/placement";
import { Action, dynamicActions } from "./action";

/** Helper function to create a deep copy of the board */
function copyBoard(board: Board): Board {
  return {
    width: board.width,
    height: board.height,
    tiles: board.tiles.map(t => ({...t})),
  };
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
  const buildingFactors: Record<Building, number> = {
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
  _progressCallback?: (progress: number) => void
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
          candidateActions.push({index: i, action, score: {primary, secondary}});
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
      const originalTile: TileData = {...tile};

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
      currentBoard.tiles[idx] = {...originalTile};
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
