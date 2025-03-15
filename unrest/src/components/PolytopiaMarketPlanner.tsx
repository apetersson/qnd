// src/components/PolytopiaMarketPlanner.tsx
import React, { ChangeEvent, useEffect, useState } from "react";
import { Board, Building, createInitialBoard, Terrain, TileData } from "../models/Board";
import { estimateCompletionTime, parseBuildingValue, parseTerrainValue } from "../utils/helpers";
import {
  getBuildingLevel,
  placeAdvancedBuildingsSimple,
  placeBasicResourceBuildings,
  removeNonContributingBasicBuildings,
} from "../placement/placement";
import {
  calculateMarketBonus,
  getMarketLevel,
  optimizeAdvancedBuildings
} from "../optimization/optimizeAdvancedBuildings";
import { claimCityArea, extendCity } from "../placement/city";

const terrainKeyMap: Record<string, Terrain> = {
  n: Terrain.None,
  d: Terrain.Field,
  f: Terrain.Forest,
  h: Terrain.Mountain,
  c: Terrain.City, // "c" legt eine Stadt fest
  a: Terrain.Water,
};

const buildingKeyMap: Record<string, Building> = {
  0: Building.None,
  s: Building.Sawmill,
  w: Building.Windmill,
  o: Building.Forge,
  m: Building.Market,
  r: Building.Farm,
  l: Building.LumberHut,
  i: Building.Mine,
};

const containerStyle: React.CSSProperties = {margin: "20px"};

const boardStyle: React.CSSProperties = {display: "grid", gap: "2px"};

const tileStyle: React.CSSProperties = {
  width: "40px",
  height: "40px",
  // Die Border wird dynamisch gesetzt – Basis ist hier nur die Box-Gestaltung.
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
    case Terrain.Forest:
      return "#d2f3d2";
    case Terrain.Field:
      return "#f2efd0";
    case Terrain.Mountain:
      return "#c2c2c2";
    case Terrain.City:
      return "#ffd700";
    case Terrain.Water:
      return "#00bfff";
    default:
      return "#ffffff";
  }
}

function getBuildingColor(building: Building): string {
  switch (building) {
    case Building.Market:
      return "#ffe080";
    case Building.Sawmill:
      return "#c2a079";
    case Building.Windmill:
      return "#c2e0c2";
    case Building.Forge:
      return "#c2c2e0";
    case Building.Farm:
      return "#ffe0e0";
    case Building.Mine:
      return "#ccc";
    case Building.LumberHut:
      return "#d9fdd9";
    default:
      return "transparent";
  }
}

