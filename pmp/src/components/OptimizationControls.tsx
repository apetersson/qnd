import React from "react";
import { dynamicActions } from "../optimization/action";
import { useBoardState } from "../contexts/BoardStateContext";
import { useOptimizationContext } from "../contexts/OptimizationContext";
import { estimateCompletionTime } from "../utils/helpers";
import { calculateMarketBonus, sumLevelsForFood } from "../optimization/optimizeAdvancedBuildings";


// Keep AdvancedOptions as a subcomponent:
const AdvancedOptions: React.FC<{
  dynamicOptions: Record<string, boolean>;
  setDynamicOptions: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  overallBudget: number;
  setOverallBudget: React.Dispatch<React.SetStateAction<number>>;
}> = ({dynamicOptions, setDynamicOptions, overallBudget, setOverallBudget}) => {
  return (
    <div style={{marginBottom: 12}}>
      <strong>Advanced Building Options</strong>
      <div style={{marginTop: 8}}>
        {dynamicActions.map((action) => (
          <label key={action.id} style={{marginRight: 12}}>
            <input
              type="checkbox"
              checked={dynamicOptions[action.id]}
              onChange={(e) =>
                setDynamicOptions((prev) => ({
                  ...prev,
                  [action.id]: e.target.checked,
                }))
              }
            />
            {"  "}
            {action.description}
          </label>
        ))}
        <label style={{marginLeft: 12}}>
          <span>Overall Budget (stars): </span>
          <input
            type="number"
            value={overallBudget}
            onChange={(e) => setOverallBudget(Number(e.target.value))}
            style={{width: 60}}
          />
        </label>
      </div>
    </div>
  );
};

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
    </div>
  );
};

export default OptimizationControls;
