import React, { ChangeEvent, useEffect, useRef, useState } from "react";
import { Board, Building, createInitialBoard, Terrain, TileData } from "../models/Board";
import { estimateCompletionTime, parseBuildingValue, parseTerrainValue } from "../utils/helpers";
import {
  getBuildingLevel,
  getMarketLevel,
  placeAdvancedBuildingsSimple,
  placeBasicResourceBuildings,
  removeNonContributingBasicBuildings,
} from "../placement/placement";
import { calculateMarketBonus, optimizeAdvancedBuildingsAsync } from "../optimization/optimizeAdvancedBuildings";
import { claimCityArea, extendCity } from "../placement/city";

// Mapping for terrain keys
const terrainKeyMap: Record<string, Terrain> = {
  n: Terrain.None,
  d: Terrain.Field,
  f: Terrain.Forest,
  h: Terrain.Mountain,
  c: Terrain.City,
  a: Terrain.Water,
};

// Define a single mapping for building keybinds
const buildingKeys: Record<Building, string> = {
  [Building.None]: "0",
  [Building.Farm]: "r",
  [Building.LumberHut]: "l",
  [Building.Mine]: "i",
  [Building.Sawmill]: "s",
  [Building.Windmill]: "w",
  [Building.Forge]: "o",
  [Building.Market]: "m",
};

// Helper to get the key for a building (in uppercase)
function getBuildingKey(building: Building): string {
  return buildingKeys[building].toUpperCase();
}

// Inverted mapping: from key to Building (for keydown events)
const buildingKeyMap: Record<string, Building> = Object.keys(buildingKeys).reduce((acc, b) => {
  const bType = b as Building;
  const key = buildingKeys[bType];
  acc[key] = bType;
  return acc;
}, {} as Record<string, Building>);

const containerStyle: React.CSSProperties = { margin: "20px" };
const boardStyle: React.CSSProperties = { display: "grid", gap: "2px" };
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
      return "#fff9e6"; // light yellow
    case Terrain.Forest:
      return "#e8f5e9"; // light green
    case Terrain.Mountain:
      return "#f5f5f5"; // light gray
    case Terrain.City:
      return "#8c63b3"; // strong indigo
    case Terrain.Water:
      return "#00bfff"; // water blue
    default:
      return "#ffffff"; // white
  }
}

function getBuildingColor(building: Building): string {
  switch (building) {
    case Building.Farm:
      return "#fff176"; // light yellow
    case Building.Windmill:
      return "#fdd835"; // darker yellow
    case Building.LumberHut:
      return "#81c784"; // light green
    case Building.Sawmill:
      return "#388e3c"; // darker green
    case Building.Mine:
      return "#b0bec5"; // light gray-blue
    case Building.Forge:
      return "#78909c"; // darker gray-blue
    case Building.Market:
      return "#ff8a65"; // strong orange
    default:
      return "transparent";
  }
}

/**
 * Computes the border style for a tile.
 * A red border is applied if adjacent tiles have a different cityId.
 */
function computeTileBorderStyle(tile: TileData, board: Board): React.CSSProperties {
  const topTile = board.tiles.find(t => t.x === tile.x && t.y === tile.y - 1);
  const rightTile = board.tiles.find(t => t.x === tile.x + 1 && t.y === tile.y);
  const bottomTile = board.tiles.find(t => t.x === tile.x && t.y === tile.y + 1);
  const leftTile = board.tiles.find(t => t.x === tile.x - 1 && t.y === tile.y);
  const borderTop = topTile && topTile.cityId !== tile.cityId ? "1px solid red" : "1px solid #666";
  const borderRight = rightTile && rightTile.cityId !== tile.cityId ? "1px solid red" : "1px solid #666";
  const borderBottom = bottomTile && bottomTile.cityId !== tile.cityId ? "1px solid red" : "1px solid #666";
  const borderLeft = leftTile && leftTile.cityId !== tile.cityId ? "1px solid red" : "1px solid #666";
  return { borderTop, borderRight, borderBottom, borderLeft };
}

const gridSizes = [
  { label: "Tiny (11x11)", width: 11, height: 11 },
  { label: "Small (14x14)", width: 14, height: 14 },
  { label: "Normal (16x16)", width: 16, height: 16 },
  { label: "Large (18x18)", width: 18, height: 18 },
  { label: "Huge (20x20)", width: 20, height: 20 },
  { label: "Massive (30x30)", width: 30, height: 30 },
];

