// ./components/PolytopiaMarketPlanner.tsx
import React, { ChangeEvent, useEffect, useRef, useState } from "react";
import { Board, Building, createInitialBoard, Terrain, TileData } from "../models/Board";
import { estimateCompletionTime, parseBuildingValue, parseTerrainValue } from "../utils/helpers";
import {
  placeAdvancedBuildingsSimple,
  placeBasicResourceBuildings,
  removeNonContributingBasicBuildings,
} from "../placement/placement";
import {
  calculateMarketBonus,
  optimizeAdvancedBuildingsAsync,
  sumLevelsForFood,
} from "../optimization/optimizeAdvancedBuildings";
import { claimCityArea, extendCity, removeCityAssociation } from "../placement/city";
import { Menu, MenuItem } from "@mui/material";
import BoardVisuals from "./BoardVisuals";
import * as pako from "pako";

// Funktionen zur Kodierung/Dekodierung des Zustands
function encodeState(state: any): string {
  const json = JSON.stringify(state);
  const compressed = pako.deflate(json);
  const binaryString = String.fromCharCode(...Array.from(compressed));
  return btoa(binaryString);
}

function decodeState(encoded: string): any {
  const binaryString = atob(encoded);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const decompressed = pako.inflate(bytes, {to: "string"});
  return JSON.parse(decompressed);
}

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

const containerStyle: React.CSSProperties = {margin: "20px"};

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
  const [board, setBoard] = useState<Board>(() => {
    if (window.location.hash.length > 1) {
      try {
        const encoded = window.location.hash.substring(1);
        const loadedBoard = decodeState(encoded);
        const foundIndex = gridSizes.findIndex(
          (sz) => sz.width === loadedBoard.width && sz.height === loadedBoard.height
        );
        setSizeIndex(foundIndex >= 0 ? foundIndex : -1);
        return loadedBoard;
      } catch (err) {
        console.error("Error decoding board state from URL:", err);
      }
    }
    return createInitialBoard(initialWidth, initialHeight);
  });
  const [hoveredTile, setHoveredTile] = useState<TileData | null>(null);
  const [configText, setConfigText] = useState("");

  const [includeSawmill, setIncludeSawmill] = useState(true);
  const [includeWindmill, setIncludeWindmill] = useState(true);
  const [includeForge, setIncludeForge] = useState(true);

  const emptyEligibleCount = board.tiles.filter(
    (tile) =>
      tile.terrain === Terrain.None &&
      tile.building === Building.None &&
      tile.cityId !== null
  ).length;
  const activeOptions =
    (includeSawmill ? 1 : 0) +
    (includeWindmill ? 1 : 0) +
    (includeForge ? 1 : 0) +
    2;
  const estimatedStepsExponent = emptyEligibleCount * Math.log10(activeOptions);
  const estimatedTime = estimateCompletionTime(emptyEligibleCount, activeOptions);

  const cancelTokenRef = useRef<{ canceled: boolean }>({canceled: false});
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [selectedTile, setSelectedTile] = useState<TileData | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  const startOptimization = async () => {
    cancelTokenRef.current = {canceled: false};
    setIsOptimizing(true);
    const result = await optimizeAdvancedBuildingsAsync(board, cancelTokenRef.current, {
      includeSawmill,
      includeWindmill,
      includeForge,
    }, (progress) => {
      console.log("progress", progress);
    });
    setBoard(result);
    setIsOptimizing(false);
  };

  const stopOptimization = () => {
    cancelTokenRef.current.canceled = true;
    setIsOptimizing(false);
  };

  function handleTileAction(key: string, tile: TileData) {
    if (key.toLowerCase() === "e") {
      if (tile.terrain === Terrain.City && tile.cityId) {
        setBoard((prev) => extendCity(prev, tile.cityId!));
      }
      return;
    }
    const lowerKey = key.toLowerCase();
    const terrainCandidate = terrainKeyMap[lowerKey];
    const buildingCandidate = buildingKeys[lowerKey as keyof typeof buildingKeys];
    if (terrainCandidate !== undefined) {
      setBoard((prev) => {
        const updated = prev.tiles.map((t) => {
          if (t.x === tile.x && t.y === tile.y) {
            if (terrainCandidate === Terrain.City) {
              return {...t, terrain: Terrain.City, cityId: `${t.x}-${t.y}`};
            }
            return {...t, terrain: terrainCandidate};
          }
          return t;
        });
        if (terrainCandidate === Terrain.City) {
          const cityTile = prev.tiles.find((t) => t.x === tile.x && t.y === tile.y);
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
    }
  }

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

  // Popup-Aktionen
  const dynamicPopupActions = [
    ...Object.entries(terrainKeyMap).map(([key, terrain]) => ({
      key,
      label: `Set Terrain: ${terrain}`,
    })),
    ...Object.entries(buildingKeys).map(([key, building]) => ({
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

  // Aktualisiere den URL-Hash bei Änderungen
  useEffect(() => {
    try {
      const encodedState = encodeState(board);
      window.history.replaceState(null, "", `#${encodedState}`);
    } catch (err) {
      console.error("Error encoding board state:", err);
    }
  }, [board]);

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
          Current Board: {`${gridSizes[sizeIndex].width}x${gridSizes[sizeIndex].height}`} with{" "}
          {board.width * board.height} tiles
        </p>
        <strong>Keyboard Shortcuts</strong>
        <div style={{marginTop: 8}}>
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
            {Object.entries(buildingKeys).map(([key, building]) => (
              <li key={`building-${key}`}>
                <strong>{key}</strong> – {building}
              </li>
            ))}
          </ul>
          <p>
            Tipp: Drücke "c", um ein Feld als City zu markieren (adjazente Felder werden automatisch
            zugeordnet) und "e", um die ausgewählte Stadt zu erweitern.
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
          <label style={{marginLeft: "12px"}}>
            <input
              type="checkbox"
              checked={includeWindmill}
              onChange={(e) => setIncludeWindmill(e.target.checked)}
            />{" "}
            Windmill
          </label>
          <label style={{marginLeft: "12px"}}>
            <input
              type="checkbox"
              checked={includeForge}
              onChange={(e) => setIncludeForge(e.target.checked)}
            />{" "}
            Forge
          </label>
        </div>
        <p style={{fontSize: "0.9rem", marginTop: "4px"}}>
          {`Estimated combinations: ${activeOptions}^${emptyEligibleCount} ≈ 10^${estimatedStepsExponent.toFixed(
            2
          )} ; Estimated time: ${estimatedTime}`}
        </p>
      </div>
      <p>Market bonus: {calculateMarketBonus(board)}</p>
      <p>Advanced building levels sum: {sumLevelsForFood(board)}</p>
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
      <p style={{marginTop: 8, marginBottom: 4}}>Board JSON:</p>
      <textarea
        style={{width: "100%", height: "150px"}}
        value={configText}
        onChange={handleConfigChange}
      />
      {/* BoardVisuals übernimmt hier das Rendern des Boards */}
      <BoardVisuals
        board={board}
        onTileHover={(tile) => setHoveredTile(tile)}
        onTileClick={(tile, e) => {
          setSelectedTile(tile);
          setMenuAnchor(e.currentTarget);
        }}
        onMouseLeave={() => setHoveredTile(null)}
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
