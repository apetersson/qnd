import { Board, copyBoard } from "../models/Board";
import { HistoryEntry } from "../models/historyEntry";
import { Solution } from "../models/Solution";
import { optimizeAdvancedBuildingsAsync } from "./optimizeAdvancedBuildings";

interface StartMessage {
  type: "start";
  payload: {
    board: Board;
    dynamicOptions: Record<string, boolean>;
    overallBudget: number;
    cityToggles: Record<string, boolean>;
  };
}

interface CancelMessage {
  type: "cancel";
}

type IncomingMessage = StartMessage | CancelMessage;

// --- Worker Logic ---

let cancelToken = {canceled: false};

self.onmessage = async (event: MessageEvent<IncomingMessage>) => {
  const message = event.data;
  console.log("Worker received message:", message.type);

  if (message.type === "start") {
    const {board, dynamicOptions, overallBudget, cityToggles} = message.payload;
    cancelToken = {canceled: false}; // Reset cancel token for new task

    try {
      const progressCallback = (fraction: number) => {
        // Post progress updates back to the main thread
        self.postMessage({type: "progress", payload: fraction});
      };

      const newSolutionCallback = (
        marketBonus: number,
        foodBonus: number,
        iteration: number,
        boardSnapshot: Board,
        history: HistoryEntry[]
      ) => {
        // Post new best solutions back
        // Important: Send a *copy* of the board snapshot and history
        const solution: Solution = {
          marketBonus,
          foodBonus,
          iteration,
          boardSnapshot: copyBoard(boardSnapshot), // Ensure deep copy
          history: [...history],                   // Ensure array copy
        };
        self.postMessage({type: "newSolution", payload: solution});
      };

      console.log("Worker starting optimization...");
      const optimizedBoard = await optimizeAdvancedBuildingsAsync(
        board, // Pass the received board directly
        cancelToken,
        dynamicOptions,
        overallBudget,
        progressCallback,
        newSolutionCallback,
        cityToggles
      );

      // Check if cancelled *after* the async operation might have finished
      if (!cancelToken.canceled) {
        console.log("Worker finished optimization successfully.");
        // Send the final result back
        self.postMessage({type: "result", payload: copyBoard(optimizedBoard)}); // Send copy
      } else {
        console.log("Worker optimization cancelled during execution.");
        // Optionally send a specific cancelled message, or just rely on no 'result'
        self.postMessage({type: "cancelled"});
      }

    } catch (error) {
      console.error("Worker encountered an error:", error);
      // Send error details back to the main thread
      self.postMessage({
        type: "error",
        payload: error instanceof Error ? error.message : String(error),
      });
    }
  } else if (message.type === "cancel") {
    console.log("Worker received cancel request.");
    cancelToken.canceled = true;
  }
};

// Inform the main thread that the worker is ready (optional)
self.postMessage({type: "ready"});
console.log("Optimization worker script loaded and ready.");