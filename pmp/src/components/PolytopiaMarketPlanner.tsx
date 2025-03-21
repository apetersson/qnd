// touch ./components/PolytopiaMarketPlanner.tsx
import React, { ChangeEvent, useEffect, useRef, useState } from "react";
import { Board, Building, createInitialBoard, Terrain, TileData } from "../models/Board";
import { estimateCompletionTime, parseBuildingValue, parseTerrainValue } from "../utils/helpers";
import {
  placeAdvancedBuildingsSimple,
  placeBasicResourceBuildings,
  removeNonContributingBasicBuildings,
} from "../placement/placement";
import { optimizeAdvancedBuildingsAsync } from "../optimization/optimizeAdvancedBuildings";
import { claimCityArea, extendCity, removeCityAssociation } from "../placement/city";
import { Menu, MenuItem } from "@mui/material";
import * as pako from "pako";
import { ADVANCED_BUILDINGS } from "../models/buildingTypes";
import { dynamicActions } from "../optimization/action";
import BoardGrid from "./BoardGrid";
import BoardControls from "./BoardControls";
import { useBoardState } from "../contexts/BoardContext";


const terrainKeyMap: Record<string, Terrain> = {
  n: Terrain.None,
  d: Terrain.Field,
  f: Terrain.Forest,
  h: Terrain.Mountain,
  c: Terrain.City,
  w: Terrain.Water,
};

const buildingKeys: Record<Building, string> = {
  [Building.None]: "0",
  [Building.Farm]: "r",
  [Building.LumberHut]: "l",
  [Building.Mine]: "i",
  [Building.Sawmill]: "s",
  [Building.Windmill]: "p",
  [Building.Forge]: "o",
  [Building.Market]: "m",
};

const buildingKeyMap: Record<string, Building> = Object.keys(buildingKeys).reduce((acc, b) => {
  const bType = b as Building;
  const key = buildingKeys[bType];
  acc[key] = bType;
  return acc;
}, {} as Record<string, Building>);

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

function getTerrainColor(terrain: Terrain): string {
  switch (terrain) {
    case Terrain.Field:
      return "#fff9e6";
    case Terrain.Forest:
      return "#e8f5e9";
    case Terrain.Mountain:
      return "#f5f5f5";
    case Terrain.City:
      return "#8c63b3";
    case Terrain.Water:
      return "#00bfff";
    default:
      return "#ffffff";
  }
}

function getBuildingColor(building: Building): string {
  switch (building) {
    case Building.Farm:
      return "#fff176";
    case Building.Windmill:
      return "#fdd835";
    case Building.LumberHut:
      return "#81c784";
    case Building.Sawmill:
      return "#388e3c";
    case Building.Mine:
      return "#b0bec5";
    case Building.Forge:
      return "#78909c";
    case Building.Market:
      return "#ff8a65";
    default:
      return "transparent";
  }
}

function computeTileBorderStyle(tile: TileData, board: Board): React.CSSProperties {
  const topTile = board.tiles.find(t => t.x === tile.x && t.y === tile.y - 1);
  const rightTile = board.tiles.find(t => t.x === tile.x + 1 && t.y === tile.y);
  const bottomTile = board.tiles.find(t => t.x === tile.x && t.y === tile.y + 1);
  const leftTile = board.tiles.find(t => t.x === tile.x - 1 && t.y === tile.y);
  const borderTop = topTile && topTile.cityId !== tile.cityId ? "1px solid red" : "1px solid #666";
  const borderRight = rightTile && rightTile.cityId !== tile.cityId ? "1px solid red" : "1px solid #666";
  const borderBottom = bottomTile && bottomTile.cityId !== tile.cityId ? "1px solid red" : "1px solid #666";
  const borderLeft = leftTile && leftTile.cityId !== tile.cityId ? "1px solid red" : "1px solid #666";
  return {borderTop, borderRight, borderBottom, borderLeft};
}

const gridSizes = [
  {label: "Tiny (11x11)", width: 11, height: 11},
  {label: "Small (14x14)", width: 14, height: 14},
  {label: "Normal (16x16)", width: 16, height: 16},
  {label: "Large (18x18)", width: 18, height: 18},
  {label: "Huge (20x20)", width: 20, height: 20},
  {label: "Massive (30x30)", width: 30, height: 30},
];