export default function PolytopiaMarketPlanner() {
  const [sizeIndex, setSizeIndex] = useState<number>(0);
  const initialWidth = gridSizes[0].width;
  const initialHeight = gridSizes[0].height;
  const [board, setBoard] = useState<Board>(() => createInitialBoard(initialWidth, initialHeight));
  const [hoveredTile, setHoveredTile] = useState<TileData | null>(null);
  const [configText, setConfigText] = useState("");

  // Checkbox states for advanced building types
  const [includeSawmill, setIncludeSawmill] = useState(true);
  const [includeWindmill, setIncludeWindmill] = useState(true);
  const [includeForge, setIncludeForge] = useState(true);

  // Count eligible tiles: only empty tiles within a city
  const emptyEligibleCount = board.tiles.filter(
    (tile) =>
      tile.terrain === Terrain.None &&
      tile.building === Building.None &&
      tile.cityId !== null
  ).length;

  // Base options: none checked -> 2; 1 -> 3; 2 -> 4; 3 -> 5.
  const activeOptions = (includeSawmill ? 1 : 0) + (includeWindmill ? 1 : 0) + (includeForge ? 1 : 0) + 2;
  const estimatedStepsExponent = emptyEligibleCount * Math.log10(activeOptions);
  const estimatedTime = estimateCompletionTime(emptyEligibleCount, activeOptions);

  // Cancellation token for optimization
  const cancelTokenRef = useRef<{ canceled: boolean }>({ canceled: false });
  const [isOptimizing, setIsOptimizing] = useState(false);

  const startOptimization = async () => {
    cancelTokenRef.current = { canceled: false };
    setIsOptimizing(true);
    const result = await optimizeAdvancedBuildingsAsync(board, cancelTokenRef.current, {
      includeSawmill,
      includeWindmill,
      includeForge,
    });
    setBoard(result);
    setIsOptimizing(false);
  };

  const stopOptimization = () => {
    cancelTokenRef.current.canceled = true;
    setIsOptimizing(false);
  };

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key.toLowerCase() === "e") {
        if (hoveredTile && hoveredTile.terrain === Terrain.City && hoveredTile.cityId) {
          setBoard(extendCity(board, hoveredTile.cityId));
        }
        return;
      }
      if (!hoveredTile) return;
      const key = e.key.toLowerCase();
      const terrainCandidate = terrainKeyMap[key];
      const buildingCandidate = buildingKeyMap[key];
      if (terrainCandidate !== undefined) {
        setBoard((prev) => {
          const updated = prev.tiles.map((t) => {
            if (t.x === hoveredTile.x && t.y === hoveredTile.y) {
              if (terrainCandidate === Terrain.City) {
                const cityTile = { ...t, terrain: Terrain.City, cityId: `${t.x}-${t.y}` };
                return cityTile;
              }
              return { ...t, terrain: terrainCandidate };
            }
            return t;
          });
          if (terrainCandidate === Terrain.City) {
            const cityTile = prev.tiles.find(
              (t) => t.x === hoveredTile.x && t.y === hoveredTile.y
            );
            if (cityTile) {
              return claimCityArea({ ...prev, tiles: updated }, cityTile);
            }
          }
          return { ...prev, tiles: updated };
        });
      } else if (buildingCandidate !== undefined) {
        setBoard((prev) => ({
          ...prev,
          tiles: prev.tiles.map((t) => {
            if (t.x === hoveredTile.x && t.y === hoveredTile.y) {
              if (buildingCandidate === Building.None) {
                return { ...t, building: Building.None };
              }
              if (t.cityId) {
                const alreadyExists = prev.tiles.some(
                  (tile) => tile.cityId === t.cityId && tile.building === buildingCandidate
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

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hoveredTile, board]);

  const totalMarketBonus = calculateMarketBonus(board);

  function handleExportClick() {
    const meaningfulTiles = board.tiles.filter(
      (t) => t.terrain !== Terrain.None || t.building !== Building.None || t.cityId !== null
    );
    const exportBoard = {
      width: board.width,
      height: board.height,
      tiles: meaningfulTiles.map((t) => {
        const obj: any = { x: t.x, y: t.y };
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
      const { width, height } = gridSizes[idx];
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

  return (
    <div style={containerStyle}>
      <h1>Polytopia Market Planner</h1>
      <div style={{ marginBottom: 12 }}>
        <strong>Grid Size:</strong>
        <select onChange={handleSizeChange} value={sizeIndex} style={{ marginLeft: 8 }}>
          {gridSizes.map((sz, i) => (
            <option key={i} value={i}>
              {sz.label}
            </option>
          ))}
        </select>
        <p>
          Current Board: {`${gridSizes[sizeIndex].width}x${gridSizes[sizeIndex].height}`} with{" "}
          {board.width * board.height} tiles
        </p>
        <strong>Keyboard Shortcuts</strong>
        <div style={{ marginTop: 8 }}>
          <p>
            <strong>Terrain</strong>
          </p>
          <ul>
            {Object.entries(terrainKeyMap).map(([key, terrain]) => (
              <li key={`terrain-${key}`}>
                <strong>{key}</strong> – {terrain}
              </li>
            ))}
          </ul>
          <p>
            <strong>Buildings</strong>
          </p>
          <ul>
            {Object.entries(buildingKeyMap).map(([key, building]) => (
              <li key={`building-${key}`}>
                <strong>{key}</strong> – {building}
              </li>
            ))}
          </ul>
          <p>
            Tip: Press "c" to set a tile as City (automatically claim adjacent tiles), "e" to extend the hovered city.
          </p>
        </div>
      </div>
      <div>
        <strong>Advanced Building Options for Optimization:</strong>
        <div>
          <label>
            <input
              type="checkbox"
              checked={includeSawmill}
              onChange={(e) => setIncludeSawmill(e.target.checked)}
            />{" "}
            Sawmill
          </label>
          <label style={{ marginLeft: "12px" }}>
            <input
              type="checkbox"
              checked={includeWindmill}
              onChange={(e) => setIncludeWindmill(e.target.checked)}
            />{" "}
            Windmill
          </label>
          <label style={{ marginLeft: "12px" }}>
            <input
              type="checkbox"
              checked={includeForge}
              onChange={(e) => setIncludeForge(e.target.checked)}
            />{" "}
            Forge
          </label>
        </div>
        <p style={{ fontSize: "0.9rem", marginTop: "4px" }}>
          {`Estimated combinations: ${activeOptions}^${emptyEligibleCount} ≈ 10^${estimatedStepsExponent.toFixed(
            2
          )} ; Estimated time: ${estimateCompletionTime(emptyEligibleCount, activeOptions)}`}
        </p>
      </div>
      <p>Market bonus: {calculateMarketBonus(board)}</p>
      <button onClick={handleExportClick}>Export Data</button>
      <button onClick={handleApplyClick} style={{ marginLeft: 8 }}>
        Load Data
      </button>
      <button onClick={handlePlaceBasicBuildingsClick} style={{ marginLeft: 8 }}>
        Place Basic Buildings
      </button>
      <button onClick={handlePlaceBuildingsClick} style={{ marginLeft: 8 }}>
        Place Advanced Buildings
      </button>
      <div style={{ display: "inline-flex", alignItems: "center", marginLeft: 8 }}>
        <button onClick={startOptimization} disabled={isOptimizing}>
          {isOptimizing ? "Optimizing..." : "Optimize Advanced Buildings (Brute Force)"}
        </button>
        {isOptimizing && (
          <button onClick={stopOptimization} style={{ marginLeft: "8px" }}>
            Stop Optimize
          </button>
        )}
        <span style={{ marginLeft: 8, fontSize: "0.9rem" }}>
          {`Estimated combinations: ${activeOptions}^${emptyEligibleCount} ≈ 10^${estimatedStepsExponent.toFixed(
            2
          )}`}
        </span>
      </div>
      <button onClick={handleRemoveNonContributingClick} style={{ marginLeft: 8 }}>
        Remove Non-Contributing Basics
      </button>
      <p style={{ marginTop: 8, marginBottom: 4 }}>Board JSON:</p>
      <textarea
        style={{ width: "100%", height: "150px" }}
        value={configText}
        onChange={handleConfigChange}
      />
      <div style={{ marginTop: 20, ...boardStyle, gridTemplateColumns: `repeat(${board.width}, 40px)` }}>
        {board.tiles.map((tile) => {
          const baseColor = getTerrainColor(tile.terrain);
          const bldgColor = getBuildingColor(tile.building);
          const borderStyle = computeTileBorderStyle(tile, board);
          let displayText = "";
          if (tile.building !== Building.None) {
            if (tile.building === Building.Market) {
              displayText = getMarketLevel(tile, board).toString();
            } else if ([Building.Sawmill, Building.Windmill, Building.Forge].includes(tile.building)) {
              displayText = `${getBuildingKey(tile.building)}${getBuildingLevel(tile, board)}`;
            } else {
              displayText = getBuildingKey(tile.building);
            }
          }
          return (
            <div
              key={`${tile.x}-${tile.y}`}
              style={{ ...tileStyle, ...borderStyle, backgroundColor: baseColor }}
              onMouseEnter={() => setHoveredTile(tile)}
            >
              <div
                style={{
                  width: "90%",
                  height: "60%",
                  backgroundColor: bldgColor,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: bldgColor === "transparent" ? "none" : "1px solid #999",
                }}
              >
                {displayText}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
