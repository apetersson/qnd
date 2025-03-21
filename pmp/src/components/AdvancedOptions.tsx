import React from "react";
import { dynamicActions } from "../optimization/action";

interface AdvancedOptionsProps {
  dynamicOptions: Record<string, boolean>;
  setDynamicOptions: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  overallBudget: number;
  setOverallBudget: React.Dispatch<React.SetStateAction<number>>;
}

const AdvancedOptions: React.FC<AdvancedOptionsProps> = ({
                                                           dynamicOptions,
                                                           setDynamicOptions,
                                                           overallBudget,
                                                           setOverallBudget,
                                                         }) => {
  return (
    <div>
      <strong>Advanced Building Options</strong>
      <div style={{marginTop: "8px"}}>
        {dynamicActions.map((action) => (
          <label key={action.id} style={{marginRight: "12px"}}>
            <input
              type="checkbox"
              checked={dynamicOptions[action.id]}
              onChange={(e) =>
                setDynamicOptions((prev) => ({
                  ...prev,
                  [action.id]: e.target.checked,
                }))
              }
            />{" "}
            {action.description}
          </label>
        ))}
        <label style={{marginLeft: "12px"}}>
          <span>Overall Budget (stars): </span>
          <input
            type="number"
            value={overallBudget}
            onChange={(e) => setOverallBudget(Number(e.target.value))}
            style={{width: "60px"}}
          />
        </label>
      </div>
    </div>
  );
};

export default AdvancedOptions;
