import React from "react";
import { useBoardState } from "../contexts/BoardStateContext";
import { Solution } from "../models/Solution";
import { calculateMarketBonus } from "../models/bonuses";

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
  // Get the baseline board from state to compute starting market bonus.
  const {board} = useBoardState();
  const baselineMarketBonus = calculateMarketBonus(board);

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

        // Sum up the total cost from the solution's history.
        const solutionCost = sol.history.reduce((acc, entry) => acc + entry.cost, 0);
        // Calculate the bonus difference compared to the baseline.
        const bonusDiff = sol.marketBonus - baselineMarketBonus;
        // Compute turns to break even: if bonusDiff is > 0, divide cost by bonusDiff, otherwise display N/A.
        const turnsToBreakEven =
          bonusDiff > 0 ? (solutionCost / bonusDiff).toFixed(2) : "N/A";

        return (
          <div
            key={index}
            style={{
              border: "1px solid #ccc",
              borderRadius: "4px",
              padding: "8px",
              textAlign: "center",
              minWidth: "100px",
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
            <div style={{fontSize: "12px", marginTop: "4px"}}>
              Break even: {turnsToBreakEven}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default SolutionList;
