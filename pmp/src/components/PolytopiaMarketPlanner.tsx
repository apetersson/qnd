// Filename: ./components/PolytopiaMarketPlanner.tsx
import React, { useRef, useState } from "react";
import { Menu, MenuItem } from "@mui/material";
import { useBoardState } from "../contexts/BoardContext";
import { estimateCompletionTime } from "../utils/helpers";
import { optimizeAdvancedBuildingsAsync } from "../optimization/optimizeAdvancedBuildings";
import BoardGrid from "./BoardGrid";
import BoardControls from "./BoardControls";
import { buildingKeyMap, terrainKeyMap, useBoardControls } from "../hooks/useBoardControls";
import { Building, createInitialBoard, Terrain, TileData } from "../models/Board";
import { dynamicActions } from "../optimization/action";
import {
  placeAdvancedBuildingsSimple,
  placeBasicResourceBuildings,
  removeNonContributingBasicBuildings
} from "../placement/placement";
import { gridSizes } from "../models/sizes";

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
  const [sizeIndex, setSizeIndex] = useState(0);
  const [hoveredTile, setHoveredTile] = useState<TileData | null>(null);
  const [configText, setConfigText] = useState("");
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

  const dynamicPopupActions = [
    ...Object.entries(terrainKeyMap).map(([key, terrain]) => ({
      key,
      label: `Set Terrain: ${terrain}`,
    })),
    ...Object.entries(buildingKeyMap).map(([key, building]) => ({
      key,
      label: `Set Building: ${building}`,
    })),
  ];

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

  // Config and board management handlers
  const handleExportClick = () => {
    const exportData = {
      width: board.width,
      height: board.height,
      tiles: board.tiles.filter(t => t.terrain !== Terrain.None || t.building !== Building.None || t.cityId)
    };
    setConfigText(JSON.stringify(exportData, null, 2));
  };

  const handleApplyClick = () => {
    try {
      const parsed = JSON.parse(configText);
      if (parsed?.width && parsed?.height && Array.isArray(parsed.tiles)) {
        const newBoard = createInitialBoard(parsed.width, parsed.height);
        parsed.tiles.forEach((t: any) => {
          const idx = newBoard.tiles.findIndex((bt) => bt.x === t.x && bt.y === t.y);
          if (idx > -1) newBoard.tiles[idx] = {...newBoard.tiles[idx], ...t};
        });
        setBoard(newBoard);
      }
    } catch (err) {
      alert("Invalid board configuration");
    }
  };
  const handleSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const idx = Number(e.target.value);
    setSizeIndex(idx);
    setBoard(createInitialBoard(gridSizes[idx].width, gridSizes[idx].height));
  };

  const handlePlaceBasicBuildingsClick = () => {
    setBoard(placeBasicResourceBuildings(board));
  };

  const handlePlaceBuildingsClick = () => {
    setBoard(placeAdvancedBuildingsSimple(board));
  };

  const handleRemoveNonContributingClick = () => {
    setBoard(removeNonContributingBasicBuildings(board));
  };

  const handleConfigChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setConfigText(e.target.value);
  };

  return (
    <div style={containerStyle}>
      <h1>Polytopia Market Planner</h1>
      <BoardControls
        sizeIndex={sizeIndex}
        gridSizes={gridSizes}
        dynamicOptions={dynamicOptions}
        setDynamicOptions={setDynamicOptions}
        overallBudget={overallBudget}
        setOverallBudget={setOverallBudget}
        activeOptions={activeOptions}
        emptyEligibleCount={emptyEligibleCount}
        estimatedStepsExponent={estimatedStepsExponent}
        estimatedTime={estimatedTime}
        configText={configText}
        handleSizeChange={handleSizeChange}
        handleExportClick={handleExportClick}
        handleApplyClick={handleApplyClick}
        handlePlaceBasicBuildingsClick={handlePlaceBasicBuildingsClick}
        handlePlaceBuildingsClick={handlePlaceBuildingsClick}
        handleRemoveNonContributingClick={handleRemoveNonContributingClick}
        handleConfigChange={handleConfigChange}
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
      <Menu
        anchorEl={menuAnchor}
        open={!!menuAnchor}
        onClose={() => setMenuAnchor(null)}
      >
        {dynamicPopupActions.map((action) => (
          <MenuItem key={action.key} onClick={() => {
            if (selectedTile) handleTileAction(action.key, selectedTile);
            setMenuAnchor(null);
          }}>
            {action.label}
          </MenuItem>
        ))}
      </Menu>
    </div>
  );
}