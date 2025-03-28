import React from "react";
import { useBoardState } from "../contexts/BoardStateContext";
import { useOptimizationContext } from "../contexts/OptimizationContext";
import { estimateCompletionTime } from "../utils/helpers";
import { calculateMarketBonus, sumLevelsForFood } from "../optimization/optimizeAdvancedBuildings";
import { AdvancedOptions } from "./AdvancedOptions";
import ProgressBar from "./ProgressBar";
import SolutionList from "./SolutionList";

const OptimizationControls: React.FC = () => {
  const {board} = useBoardState();
  const {
    dynamicOptions,
    setDynamicOptions,
    overallBudget,
    setOverallBudget,
    isOptimizing,
    startOptimization,
    stopOptimization,
    progress,
    solutionList,
  } = useOptimizationContext();

  // Compute some stats for estimation
  const emptyEligibleCount = board.tiles.filter(
    (t) => t.terrain === "NONE" && t.building === "NONE" && t.cityId
  ).length;
  // +2 is an example offset if you want to approximate the “no action” or “do nothing” paths
  const activeOptions = Object.values(dynamicOptions).filter(Boolean).length + 2;
  const estimatedStepsExponent = emptyEligibleCount * Math.log10(activeOptions);
  const estimatedTime = estimateCompletionTime(emptyEligibleCount, activeOptions);

  return (
    <div style={{marginBottom: 12}}>
      <AdvancedOptions
        dynamicOptions={dynamicOptions}
        setDynamicOptions={setDynamicOptions}
        overallBudget={overallBudget}
        setOverallBudget={setOverallBudget}
      />
      <p style={{marginTop: 4, fontSize: "0.9rem"}}>
        Estimated combinations: {activeOptions}^{emptyEligibleCount} ≈ 10^
        {estimatedStepsExponent.toFixed(2)} ; Estimated time: {estimatedTime}
      </p>
      <p>Market bonus: {calculateMarketBonus(board)}</p>
      <p>Total Food Bonus: {sumLevelsForFood(board)}</p>

      {!isOptimizing && (
        <button onClick={startOptimization} disabled={isOptimizing}>
          Optimize Advanced Buildings (Brute Force)
        </button>
      )}
      {isOptimizing && (
        <button onClick={stopOptimization} style={{marginLeft: 8}}>
          Stop Optimize
        </button>
      )}

      {/* Show the progress bar at all times or conditionally */}
      <ProgressBar progress={progress}/>

      {/* Render the list of new best solutions */}
      <SolutionList solutions={solutionList}/>
    </div>
  );
};

export default OptimizationControls;
