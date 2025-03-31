// Filename: ./contexts/OptimizationContext.tsx

import React, { createContext, ReactNode, useContext, useEffect, useRef, useState, } from "react";
import { optimizeAdvancedBuildingsAsync } from "../optimization/optimizeAdvancedBuildings";
import { dynamicActions } from "../optimization/action";
import { useBoardState } from "./BoardStateContext";
import { defaultTechEnabled } from "../models/Technology";
import { Solution } from "../components/SolutionList";
import { copyBoard } from "../models/Board";

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
  cityToggles: Record<string, boolean>;
  setCityToggles: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
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
  const {board} = useBoardState();

  const [dynamicOptions, setDynamicOptions] = useState<Record<string, boolean>>(
    buildDefaultDynamicOptions
  );
  const [overallBudget, setOverallBudget] = useState<number>(30);
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [solutionList, setSolutionList] = useState<Solution[]>([]);
  const cancelTokenRef = useRef<{ canceled: boolean }>({canceled: false});

  const [cityToggles, setCityToggles] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const cities = Array.from(new Set(board.tiles.map(t => t.cityId).filter(Boolean))) as string[];
    setCityToggles(prev => {
      const updated: Record<string, boolean> = {};
      for (const city of cities) {
        updated[city] = prev[city] ?? true;
      }
      return updated;
    });
  }, [board]);

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
      (marketBonus, foodBonus, iteration, boardSnapshot, currentHistory) => {
        // Append new best solution to the solutionList
        setSolutionList(prev => [
          ...prev,
          {
            marketBonus,
            foodBonus,
            iteration,
            boardSnapshot: copyBoard(boardSnapshot),
            history: [...currentHistory]
          }
        ]);
      },
      cityToggles
    );
    // setBoard(result);
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
        cityToggles, setCityToggles
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
