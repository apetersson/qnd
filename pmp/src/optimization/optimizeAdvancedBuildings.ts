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

/** "Prep" actions whose only purpose is to change terrain or building so that we can build something else. */
const PREP_ACTION_IDS = new Set([
  "remove-forest",
  "burn-forest",
  "destroy-building",
  "grow-forest",
]);

/** Returns true if this action is one that places a building (used to find follow-up). */
function isBuildingPlacementAction(action: Action): boolean {
  // Example: match "place-" or "add-" IDs, or check if perform(...) sets tile.building != NONE
  return (
    action.id.startsWith("place-") ||
    action.id.startsWith("add-")
  );
}

/** Create a one-off "composite" Action object that will do the prep and follow-up in one go. */
function createCompositeAction(
  prepAction: Action,
  buildingAction: Action
): Action {
  return {
    id: `${prepAction.id}+${buildingAction.id}`, // Something unique
    description: `${prepAction.description} -> ${buildingAction.description}`,
    cost: prepAction.cost + buildingAction.cost,
    requiredTech: prepAction.requiredTech,
    // or up to you how you merge requiredTech

    perform: (tile, board) => {
      prepAction.perform(tile, board);      // do the prep
      buildingAction.perform(tile, board);  // do the follow-up
    },

    canApply: () => true, // We won't use canApply() on the composite; we do it ourselves below
  };
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
 * @param dynamicOptions An object mapping dynamic action IDs to booleans.
 * @param overallBudget The maximum stars that can be spent.
 * @param progressCallback Callback to report progress (0-1).
 * @returns A Promise that resolves to the optimized board.
 */
export async function optimizeAdvancedBuildingsAsync(
  board: Board,
  cancelToken: { canceled: boolean },
  dynamicOptions: Record<string, boolean>,
  overallBudget: number,
  progressCallback?: (progress: number) => void
): Promise<Board> {
  // Create an initial board copy.
  const initialBoard = copyBoard(board);

  const availableActions = dynamicActions.filter(action => {
    if (dynamicOptions.hasOwnProperty(action.id)) {
      return dynamicOptions[action.id];
    }
    return true;
  });

  console.log(availableActions, "availableActions")
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
   * @param startProgress between 0-1
   * @param endProgress between 0-1
   */
  // Then, inside the function’s candidate generation loop:
  async function rec(
    currentBoard: Board,
    currentHistory: string[],
    currentBudget: number,
    startProgress: number,
    endProgress: number
  ): Promise<void> {
    if (cancelToken.canceled) return;
    // Enforce overall budget limit.
    if (currentBudget > overallBudget) return;
    iterationCount++;
    if (iterationCount % 10000 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
      if (cancelToken.canceled) return;
      // e.g., call callback with the midpoint of [startProgress..endProgress]
      progressCallback?.(startProgress);
      await new Promise(resolve => setTimeout(resolve, 0));
      // Alternatively: progressCallback?.(startProgress);
    }
    // Build the list of candidate actions for the current board.
    const candidateActions: {
      index: number;
      action: Action;
      score: { primary: number; secondary: number };
    }[] = [];

    for (let i = 0; i < currentBoard.tiles.length; i++) {
      const tile = currentBoard.tiles[i];
      if (!tile.cityId) continue;

      // Go through every toggled-on action:
      for (const action of availableActions) {
        if (!dynamicOptions[action.id]) continue;
        if (!action.canApply(tile, currentBoard)) continue;

        // Case 1: Normal (non-prep) action => single-step as usual
        if (!PREP_ACTION_IDS.has(action.id)) {
          // If we can't afford it, skip
          if (currentBudget + action.cost > overallBudget) {
            continue;
          }

          const tempBoard = copyBoard(currentBoard);
          action.perform(tempBoard.tiles[i], tempBoard);
          const primary = calculateMarketBonus(tempBoard);
          const secondary = sumLevelsForFood(tempBoard);
          candidateActions.push({
            index: i,
            action,
            score: {primary, secondary},
          });
        }
        // Case 2: Prep action => see what building placements become possible
        else {
          // Case 2: Prep action => see what building placements become possible

          //  if we're destroying a tile that currently has an advanced building,
          //    skip making a composite. Just add the single "destroy" step, since it might be beneficial to move a building
          if (action.id === "destroy-building" && ADVANCED_BUILDINGS.includes(tile.building)) {
            // If we can't afford it, skip
            if (currentBudget + action.cost > overallBudget) {
              continue;
            }
            // We handle it like a single-step action, ignoring the normal "composite" logic.
            const tempBoard = copyBoard(currentBoard);
            action.perform(tempBoard.tiles[i], tempBoard);
            const primary = calculateMarketBonus(tempBoard);
            const secondary = sumLevelsForFood(tempBoard);

            candidateActions.push({
              index: i,
              action,
              score: {primary, secondary},
            });

            // Don't try to do a composite, so 'continue' here
            continue;
          }

          // Step A: Apply the prep action to a temp board
          const tempBoardPrep = copyBoard(currentBoard);
          action.perform(tempBoardPrep.tiles[i], tempBoardPrep);

          // Step B: Check for all building-laying actions that are toggled on
          for (const buildingAction of availableActions) {
            if (!dynamicOptions[buildingAction.id]) continue;
            if (!isBuildingPlacementAction(buildingAction)) continue;

            const tileAfterPrep = tempBoardPrep.tiles[i];
            if (!buildingAction.canApply(tileAfterPrep, tempBoardPrep)) {
              continue;
            }

            // Step C: We can do "prepAction + buildingAction" as a composite
            const composite = createCompositeAction(action, buildingAction);
            // If we can't afford it, skip
            if (currentBudget + composite.cost > overallBudget) {
              continue;
            }
            // Step D: Apply the composite to measure final score
            const tempBoardFinal = copyBoard(currentBoard);
            composite.perform(tempBoardFinal.tiles[i], tempBoardFinal);
            const primary = calculateMarketBonus(tempBoardFinal);
            const secondary = sumLevelsForFood(tempBoardFinal);

            candidateActions.push({
              index: i,
              action: composite, // store the composite
              score: {primary, secondary},
            });
          }
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
// 1. Sort by cost ascending
      if (a.action.cost !== b.action.cost) {
        return a.action.cost - b.action.cost;
      }
      // 2. Then by secondary descending
      if (b.score.secondary !== a.score.secondary) {
        return b.score.secondary - a.score.secondary;
      }
      // 3. Then by primary descending
      return b.score.primary - a.score.primary;
    });

    // Each candidate gets a sub-slice of [startProgress..endProgress]
    const N = candidateActions.length;
    for (let i = 0; i < N; i++) {
      if (cancelToken.canceled) return;
      const candidate = candidateActions[i];
      // The subrange for the i-th child
      const childStart = startProgress + (endProgress - startProgress) * (i / N);
      const childEnd = startProgress + (endProgress - startProgress) * ((i + 1) / N);

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
      await rec(currentBoard, currentHistory, currentBudget + candidate.action.cost, childStart,
        childEnd);

      // Backtrack: restore original tile state and remove logged action.
      currentBoard.tiles[idx] = {...originalTile};
      currentHistory.pop();
    }
  }

  // Call rec with the entire 0..1 progress range
  await rec(initialBoard, [], 0, 0, 1);
  progressCallback?.(1);
  // Output the results.
  console.log(`Optimization finished. Total iterations: ${iterationCount}. Best bonus: ${bestBonus}`);
  console.log("Optimization history (actions):", bestHistory);
  console.log("Total stars budget used:", bestBudget);

  return bestBoard;
}
