// Filename: ./components/AdvancedOptions.tsx

import React, { useEffect, useState } from "react";
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

  // Group the dynamic actions by their required technology.
  const actionsByTech: Record<Technology, Action[]> = dynamicActions.reduce((acc, action: Action) => {
    const tech = action.requiredTech;
    if (!acc[tech]) {
      acc[tech] = [];
    }
    acc[tech].push(action);
    return acc;
  }, {} as Record<Technology, Action[]>);

  // Whenever a tech category is disabled, force-disable all its actions.
  useEffect(() => {
    setDynamicOptions((prevOptions) => {
      const newOptions = {...prevOptions};
      for (const tech in techEnabled) {
        // TypeScript sees tech as string; we know it's a Technology key.
        const techKey = tech as Technology;
        if (!techEnabled[techKey] && actionsByTech[techKey]) {
          actionsByTech[techKey].forEach((action) => {
            newOptions[action.id] = false;
          });
        }
      }
      return newOptions;
    });
  }, [techEnabled, actionsByTech, setDynamicOptions]);

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
                onChange={(e) =>
                  setTechEnabled((prev) => ({
                    ...prev,
                    [tech]: e.target.checked,
                  }))
                }
              />
              {tech}
            </label>
            <div style={{paddingLeft: "16px"}}>
              {actionsByTech[tech]
                ? actionsByTech[tech].map((action) => (
                  <label key={action.id} style={{marginRight: "12px"}}>
                    <input
                      type="checkbox"
                      checked={dynamicOptions[action.id] || false}
                      disabled={!techEnabled[tech]}
                      onChange={(e) =>
                        setDynamicOptions((prev) => ({
                          ...prev,
                          [action.id]: e.target.checked,
                        }))
                      }
                    />{" "}
                    {action.description}
                  </label>
                ))
                : null}
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
