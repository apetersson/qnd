import { Board, copyBoard, getNeighbors, TileData } from "../models/Board";
import { Action, dynamicActions, isBuildingPlacementAction } from "./action";
import { HistoryEntry } from "../models/historyEntry";
import { calculateMarketBonus, sumLevelsForFood } from "../models/bonuses";

/** "Prep" actions whose only purpose is to change terrain or building so that we can build something else. */
const PREP_ACTION_IDS = new Set([
  "remove-forest",
  "burn-forest",
  "grow-forest",
]);

/**
 * Compute a 32-bit FNV-1a hash of a string.
 * Returns an 8-character hexadecimal string.
 */
function hashString(str: string): string {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  // Convert to unsigned 32-bit integer and then to hex.
  return ("00000000" + (hash >>> 0).toString(16)).slice(-8);
}

/**
 * Compute a hash for the board state.
 * We assume that board.tiles is in a consistent order.
 */
function boardHash(board: Board): string {
  return hashString(JSON.stringify(board.tiles));
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
 * Interface to represent evaluation metrics of a solution.
 */
interface SolutionMetrics {
  bonus: number;
  secondary: number;
  cost: number;
}

/**
 * Comparator for two solution metrics.
 * Returns a positive value if a is better than b.
 * - Higher bonus is better.
 * - If bonus is equal, higher secondary is better.
 * - If both bonus and secondary are equal, lower cost is better.
 */
function compareSolutionMetrics(a: SolutionMetrics, b: SolutionMetrics): number {
  if (a.bonus !== b.bonus) return a.bonus - b.bonus;
  if (a.secondary !== b.secondary) return a.secondary - b.secondary;
  return b.cost - a.cost; // lower cost is better
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
 * @param newSolutionCallback Callback that receives a new best solution.
 * @param cityToggles A mapping of city IDs to a boolean indicating whether the city is toggled on.
 * @returns A Promise that resolves to the optimized board.
 */
export async function optimizeAdvancedBuildingsAsync(
  board: Board,
  cancelToken: { canceled: boolean },
  dynamicOptions: Record<string, boolean>,
  overallBudget: number,
  progressCallback: (progress: number) => void,
  newSolutionCallback: (
    marketBonus: number,
    foodBonus: number,
    iteration: number,
    boardSnapshot: Board,
    history: HistoryEntry[]
  ) => void,
  cityToggles: Record<string, boolean>
): Promise<Board> {
  // Create an initial board copy.
  const initialBoard = copyBoard(board);

  const availableActions = dynamicActions.filter(action => {
    if (dynamicOptions.hasOwnProperty(action.id)) {
      return dynamicOptions[action.id];
    }
    return true;
  });

  console.log(availableActions, "availableActions");
  let bestBonus = calculateMarketBonus(initialBoard);
  let bestSecondary = sumLevelsForFood(initialBoard);
  let bestBoard = copyBoard(initialBoard);
  let iterationCount = 0;
  let bestHistory: HistoryEntry[] = [];
  let bestBudget = 0;

  // Memo table: key is board state, value is the minimum cost at which we reached that state.
  const memo = new Map<string, number>();

  /**
   * Recursive function that, at each call, builds an upfront list of candidate actions
   * for the current board state. Each candidate is simulated to compute a score,
   * then the candidates are sorted and applied in order.
   *
   * The function enforces the overall budget by skipping any candidate that would exceed it,
   * and aborting the branch if the current cost already exceeds the budget.
   *
   * @param currentBoard Current board state.
   * @param currentHistory Array recording the history of actions taken (as HistoryEntry objects).
   * @param currentBudget The accumulated stars budget.
   * @param startProgress between 0-1.
   * @param endProgress between 0-1.
   */
  // Then, inside the function’s candidate generation loop:
  async function rec(
    currentBoard: Board,
    currentHistory: HistoryEntry[],
    currentBudget: number,
    startProgress: number,
    endProgress: number
  ): Promise<void> {
    if (cancelToken.canceled) return;
    // Enforce overall budget limit.
    if (currentBudget > overallBudget) return;

    // --- Memoization: compute a key for the current board state.
    const key = boardHash(currentBoard);
    // If we have seen this state before with a lower (or equal) cost, prune.
    if (memo.has(key) && memo.get(key)! <= currentBudget) {
      return;
    }
    // Otherwise, store the current cost.
    memo.set(key, currentBudget);

    // Check and update the best solution even if not at a leaf
    const currentBonus = calculateMarketBonus(currentBoard);
    const currentSecondary = sumLevelsForFood(currentBoard);
    if (currentBonus > bestBonus || (currentBonus === bestBonus && currentSecondary > bestSecondary)) {
      bestBonus = currentBonus;
      bestSecondary = currentSecondary;
      bestBoard = copyBoard(currentBoard);
      bestHistory = [...currentHistory];
      bestBudget = currentBudget;
      console.log(`New best bonus (intermediate): ${bestBonus} (Secondary: ${currentSecondary}) at iteration ${iterationCount}.`);
      newSolutionCallback(
        bestBonus,
        bestSecondary,
        iterationCount,
        copyBoard(currentBoard),
        [...currentHistory]
      );
    }

    iterationCount++;
    if (iterationCount % 1000 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
      if (cancelToken.canceled) return;
      console.log(memo.size, "memo.size");
      progressCallback?.(startProgress);
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    const remainingBudget = overallBudget - currentBudget;

    // Build the list of candidate actions for the current board.
    const candidateActions: {
      index: number;
      action: Action;
      score: { primary: number; secondary: number };
    }[] = [];

    for (let i = 0; i < currentBoard.tiles.length; i++) {
      const tile = currentBoard.tiles[i]!;
      if (!tile.cityId || !cityToggles[tile.cityId]) continue;

      // Go through every toggled-on action:
      for (const action of availableActions) {
        if (!dynamicOptions[action.id]) continue;
        if (!action.canApply(tile, currentBoard, currentHistory, remainingBudget)) continue;

        // Case 1: Normal (non-prep) action => single-step as usual
        if (!PREP_ACTION_IDS.has(action.id)) {
          // If we can't afford it, skip
          if (currentBudget + action.cost > overallBudget) {
            continue;
          }

          const tempBoard = copyBoard(currentBoard);
          action.perform(tempBoard.tiles[i]!, tempBoard);
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
          // Step A: Apply the prep action to a temp board
          const tempBoardPrep = copyBoard(currentBoard);
          action.perform(tempBoardPrep.tiles[i]!, tempBoardPrep);

          // Step B: Check for all building-laying actions that are toggled on
          for (const buildingAction of availableActions) {
            if (!dynamicOptions[buildingAction.id]) continue;
            if (!isBuildingPlacementAction(buildingAction.id)) continue;

            const tileAfterPrep = tempBoardPrep.tiles[i]!;
            if (!buildingAction.canApply(tileAfterPrep, tempBoardPrep, currentHistory, remainingBudget)) {
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
            composite.perform(tempBoardFinal.tiles[i]!, tempBoardFinal);
            const primary = calculateMarketBonus(tempBoardFinal);
            const secondary = sumLevelsForFood(tempBoardFinal);

            candidateActions.push({
              index: i,
              action: composite,
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
        console.log("Optimization history (actions):", bestHistory);
        newSolutionCallback(
          bestBonus,
          bestSecondary,
          iterationCount,
          copyBoard(currentBoard), // Make sure this is a deep copy of the board
          [...currentHistory]      // A copy of the history array
        );
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      return;
    }

    // Sort candidates descending by secondary score, then primary.
    type Comparator<T> = (a: T, b: T) => number;

// Helper to compose multiple comparators.
    function composeComparators<T>(comparators: Comparator<T>[]): Comparator<T> {
      return (a: T, b: T) => {
        for (const comparator of comparators) {
          const result = comparator(a, b);
          if (result !== 0) return result;
        }
        return 0;
      };
    }

// Candidate type from your optimization function.
    interface Candidate {
      index: number;
      action: Action;
      score: {
        primary: number;
        secondary: number;
      };
    }

// Define each comparator.
    const costComparator: Comparator<Candidate> = (a, b) =>
      a.action.cost - b.action.cost;

    const secondaryComparator: Comparator<Candidate> = (a, b) =>
      b.score.secondary - a.score.secondary;

    const primaryComparator: Comparator<Candidate> = (a, b) =>
      b.score.primary - a.score.primary;

    const adjacentComparator: Comparator<Candidate> = (a, b) => {
      const aTile = currentBoard.tiles[a.index]!;
      const bTile = currentBoard.tiles[b.index]!;
      const aAdjacent = getNeighbors(aTile, currentBoard).some(
        nbr => nbr.cityId && nbr.cityId !== aTile.cityId
      );
      const bAdjacent = getNeighbors(bTile, currentBoard).some(
        nbr => nbr.cityId && nbr.cityId !== bTile.cityId
      );
      if (aAdjacent && !bAdjacent) return -1;
      if (!aAdjacent && bAdjacent) return 1;
      return 0;
    };

// Compose them in desired order.
    const combinedComparator = composeComparators<Candidate>([
      adjacentComparator,
      costComparator,
      secondaryComparator,
      primaryComparator,
    ]);

// Then sort your candidateActions array:
    candidateActions.sort(combinedComparator);

    // Each candidate gets a sub-slice of [startProgress...endProgress]
    const N = candidateActions.length;
    for (let i = 0; i < N; i++) {
      if (cancelToken.canceled) return;
      const candidate = candidateActions[i]!;
      // The subrange for the i-th child
      const childStart = startProgress + (endProgress - startProgress) * (i / N);
      const childEnd = startProgress + (endProgress - startProgress) * ((i + 1) / N);

      // Skip candidate if adding its cost would exceed the overall budget.
      if (currentBudget + candidate.action.cost > overallBudget) continue;
      const idx = candidate.index;
      const tile = currentBoard.tiles[idx]!;

      // Save original tile for backtracking.
      const originalTile: TileData = {...tile};

      // Log the candidate action as a HistoryEntry.
      const historyEntry: HistoryEntry = {
        actionId: candidate.action.id,
        description: `${candidate.action.description} at (${tile.x},${tile.y})` +
          (tile.cityId ? ` in city ${tile.cityId}` : "") +
          ` (cost: ${candidate.action.cost})`,
        x: tile.x,
        y: tile.y,
        cityId: tile.cityId,
        cost: candidate.action.cost,
      };
      currentHistory.push(historyEntry);

      // Apply the candidate action.
      candidate.action.perform(tile, currentBoard);

      // Recurse with the updated board, history, and budget.
      await rec(currentBoard, currentHistory, currentBudget + candidate.action.cost, childStart,
        childEnd);

      // Backtrack: restore original tile state and remove logged history.
      currentBoard.tiles[idx] = {...originalTile};
      currentHistory.pop();
    }
  }

  // Call rec with the entire 0..1 progress range
  await rec(initialBoard, [], 0, 0, 1);
  if (!cancelToken.canceled) {
    progressCallback?.(1);
  }
  // Output the results.
  console.log(`Optimization finished. Total iterations: ${iterationCount}. Best bonus: ${bestBonus}`);
  console.log("Optimization history (actions):", bestHistory);
  console.log("Total stars budget used:", bestBudget);
  console.log("total boards checked", memo.size);

  return bestBoard;
}
