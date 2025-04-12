// Filename: ./hooks/useOptimizationWorker.ts
import { useState, useEffect, useRef, useCallback } from "react";
import { Board } from "../models/Board";
import { Solution } from "../models/Solution";

// Define message types for worker communication
interface WorkerMessage {
  type: "progress" | "newSolution" | "result" | "error" | "ready" | "cancelled";
  payload?: any; // Adjust type as needed, e.g., number for progress, Solution for newSolution, Board for result
}

export function useOptimizationWorker() {
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [solutionList, setSolutionList] = useState<Solution[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Use useRef to hold the worker instance
  const workerRef = useRef<Worker | null>(null);

  // Initialize worker on mount
  useEffect(() => {
    // Create the worker instance.
    // The `new URL(...)` pattern is needed for Vite to correctly handle the worker file.
    workerRef.current = new Worker(
      new URL("../optimization.worker.ts", import.meta.url),
      { type: "module" } // Important for using ES modules in the worker
    );
    console.log("Optimization worker created.");

    // --- Message Handler ---
    workerRef.current.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const { type, payload } = event.data;
      // console.log("Main thread received message from worker:", type);

      switch (type) {
        case "progress":
          setProgress(payload as number);
          break;
        case "newSolution":
          setSolutionList((prev) => [...prev, payload as Solution]);
          break;
        case "result":
          // Optimization finished successfully
          console.log("Optimization successful. Final board received.");
          // The final board isn't directly used here now,
          // the context relies on solutionList to let user apply a specific one.
          // If you wanted to auto-apply the *absolute best*, you could handle payload here.
          setProgress(1); // Ensure progress shows 100%
          setIsOptimizing(false);
          break;
        case "cancelled":
          console.log("Optimization was cancelled by worker.");
          // No state change needed here as stopOptimization already sets isOptimizing=false
          // setProgress(0); // Optionally reset progress on cancel
          break;
        case "error":
          // This case handles errors *reported via postMessage* from the worker's try/catch
          console.error("Optimization worker reported error:", payload);
          setError(payload as string);
          setIsOptimizing(false);
          setProgress(0); // Reset progress on error
          break;
        case "ready":
          console.log("Optimization worker is ready.");
          // You could enable the "Start" button here if needed
          break;
        default:
          console.warn("Unknown message type received from worker:", type);
      }
    };

    // --- Error Handler ---
    // Catches errors during worker script loading/initialization or unhandled exceptions
    workerRef.current.onerror = (event: ErrorEvent) => {
      debugger;
      // Prevent the default browser error handling (usually logs to console)
      event.preventDefault();
      console.error("Unhandled worker error Event:", event); // Log the full event object
      // Extract more specific details if available
      const errorMessage = event.message || "Unknown worker error";
      const errorLocation = event.filename ? ` in ${event.filename}:${event.lineno}:${event.colno}` : "";
      const fullError = `Worker error: ${errorMessage}${errorLocation}`;

      console.error(fullError); // Log the combined error message
      setError(fullError); // Set the error state for the UI
      setIsOptimizing(false);
      setProgress(0);
    };

    // --- Cleanup on unmount ---
    return () => {
      if (workerRef.current) {
        console.log("Terminating optimization worker.");
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []); // Empty dependency array ensures this runs only once on mount

  // --- Control Functions ---

  const startOptimization = useCallback(
    (
      board: Board,
      dynamicOptions: Record<string, boolean>,
      overallBudget: number,
      cityToggles: Record<string, boolean>
    ) => {
      if (workerRef.current && !isOptimizing) {
        console.log("Sending start message to worker.");
        // Reset state for a new run
        setIsOptimizing(true);
        setProgress(0);
        setSolutionList([]);
        setError(null); // Clear previous errors

        // Send data to the worker
        // Note: Objects are typically transferred using the structured clone algorithm
        workerRef.current.postMessage({
          type: "start",
          payload: {
            board, // Send the current board state
            dynamicOptions,
            overallBudget,
            cityToggles,
          },
        });
      } else {
        console.warn("Cannot start optimization: Worker not ready or already optimizing.");
      }
    },
    [isOptimizing] // Recreate function if isOptimizing changes
  );

  const stopOptimization = useCallback(() => {
    if (workerRef.current && isOptimizing) {
      console.log("Sending cancel message to worker.");
      workerRef.current.postMessage({ type: "cancel" });
      setIsOptimizing(false); // Update UI state immediately
      // Don't reset progress here, let the user see where it stopped.
      // setProgress(0); // Or reset if preferred
    }
  }, [isOptimizing]);

  // --- Return values ---
  return {
    isOptimizing,
    progress,
    solutionList,
    error,
    startOptimization,
    stopOptimization,
  };
}