import React from "react";
import { useBoardState } from "../contexts/BoardStateContext";
import { Solution } from "../models/Solution";
import { calculateMarketBonus } from "../models/bonuses";

interface SolutionListProps {
  solutions: Solution[];
  selectedSolution: Solution | null;
  onSolutionSelect: (solution: Solution | null) => void;
}

const MAX_SOLUTIONS_TO_DISPLAY = 6; // Define the limit

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

  // Limit the list to the latest N solutions for display
  const limitedSolutions = reversedSolutions.slice(0, MAX_SOLUTIONS_TO_DISPLAY);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        gap: "10px",
        marginTop: "10px",
        overflowX: "auto", // Keep horizontal scroll if many solutions fit
        paddingBottom: "5px", // Add a little padding for scrollbar visibility if needed
      }}
    >
      {/* Map over the limited list */}
      {limitedSolutions.map((sol) => { // Use the limited list here
        const isSelected =
          selectedSolution &&
          selectedSolution.iteration === sol.iteration; // Use iteration as a more stable key

        // Sum up the total cost from the solution's history.
        const solutionCost = sol.history.reduce((acc, entry) => acc + entry.cost, 0);
        // Calculate the bonus difference compared to the baseline.
        const bonusDiff = sol.marketBonus - baselineMarketBonus;
        // Compute turns to break even: if bonusDiff is > 0, divide cost by bonusDiff, otherwise display N/A.
        const turnsToBreakEven =
          bonusDiff > 0 ? (solutionCost / bonusDiff).toFixed(2) : "N/A";

        return (
          <div
            // Use sol.iteration as the key for better stability than index
            key={sol.iteration}
            style={{
              border: "1px solid #ccc",
              borderRadius: "4px",
              padding: "8px",
              textAlign: "center",
              minWidth: "100px", // Ensure items have a minimum width
              flexShrink: 0, // Prevent items from shrinking if container is too small
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
              {/* Show Cost */}
              Cost: {solutionCost} ★
            </div>
            <div style={{fontSize: "12px", marginTop: "4px"}}>
              {/* Show Break Even */}
              BE: {turnsToBreakEven} turns
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default SolutionList;
