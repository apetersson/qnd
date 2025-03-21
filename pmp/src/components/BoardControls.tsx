import React, { useState } from "react";
import AdvancedOptions from "./AdvancedOptions";
import { useBoardState } from "../contexts/BoardContext";
import { calculateMarketBonus, sumLevelsForFood } from "../optimization/optimizeAdvancedBuildings";
import { gridSizes } from "../models/sizes";
import { Building, createInitialBoard, Terrain, TileData } from "../models/Board";
import {
  placeAdvancedBuildingsSimple,
  placeBasicResourceBuildings,
  removeNonContributingBasicBuildings
} from "../placement/placement";

interface BoardControlsProps {
  // Grid and board settings
  dynamicOptions: Record<string, boolean>;
  setDynamicOptions: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  overallBudget: number;
  setOverallBudget: React.Dispatch<React.SetStateAction<number>>;
  // Derived values for estimation
  activeOptions: number;
  emptyEligibleCount: number;
  estimatedStepsExponent: number;
  estimatedTime: string;
  // Optimization actions
  startOptimization: () => void;
  stopOptimization: () => void;
  isOptimizing: boolean;
}

const BoardControls: React.FC<BoardControlsProps> = ({
                                                       activeOptions,
                                                       dynamicOptions,
                                                       emptyEligibleCount,
                                                       estimatedStepsExponent,
                                                       estimatedTime,
                                                       isOptimizing,
                                                       overallBudget,
                                                       setDynamicOptions,
                                                       setOverallBudget,
                                                       startOptimization,
                                                       stopOptimization
                                                     }) => {
  // Use board state directly from the context
  const {board, setBoard} = useBoardState();
  const [sizeIndex, setSizeIndex] = useState<number>(1);
  // JSON config for export/load
  const [configText, setConfigText] = useState("");


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
        parsed.tiles.forEach((t: TileData) => {
          const idx = newBoard.tiles.findIndex((bt) => bt.x === t.x && bt.y === t.y);
          if (idx > -1) newBoard.tiles[idx] = {...newBoard.tiles[idx], ...t};
        });
        setBoard(newBoard);
      }
    } catch (err) {
      alert("Invalid board configuration");
      console.log(err)
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
    <div>
      {/* Grid size selection and advanced options */}
      <div style={{marginBottom: 12}}>
        <strong>Grid Size:</strong>
        <select onChange={handleSizeChange} value={sizeIndex} style={{marginLeft: 8}}>
          {gridSizes.map((sz, i) => (
            <option key={i} value={i}>
              {sz.label}
            </option>
          ))}
        </select>
        <p>
          Current
          Board: {`${gridSizes[sizeIndex].width}x${gridSizes[sizeIndex].height}`} with{" "}
          {board.width * board.height} tiles
        </p>
        <AdvancedOptions
          dynamicOptions={dynamicOptions}
          setDynamicOptions={setDynamicOptions}
          overallBudget={overallBudget}
          setOverallBudget={setOverallBudget}
        />
        <p style={{fontSize: "0.9rem", marginTop: "4px"}}>
          {`Estimated combinations: ${activeOptions}^${emptyEligibleCount} ≈ 10^${estimatedStepsExponent.toFixed(
            2
          )} ; Estimated time: ${estimatedTime}`}
        </p>
      </div>
      {/* Display board metrics */}
      <p>Market bonus: {calculateMarketBonus(board)}</p>
      <p>Total Food Bonus: {sumLevelsForFood(board)}</p>
      {/* Buttons for board actions */}
      <button onClick={handleExportClick}>Export Data</button>
      <button onClick={handleApplyClick} style={{marginLeft: 8}}>
        Load Data
      </button>
      <button onClick={handlePlaceBasicBuildingsClick} style={{marginLeft: 8}}>
        Place Basic Buildings
      </button>
      <button onClick={handlePlaceBuildingsClick} style={{marginLeft: 8}}>
        Place Advanced Buildings
      </button>
      {/* Optimization controls */}
      <div style={{display: "inline-flex", alignItems: "center", marginLeft: 8}}>
        {!isOptimizing && (
          <button onClick={startOptimization} disabled={isOptimizing}>
            {isOptimizing ? "Optimizing..." : "Optimize Advanced Buildings (Brute Force)"}
          </button>
        )}
        {isOptimizing && (
          <button onClick={stopOptimization} style={{marginLeft: "8px"}}>
            Stop Optimize
          </button>
        )}
        <span style={{marginLeft: 8, fontSize: "0.9rem"}}>
          {`Estimated combinations: ${activeOptions}^${emptyEligibleCount} ≈ 10^${estimatedStepsExponent.toFixed(
            2
          )}`}
        </span>
      </div>
      <button onClick={handleRemoveNonContributingClick} style={{marginLeft: 8}}>
        Remove Non-Contributing Basics
      </button>
      {/* JSON export/load area */}
      <p style={{marginTop: 8, marginBottom: 4}}>Board JSON:</p>
      <textarea
        style={{width: "100%", height: "150px"}}
        value={configText}
        onChange={handleConfigChange}
      />
    </div>
  );
};

export default BoardControls;