export default function PolytopiaMarketPlanner() {
  // Use board state from context.
  const {board, setBoard} = useBoardState();

  // Other local state remains.
  const [sizeIndex, setSizeIndex] = useState<number>(0);
  const [hoveredTile, setHoveredTile] = useState<TileData | null>(null);
  const [configText, setConfigText] = useState("");

  // Advanced building options using dynamicOptions from dynamicActions.
  const [dynamicOptions, setDynamicOptions] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    dynamicActions.forEach(action => {
      initial[action.id] = true;
    });
    return initial;
  });
  // Overall budget state (default 30 stars)
  const [overallBudget, setOverallBudget] = useState<number>(30);

  const emptyEligibleCount = board.tiles.filter(
    (tile) =>
      tile.terrain === Terrain.None &&
      tile.building === Building.None &&
      tile.cityId !== null
  ).length;
  const activeOptions = Object.keys(dynamicOptions).filter(key => dynamicOptions[key]).length + 2;
  const estimatedStepsExponent = emptyEligibleCount * Math.log10(activeOptions);
  const estimatedTime = estimateCompletionTime(emptyEligibleCount, activeOptions);

  const cancelTokenRef = useRef<{ canceled: boolean }>({canceled: false});
  const [isOptimizing, setIsOptimizing] = useState(false);
  // Popup menu state.
  const [selectedTile, setSelectedTile] = useState<TileData | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  const startOptimization = async () => {
    cancelTokenRef.current = {canceled: false};
    setIsOptimizing(true);
    const result = await optimizeAdvancedBuildingsAsync(
      board,
      cancelTokenRef.current,
      dynamicOptions,
      overallBudget,
      (progress) => {
        console.log("progress", progress);
      });
    setBoard(result);
    setIsOptimizing(false);
  };

  const stopOptimization = () => {
    cancelTokenRef.current.canceled = true;
    setIsOptimizing(false);
  };

  // Keyboard and popup action handling remains unchanged.
  function handleTileAction(key: string, tile: TileData) {
    if (key.toLowerCase() === "e") {
      if (tile.terrain === Terrain.City && tile.cityId) {
        setBoard(prev => extendCity(prev, tile.cityId!));
      }
      return;
    }
    const lowerKey = key.toLowerCase();
    const terrainCandidate = terrainKeyMap[lowerKey];
    const buildingCandidate = buildingKeyMap[lowerKey];
    if (terrainCandidate !== undefined) {
      setBoard(prev => {
        const updated = prev.tiles.map(t => {
          if (t.x === tile.x && t.y === tile.y) {
            if (terrainCandidate === Terrain.City) {
              return {...t, terrain: Terrain.City, cityId: `${t.x}-${t.y}`};
            }
            return {...t, terrain: terrainCandidate};
          }
          return t;
        });
        if (terrainCandidate === Terrain.City) {
          const cityTile = prev.tiles.find(t => t.x === tile.x && t.y === tile.y);
          if (cityTile) {
            return claimCityArea({...prev, tiles: updated}, cityTile);
          }
        } else {
          if (tile.terrain === Terrain.City && tile.cityId) {
            return removeCityAssociation({...prev, tiles: updated}, tile.cityId);
          }
        }
        return {...prev, tiles: updated};
      });
    } else if (buildingCandidate !== undefined) {
      setBoard(prev => ({
        ...prev,
        tiles: prev.tiles.map(t => {
          if (t.x === tile.x && t.y === tile.y) {
            if (buildingCandidate === Building.None) {
              return {...t, building: Building.None};
            }
            if (
              t.cityId && ADVANCED_BUILDINGS.includes(buildingCandidate)
            ) {
              const alreadyExists = prev.tiles.some(
                tile2 => tile2.cityId === t.cityId && tile2.building === buildingCandidate
              );
              if (alreadyExists) return t;
            }
            const forcedTerrain =
              buildingCandidate === Building.Farm
                ? Terrain.Field
                : buildingCandidate === Building.LumberHut
                  ? Terrain.Forest
                  : buildingCandidate === Building.Mine
                    ? Terrain.Mountain
                    : Terrain.None;
            return {
              ...t,
              terrain: forcedTerrain !== Terrain.None ? forcedTerrain : t.terrain,
              building: buildingCandidate,
            };
          }
          return t;
        }),
      }));
    }
  }

  // Keyboard handling.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!hoveredTile) return;
      handleTileAction(e.key, hoveredTile);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hoveredTile, board]);

  function handleExportClick() {
    const meaningfulTiles = board.tiles.filter(
      (t) => t.terrain !== Terrain.None || t.building !== Building.None || t.cityId !== null
    );
    const exportBoard = {
      width: board.width,
      height: board.height,
      tiles: meaningfulTiles.map((t) => {
        const obj: any = {x: t.x, y: t.y};
        if (t.terrain !== Terrain.None) obj.terrain = t.terrain;
        if (t.building !== Building.None) obj.building = t.building;
        if (t.cityId) obj.cityId = t.cityId;
        return obj;
      }),
    };
    setConfigText(JSON.stringify(exportBoard, null, 2));
  }

  function handleApplyClick() {
    try {
      const parsed = JSON.parse(configText);
      if (
        typeof parsed.width === "number" &&
        typeof parsed.height === "number" &&
        Array.isArray(parsed.tiles)
      ) {
        // Create a new board from the parsed JSON.
        const newBoard = createInitialBoard(parsed.width, parsed.height);
        for (const tileObj of parsed.tiles) {
          const x = tileObj.x;
          const y = tileObj.y;
          const index = newBoard.tiles.findIndex((t) => t.x === x && t.y === y);
          if (index >= 0) {
            newBoard.tiles[index] = {
              ...newBoard.tiles[index],
              terrain: parseTerrainValue(tileObj.terrain),
              building: parseBuildingValue(tileObj.building),
              cityId: tileObj.cityId || null,
            };
          }
        }
        setBoard(newBoard);
        const foundIndex = gridSizes.findIndex(
          (sz) => sz.width === newBoard.width && sz.height === newBoard.height
        );
        setSizeIndex(foundIndex >= 0 ? foundIndex : -1);
      } else {
        alert("Invalid board JSON format.");
      }
    } catch (err) {
      alert("Could not parse JSON. Check your syntax or data types.");
    }
  }

  function handleConfigChange(e: ChangeEvent<HTMLTextAreaElement>) {
    setConfigText(e.target.value);
  }

  function handleSizeChange(e: ChangeEvent<HTMLSelectElement>) {
    const idx = Number(e.target.value);
    setSizeIndex(idx);
    if (idx >= 0 && idx < gridSizes.length) {
      const {width, height} = gridSizes[idx];
      setBoard(createInitialBoard(width, height));
    }
  }

  function handlePlaceBasicBuildingsClick() {
    setBoard(placeBasicResourceBuildings(board));
  }

  function handlePlaceBuildingsClick() {
    setBoard(placeAdvancedBuildingsSimple(board));
  }

  function handleRemoveNonContributingClick() {
    setBoard(removeNonContributingBasicBuildings(board));
  }


  // Dynamic popup actions.
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
  if (selectedTile && selectedTile.terrain === Terrain.City && selectedTile.cityId) {
    dynamicPopupActions.push({key: "e", label: "Extend City"});
  }

  const handleMenuItemClick = (key: string) => {
    if (selectedTile) {
      handleTileAction(key, selectedTile);
    }
    setMenuAnchor(null);
    setSelectedTile(null);
  };

  return (
    <div style={containerStyle}>
      <h1>Polytopia Market Planner</h1>
      <BoardControls
        sizeIndex={sizeIndex}
        gridSizes={gridSizes}
        board={board}
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
      {/* BoardGrid and popup menu remain unchanged */}
      <BoardGrid
        board={board}
        boardStyle={boardStyle}
        tileStyle={tileStyle}
        getTerrainColor={getTerrainColor}
        getBuildingColor={getBuildingColor}
        computeTileBorderStyle={computeTileBorderStyle}
        setHoveredTile={setHoveredTile}
        setSelectedTile={setSelectedTile}
        setMenuAnchor={setMenuAnchor}
        buildingKeys={buildingKeys}
      />
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => {
          setMenuAnchor(null);
          setSelectedTile(null);
        }}
      >
        {dynamicPopupActions.map((action) => (
          <MenuItem key={action.key} onClick={() => handleMenuItemClick(action.key)}>
            {action.label}
          </MenuItem>
        ))}
      </Menu>
    </div>
  );
}
