import React, { useMemo, useState } from "react";
import { Action, dynamicActions } from "../optimization/action";
import { defaultTechEnabled, Technology, techOrder } from "../models/Technology";

interface AdvancedOptionsProps {
  dynamicOptions: Record<string, boolean>;
  setDynamicOptions: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  overallBudget: number;
  setOverallBudget: React.Dispatch<React.SetStateAction<number>>;
}

export const AdvancedOptions: React.FC<AdvancedOptionsProps> = ({
                                                                  dynamicOptions,
                                                                  setDynamicOptions,
                                                                  overallBudget,
                                                                  setOverallBudget,
                                                                }) => {
  // Track which tech categories are enabled.
  const [techEnabled, setTechEnabled] = useState<Record<Technology, boolean>>(defaultTechEnabled);

  // Group the dynamic actions by their required technology. We use useMemo
  // so that actionsByTech is recomputed only if dynamicActions changes.
  const actionsByTech = useMemo(() => {
    return dynamicActions.reduce((acc, action: Action) => {
      const tech = action.requiredTech;
      if (!acc[tech]) {
        acc[tech] = [];
      }
      acc[tech].push(action);
      return acc;
    }, {} as Record<Technology, Action[]>);
  }, []);

  /**
   * Toggles a tech on/off. If turning a tech off, we also disable all relevant actions.
   */
  function handleToggleTech(tech: Technology, checked: boolean) {
    setTechEnabled((prev) => ({
      ...prev,
      [tech]: checked,
    }));

    // If we are disabling this tech, also turn off relevant actions
    if (!checked && actionsByTech[tech]) {
      setDynamicOptions((prev) => {
        const newOptions = {...prev};
        for (const action of actionsByTech[tech]) {
          newOptions[action.id] = false;
        }
        return newOptions;
      });
    }
  }

  /**
   * Toggles a single action on/off, assuming its tech is enabled.
   */
  function handleToggleAction(action: Action, checked: boolean, techIsEnabled: boolean) {
    // If the tech isn't enabled, do nothing (should be disabled in UI anyway).
    if (!techIsEnabled) return;

    setDynamicOptions((prev) => ({
      ...prev,
      [action.id]: checked,
    }));
  }

  return (
    <div style={{marginBottom: 12}}>
      <strong>Advanced Building Options</strong>
      <div style={{marginTop: 8}}>
        {techOrder.map((tech) => (
          <div key={tech} style={{marginBottom: "8px"}}>
            <label style={{fontWeight: "bold", marginRight: "8px"}}>
              <input
                type="checkbox"
                checked={techEnabled[tech]}
                onChange={(e) => handleToggleTech(tech, e.target.checked)}
              />
              {tech}
            </label>
            <div style={{paddingLeft: "16px"}}>
              {actionsByTech[tech]?.map((action) => (
                <label key={action.id} style={{marginRight: "12px"}}>
                  <input
                    type="checkbox"
                    checked={dynamicOptions[action.id] || false}
                    disabled={!techEnabled[tech]}
                    onChange={(e) =>
                      handleToggleAction(action, e.target.checked, techEnabled[tech])
                    }
                  />{" "}
                  {action.description}
                </label>
              ))}
            </div>
          </div>
        ))}
        <label style={{marginLeft: "12px"}}>
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

export default AdvancedOptions;