/**
 * Berechnet für ein Tile, basierend auf seinen 4 kardinalen Nachbarn,
 * ob die Kante rot dargestellt werden soll (unterschiedliche cityId).
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
  const [sizeIndex, setSizeIndex] = useState<number>(0);
  const initialWidth = gridSizes[0].width;
  const initialHeight = gridSizes[0].height;
  const [board, setBoard] = useState<Board>(() => createInitialBoard(initialWidth, initialHeight));
  const [hoveredTile, setHoveredTile] = useState<TileData | null>(null);
  const [configText, setConfigText] = useState("");

  // Für die Optimierungsabschätzung
  const emptyCandidateCount = board.tiles.filter(
    (tile) => tile.terrain === Terrain.None && tile.building === Building.None
  ).length;
  const estimatedStepsExponent = emptyCandidateCount * Math.log10(5);
  const estimatedTime = estimateCompletionTime(emptyCandidateCount);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Keybind für "extend city" (Taste "e")
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
              // Beim Setzen einer Stadt: claim die Stadtfläche
              if (terrainCandidate === Terrain.City) {
                const cityTile = {...t, terrain: Terrain.City, cityId: `${t.x}-${t.y}`};
                return cityTile;
              }
              return {...t, terrain: terrainCandidate};
            }
            return t;
          });
          if (terrainCandidate === Terrain.City) {
            const cityTile = prev.tiles.find(
              (t) => t.x === hoveredTile.x && t.y === hoveredTile.y
            );
            if (cityTile) {
              return claimCityArea({...prev, tiles: updated}, cityTile);
            }
          }
          return {...prev, tiles: updated};
        });
      } else if (buildingCandidate !== undefined) {
        // Falls advanced building und Stadtzugehörigkeit vorhanden:
        setBoard((prev) => ({
          ...prev,
          tiles: prev.tiles.map((t) => {
            if (t.x === hoveredTile.x && t.y === hoveredTile.y) {
              // Wenn das Tile Teil einer Stadt ist, prüfen, ob in dieser Stadt schon dieser Gebäudetyp existiert
              if (t.cityId) {
                const alreadyExists = prev.tiles.some(
                  (tile) => tile.cityId === t.cityId && tile.building === buildingCandidate
                );
                if (alreadyExists) return t; // keine Änderung, wenn schon vorhanden
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

  function handleOptimizeClick() {
    setBoard(optimizeAdvancedBuildings(board));
  }

  function handleRemoveNonContributingClick() {
    setBoard(removeNonContributingBasicBuildings(board));
  }

  const gridSizeLabel =
    sizeIndex >= 0 && sizeIndex < gridSizes.length
      ? `${gridSizes[sizeIndex].width}x${gridSizes[sizeIndex].height}`
      : `${board.width}x${board.height}`;

  const terrainLabels: Record<Terrain, string> = {
    [Terrain.None]: "No Terrain",
    [Terrain.Field]: "Field",
    [Terrain.Forest]: "Forest",
    [Terrain.Mountain]: "Mountain",
    [Terrain.City]: "City",
    [Terrain.Water]: "Water",
  };

  const buildingLabels: Record<Building, string> = {
    [Building.None]: "Remove Building",
    [Building.Farm]: "Farm",
    [Building.LumberHut]: "Lumber Hut",
    [Building.Mine]: "Mine",
    [Building.Sawmill]: "Sawmill",
    [Building.Windmill]: "Windmill",
    [Building.Forge]: "Forge",
    [Building.Market]: "Market",
  };

  return (
    <div style={containerStyle}>
      <h1>Polytopia Market Planner</h1>
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
          Current Board: {gridSizeLabel} with {board.width * board.height} tiles
        </p>
        <strong>Keyboard Shortcuts</strong>
        <div style={{marginTop: 8}}>
          <p>
            <strong>Terrain</strong>
          </p>
          <ul>
            {Object.entries(terrainKeyMap).map(([key, terrain]) => (
              <li key={`terrain-${key}`}>
                <strong>{key}</strong> – {terrainLabels[terrain]}
              </li>
            ))}
          </ul>
          <p>
            <strong>Buildings</strong>
          </p>
          <ul>
            {Object.entries(buildingKeyMap).map(([key, building]) => (
              <li key={`building-${key}`}>
                <strong>{key}</strong> – {buildingLabels[building]}
              </li>
            ))}
          </ul>
          <p>
            Tip: Press "c" to set a tile as City (auto-claims adjacent tiles), "e" to extend the hovered city.
          </p>
        </div>
      </div>
      <p>Market bonus: {totalMarketBonus}</p>
      <button onClick={handleExportClick}>Export</button>
      <button onClick={handleApplyClick} style={{marginLeft: 8}}>
        Apply
      </button>
      <button onClick={handlePlaceBasicBuildingsClick} style={{marginLeft: 8}}>
        Place Basic Buildings
      </button>
      <button onClick={handlePlaceBuildingsClick} style={{marginLeft: 8}}>
        Place Advanced Buildings
      </button>
      <div style={{display: "inline-flex", alignItems: "center", marginLeft: 8}}>
        <button onClick={handleOptimizeClick}>
          Optimize Advanced Buildings (Brute Force)
        </button>
        <span style={{marginLeft: 8, fontSize: "0.9rem"}}>
          {`Estimated combinations: 5^${emptyCandidateCount} ≈ 10^${estimatedStepsExponent.toFixed(
            2
          )} ; Estimated time: ${estimatedTime}`}
        </span>
      </div>
      <button onClick={handleRemoveNonContributingClick} style={{marginLeft: 8}}>
        Remove Non-Contributing Basics
      </button>
      <p style={{marginTop: 8, marginBottom: 4}}>Board JSON:</p>
      <textarea
        style={{width: "100%", height: "150px"}}
        value={configText}
        onChange={handleConfigChange}
      />
      <div style={{marginTop: 20, ...boardStyle, gridTemplateColumns: `repeat(${board.width}, 40px)`}}>
        {board.tiles.map((tile) => {
          const baseColor = getTerrainColor(tile.terrain);
          const bldgColor = getBuildingColor(tile.building);
          const borderStyle = computeTileBorderStyle(tile, board);
          let displayText = "";
          if (tile.building !== Building.None) {
            if (tile.building === Building.Market) {
              displayText = getMarketLevel(tile, board).toString();
            } else if ([Building.Sawmill, Building.Windmill, Building.Forge].includes(tile.building)) {
              displayText = `${getBuildingLevel(tile, board)}`;
            } else {
              displayText = tile.building;
            }
          }
          return (
            <div
              key={`${tile.x}-${tile.y}`}
              style={{...tileStyle, ...borderStyle, backgroundColor: baseColor}}
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
