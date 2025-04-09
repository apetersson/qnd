// Modified SolutionList.tsx
import React from "react";
import { Board } from "../models/Board";
import { HistoryEntry } from "../optimization/optimizeAdvancedBuildings";

export interface Solution {
  marketBonus: number;
  foodBonus: number;
  iteration: number;
  boardSnapshot: Board;
  history: HistoryEntry[];
}

interface SolutionListProps {
  solutions: Solution[];
  selectedSolution: Solution | null;
  onSolutionSelect: (solution: Solution | null) => void;
}

const SolutionList: React.FC<SolutionListProps> = ({
                                                     solutions,
                                                     selectedSolution,
                                                     onSolutionSelect,
                                                   }) => {
  // Reverse to show most recent first.
  const reversedSolutions = solutions.slice().reverse();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        gap: "10px",
        marginTop: "10px",
        overflowX: "auto",
      }}
    >
      {reversedSolutions.map((sol, index) => {
        const isSelected =
          selectedSolution &&
          selectedSolution.iteration === sol.iteration; // or use a unique id if available
        return (
          <div
            key={index}
            style={{
              border: "1px solid #ccc",
              borderRadius: "4px",
              padding: "8px",
              textAlign: "center",
              minWidth: "80px",
              cursor: "pointer",
              backgroundColor: isSelected ? "#e0e0e0" : "transparent",
            }}
            onClick={() =>
              onSolutionSelect(isSelected ? null : sol)
            }
          >
            <div style={{fontSize: "18px", fontWeight: "bold"}}>
              {sol.marketBonus}
            </div>
            <div style={{fontSize: "12px"}}>Food: {sol.foodBonus}</div>
          </div>
        );
      })}
    </div>
  );
};

export default SolutionList;
