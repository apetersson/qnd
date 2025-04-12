// Filename: ./contexts/OptimizationContext.tsx

import React, { createContext, ReactNode, useContext, useEffect, useState, } from "react";
// import { optimizeAdvancedBuildingsAsync } from "../optimization/optimizeAdvancedBuildings"; // No longer directly needed here
import { dynamicActions } from "../optimization/action";
import { useBoardState } from "./BoardStateContext";
import { defaultTechEnabled } from "../models/Technology";
// import { copyBoard } from "../models/Board"; // No longer needed here
import { Solution } from "../models/Solution";
import { useOptimizationWorker } from "../hooks/useOptimizationWorker"; // Import the new hook

interface OptimizationContextType {
  dynamicOptions: Record<string, boolean>;
  setDynamicOptions: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  overallBudget: number;
  setOverallBudget: React.Dispatch<React.SetStateAction<number>>;
  isOptimizing: boolean; // Provided by the hook
  startOptimization: () => void; // Simplified signature
  stopOptimization: () => void; // Provided by the hook
  progress: number; // Provided by the hook
  solutionList: Solution[]; // Provided by the hook
  optimizationError: string | null; // Expose errors from the hook
  cityToggles: Record<string, boolean>;
  setCityToggles: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}

const OptimizationContext = createContext<OptimizationContextType | undefined>(
  undefined
);

function buildDefaultDynamicOptions() {
  const result: Record<string, boolean> = {};
  for (const action of dynamicActions) {
    result[action.id] = defaultTechEnabled[action.requiredTech];
  }
  return result;
}

export const OptimizationProvider: React.FC<{ children: ReactNode }> = ({
                                                                          children,
                                                                        }) => {
  const { board } = useBoardState(); // Keep board state access

  // State managed within the provider
  const [dynamicOptions, setDynamicOptions] = useState<Record<string, boolean>>(
    buildDefaultDynamicOptions
  );
  const [overallBudget, setOverallBudget] = useState<number>(30);
  const [cityToggles, setCityToggles] = useState<Record<string, boolean>>({});

  // State and controls managed by the worker hook
  const {
    isOptimizing,
    progress,
    solutionList,
    error: optimizationError, // Rename for clarity in context
    startOptimization: startWorkerOptimization, // Rename for clarity
    stopOptimization, // Use directly
  } = useOptimizationWorker();

  // Keep city toggles updated based on the board
  useEffect(() => {
    const cities = Array.from(new Set(board.tiles.map(t => t.cityId).filter(Boolean))) as string[];
    setCityToggles(prev => {
      const updated: Record<string, boolean> = {};
      for (const city of cities) {
        updated[city] = prev[city] ?? true; // Default to true if new
      }
      // Prune toggles for cities that no longer exist
      const finalToggles: Record<string, boolean> = {};
      for (const cityId in updated) {
        if (cities.includes(cityId)) {
          finalToggles[cityId] = updated[cityId]!;
        }
      }
      return finalToggles;
    });
  }, [board]); // Rerun when board changes

  // Context's start function now calls the hook's start function
  const startOptimization = () => {
    if (!isOptimizing) {
      // Pass the necessary data to the hook's start function
      startWorkerOptimization(
        board, // Pass the current board state
        dynamicOptions,
        overallBudget,
        cityToggles
      );
    }
  };

  // Stop function is used directly from the hook

  return (
    <OptimizationContext.Provider
      value={{
        dynamicOptions,
        setDynamicOptions,
        overallBudget,
        setOverallBudget,
        isOptimizing, // From hook
        startOptimization, // Wrapper function
        stopOptimization, // From hook
        progress, // From hook
        solutionList, // From hook
        optimizationError, // From hook
        cityToggles,
        setCityToggles,
      }}
    >
      {children}
    </OptimizationContext.Provider>
  );
};

export function useOptimizationContext(): OptimizationContextType {
  const context = useContext(OptimizationContext);
  if (!context) {
    throw new Error(
      "useOptimizationContext must be used within an OptimizationProvider"
    );
  }
  return context;
}