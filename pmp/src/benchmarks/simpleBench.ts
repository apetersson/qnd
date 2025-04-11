// benchmark.ts
import { Board, createInitialBoard } from "../models/Board";
import { getBoardAction } from "../placement/getBoardAction";
import { optimizeAdvancedBuildingsAsync } from "../optimization/optimizeAdvancedBuildings";
import { dynamicActions, LUMBER_HUT_ACTION, MARKET_ACTION, SAWMILL_ACTION } from "../optimization/action";
import { HistoryEntry } from "../models/historyEntry";
import { calculateMarketBonus } from "../models/bonuses";
import { exportBoardState } from "../utils/boardExport";

// Helper: execute a board action given a key and tile coordinates
function executeAction(key: string, x: number, y: number, board: Board): void {
  const tile = board.tiles.find(t => t.x === x && t.y === y);
  if (!tile) {
    console.warn(`Tile not found at (${x}, ${y})`);
    return;
  }
  const action = getBoardAction(key, tile, board);
  if (!action) {
    console.warn(`No action available for key "${key}" at (${x}, ${y}).`);
    return;
  }
  // Perform the action on the board (this mutates board state)
  action.perform(board);
}

// --- Main Benchmark Function ---
async function runBenchmark() {
  console.log("Starting benchmark setup using board actions...");

  // 1. Create a board
  const width = 11;
  const height = 11;
  const board = createInitialBoard(width, height);

  // 2. Set up two cities using the 'c' key:
  // City 1 at (1,1)
  executeAction("c", 1, 1, board);
  // City 2 at (3,3)
  executeAction("c", 3, 3, board);

  // 3. Place three forests using the 'f' key:
  executeAction("f", 0, 0, board);
  executeAction("f", 2, 1, board);
  executeAction("f", 4, 4, board);

  console.log("Board setup complete. Current board state:");
  console.log(exportBoardState(board));

  // 4. Define optimization parameters
  const cancelToken = {canceled: false};

  const chosenActionIds = new Set([SAWMILL_ACTION.id, LUMBER_HUT_ACTION.id, MARKET_ACTION.id]);
  const dynamicOptions = Object.fromEntries(
    dynamicActions.map(action => [action.id, chosenActionIds.has(action.id)])
  );
  // For demonstration, you could also explicitly use constants like SAWMILL_ACTION:
  // dynamicOptions[SAWMILL_ACTION.id] = true;

  console.log("Enabled dynamic options:", Object.keys(dynamicOptions).filter(k => dynamicOptions[k]));

  const overallBudget = 25; // set a modest stars budget for the test
  const cityToggles = {
    "1-1": true,
    "3-3": true,
  };

  // Dummy callbacks for progress and new solutions
  const progressCallback = (progress: number) => {
    // Log progress only occasionally
    if (progress === 1 || Math.random() < 0.01) {
      console.log(`Progress: ${(progress * 100).toFixed(2)}%`);
    }
  };

  const newSolutionCallback = (
    marketBonus: number,
    foodBonus: number,
    iteration: number,
    _boardSnapshot: Board,
    history: HistoryEntry[]
  ) => {
    const totalCost = history.reduce((sum, h) => sum + h.cost, 0);
    console.log(`Solution found: Iter ${iteration}, Market Bonus ${marketBonus}, Food ${foodBonus}, Total Cost ${totalCost}`);
  };

  console.log(`Starting optimization with budget ${overallBudget}...`);

  // 5. Run the optimization routine and measure timing
  console.time("OptimizationTime");
  try {
    const optimizedBoard = await optimizeAdvancedBuildingsAsync(
      board,
      cancelToken,
      dynamicOptions,
      overallBudget,
      progressCallback,
      newSolutionCallback,
      cityToggles
    );
    console.timeEnd("OptimizationTime");
    console.log("Optimization finished.");
// After the optimization completes...
    const startingBonus = calculateMarketBonus(board);
    const optimizedBonus = calculateMarketBonus(optimizedBoard);

    if (optimizedBonus <= startingBonus) {
      throw new Error(
        `Optimization did not improve market bonus: startingBonus ${startingBonus}, optimizedBonus ${optimizedBonus}`
      );
    }

// Optionally, if you have a known expected value (from a previous verified run on this input)
    const EXPECTED_MINIMUM_BONUS = 4;  // adjust according to your known optimum
    if (optimizedBonus < EXPECTED_MINIMUM_BONUS) {
      throw new Error(
        `Optimized bonus (${optimizedBonus}) is below the expected minimum optimal bonus (${EXPECTED_MINIMUM_BONUS}).`
      );
    }

    console.log("Optimization assertion passed with market bonus:", optimizedBonus);
  } catch (error) {
    console.timeEnd("OptimizationTime");
    console.error("Optimization failed:", error);
  }
}

// --- Execute the benchmark test ---
runBenchmark().catch(err => console.error("Benchmark encountered an error:", err));
