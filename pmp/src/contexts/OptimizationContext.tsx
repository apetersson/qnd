// Filename: ./contexts/OptimizationContext.tsx

import React, { createContext, ReactNode, useContext, useRef, useState, } from "react";
import { optimizeAdvancedBuildingsAsync } from "../optimization/optimizeAdvancedBuildings";
import { dynamicActions } from "../optimization/action";
import { useBoardState } from "./BoardStateContext";
import { defaultTechEnabled } from "../models/Technology";

interface Solution {
  marketBonus: number;
  foodBonus: number;
  iteration: number;
}

interface OptimizationContextType {
  dynamicOptions: Record<string, boolean>;
  setDynamicOptions: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  overallBudget: number;
  setOverallBudget: React.Dispatch<React.SetStateAction<number>>;
  isOptimizing: boolean;
  startOptimization: () => Promise<void>;
  stopOptimization: () => void;
  progress: number;
  solutionList: Solution[];
}

const OptimizationContext = createContext<OptimizationContextType | undefined>(
  undefined
);

function buildDefaultDynamicOptions() {
  const result: Record<string, boolean> = {};
  for (const action of dynamicActions) {
    // Enable only if its required tech is default-enabled
    result[action.id] = defaultTechEnabled[action.requiredTech];
  }
  return result;
}

export const OptimizationProvider: React.FC<{ children: ReactNode }> = ({
                                                                          children,
                                                                        }) => {
  const {board, setBoard} = useBoardState();

  const [dynamicOptions, setDynamicOptions] = useState<Record<string, boolean>>(
    buildDefaultDynamicOptions
  );
  const [overallBudget, setOverallBudget] = useState<number>(30);
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [solutionList, setSolutionList] = useState<Solution[]>([]);
  const cancelTokenRef = useRef<{ canceled: boolean }>({canceled: false});

  const startOptimization = async () => {
    setSolutionList([]); // Reset solution list
    cancelTokenRef.current = {canceled: false};
    setIsOptimizing(true);
    // Reset progress bar to 0
    setProgress(0);

    const result = await optimizeAdvancedBuildingsAsync(
      board,
      cancelTokenRef.current,
      dynamicOptions,
      overallBudget,
      (fraction) => {
        console.log("fraction", fraction);
        // This callback is invoked occasionally from the recursion
        // fraction is in [0..1]
        setProgress(fraction);
      },
      (marketBonus, foodBonus, iteration) => {
        // Append new best solution to the solutionList
        setSolutionList(prev => [...prev, {marketBonus, foodBonus, iteration}]);
      }
    );
    setBoard(result);

    setIsOptimizing(false);
  };

  const stopOptimization = () => {
    cancelTokenRef.current.canceled = true;
    setIsOptimizing(false);
    setProgress(0); // or keep the last known progress
  };

  return (
    <OptimizationContext.Provider
      value={{
        dynamicOptions,
        setDynamicOptions,
        overallBudget,
        setOverallBudget,
        isOptimizing,
        startOptimization,
        stopOptimization,
        progress,
        solutionList,
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
