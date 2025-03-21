// Filename: ./components/PolytopiaMarketPlanner.tsx
import React, { useRef, useState } from "react";
import { MenuItem } from "@mui/material";
import { useBoardState } from "../contexts/BoardContext";
import { estimateCompletionTime } from "../utils/helpers";
import { optimizeAdvancedBuildingsAsync } from "../optimization/optimizeAdvancedBuildings";
import BoardGrid from "./BoardGrid";
import BoardControls from "./BoardControls";
import { buildingKeyMap, terrainKeyMap, useBoardControls } from "../hooks/useBoardControls";
import { Building, Terrain, TileData } from "../models/Board";
import { dynamicActions } from "../optimization/action";
import { MouseOptions } from "./MouseOptions";

const containerStyle: React.CSSProperties = {margin: "20px"};
const boardStyle: React.CSSProperties = {display: "grid", gap: "2px"};
const tileStyle: React.CSSProperties = {
  width: "40px",
  height: "40px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  userSelect: "none",
  fontSize: "0.7rem",
  textAlign: "center",
};

export default function PolytopiaMarketPlanner() {
  const {board, setBoard} = useBoardState();
  const [hoveredTile, setHoveredTile] = useState<TileData | null>(null);
  const [dynamicOptions, setDynamicOptions] = useState<Record<string, boolean>>(
    Object.fromEntries(dynamicActions.map((a) => [a.id, true]))
  );
  const [overallBudget, setOverallBudget] = useState(30);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [selectedTile, setSelectedTile] = useState<TileData | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const cancelTokenRef = useRef({canceled: false});
  const {handleTileAction} = useBoardControls(hoveredTile);

  const emptyEligibleCount = board.tiles.filter(
    (t) => t.terrain === Terrain.None && t.building === Building.None && t.cityId
  ).length;
  const activeOptions = Object.values(dynamicOptions).filter(Boolean).length + 2;
  const estimatedStepsExponent = emptyEligibleCount * Math.log10(activeOptions);
  const estimatedTime = estimateCompletionTime(emptyEligibleCount, activeOptions);

  // Optimization handlers
  const startOptimization = async () => {
    cancelTokenRef.current = {canceled: false};
    setIsOptimizing(true);
    const result = await optimizeAdvancedBuildingsAsync(
      board,
      cancelTokenRef.current,
      dynamicOptions,
      overallBudget
    );
    setBoard(result);
    setIsOptimizing(false);
  };

  const stopOptimization = () => {
    cancelTokenRef.current.canceled = true;
    setIsOptimizing(false);
  };


  return (
    <div style={containerStyle}>
      <h1>Polytopia Market Planner</h1>
      <BoardControls
        dynamicOptions={dynamicOptions}
        setDynamicOptions={setDynamicOptions}
        overallBudget={overallBudget}
        setOverallBudget={setOverallBudget}
        activeOptions={activeOptions}
        emptyEligibleCount={emptyEligibleCount}
        estimatedStepsExponent={estimatedStepsExponent}
        estimatedTime={estimatedTime}
        startOptimization={startOptimization}
        stopOptimization={stopOptimization}
        isOptimizing={isOptimizing}
      />
      <BoardGrid
        {...{
          board,
          boardStyle,
          tileStyle,
          setHoveredTile,
          setSelectedTile,
          setMenuAnchor,
        }}
      />
      <MouseOptions anchorEl={menuAnchor} onClose={() => setMenuAnchor(null)}
                    callbackfn={(action) => (
                      <MenuItem key={action.key} onClick={() => {
                        if (selectedTile) handleTileAction(action.key, selectedTile);
                        setMenuAnchor(null);
                      }}>
                        {action.label}
                      </MenuItem>
                    )}/>
    </div>
  );
}