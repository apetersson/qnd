import React, { useState, useEffect, ChangeEvent } from "react";

////////////////////////////////////////////////////////////////////////////////
// Data types
////////////////////////////////////////////////////////////////////////////////

enum Terrain {
  None = "NONE",
  Field = "FIELD",
  Forest = "FOREST",
  Mountain = "MOUNTAIN",
  City = "CITY",
}

enum Building {
  None = "NONE",
  Farm = "FARM",
  LumberHut = "LUMBER_HUT",
  Mine = "MINE",
  Sawmill = "SAWMILL",
  Windmill = "WINDMILL",
  Forge = "FORGE",
  Market = "MARKET",
}

const MARKET_ADJ_BUILDINGS = [Building.Sawmill, Building.Windmill, Building.Forge];

interface TileData {
  x: number;
  y: number;
  terrain: Terrain;
  building: Building;
}

interface Board {
  width: number;
  height: number;
  tiles: TileData[];
}

////////////////////////////////////////////////////////////////////////////////
// Helper: parse strings into valid Terrain and Building
////////////////////////////////////////////////////////////////////////////////

function parseTerrainValue(value: string | undefined): Terrain {
  switch ((value || "").toUpperCase()) {
    case "FIELD":
      return Terrain.Field;
    case "FOREST":
      return Terrain.Forest;
    case "MOUNTAIN":
      return Terrain.Mountain;
    case "CITY":
      return Terrain.City;
    default:
      return Terrain.None;
  }
}

function parseBuildingValue(value: string | undefined): Building {
  switch ((value || "").toUpperCase()) {
    case "FARM":
      return Building.Farm;
    case "LUMBER_HUT":
      return Building.LumberHut;
    case "MINE":
      return Building.Mine;
    case "SAWMILL":
      return Building.Sawmill;
    case "WINDMILL":
      return Building.Windmill;
    case "FORGE":
      return Building.Forge;
    case "MARKET":
      return Building.Market;
    default:
      return Building.None;
  }
}

////////////////////////////////////////////////////////////////////////////////
// Board creation and adjacency
////////////////////////////////////////////////////////////////////////////////

function createInitialBoard(width: number, height: number): Board {
  const tiles: TileData[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      tiles.push({ x, y, terrain: Terrain.None, building: Building.None });
    }
  }
  return { width, height, tiles };
}

function getNeighbors(tile: TileData, board: Board): TileData[] {
  const { x, y } = tile;
  const offsets = [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ];
  return offsets
    .map(([dx, dy]) => board.tiles.find((t) => t.x === x + dx && t.y === y + dy))
    .filter((t): t is TileData => Boolean(t));
}

function getBuildingLevel(tile: TileData, board: Board): number {
  switch (tile.building) {
    case Building.Sawmill:
      return getNeighbors(tile, board).filter((n) => n.building === Building.LumberHut).length;
    case Building.Windmill:
      return getNeighbors(tile, board).filter((n) => n.building === Building.Farm).length;
    case Building.Forge:
      return getNeighbors(tile, board).filter((n) => n.building === Building.Mine).length;
    default:
      return 1;
  }
}

function calculateMarketBonus(tile: TileData, board: Board): number {
  if (tile.building !== Building.Market) return 0;
  let bonus = 0;
  const neighbors = getNeighbors(tile, board);
  for (const nbr of neighbors) {
    if (MARKET_ADJ_BUILDINGS.includes(nbr.building)) {
      const lvl = getBuildingLevel(nbr, board);
      bonus += Math.min(lvl, 8);
    }
  }
  return bonus;
}

function calculateTotalMarketBonus(board: Board): number {
  return board.tiles.reduce((acc, t) => acc + calculateMarketBonus(t, board), 0);
}

////////////////////////////////////////////////////////////////////////////////
// Terrain-building constraints
////////////////////////////////////////////////////////////////////////////////

function requiredTerrainForBuilding(building: Building): Terrain | null {
  switch (building) {
    case Building.Farm:
      return Terrain.Field;
    case Building.LumberHut:
      return Terrain.Forest;
    case Building.Mine:
      return Terrain.Mountain;
    case Building.Sawmill:
    case Building.Windmill:
    case Building.Forge:
    case Building.Market:
      return Terrain.None;
    default:
      return null;
  }
}

function canPlaceBuildingOnTerrain(building: Building, terrain: Terrain): boolean {
  const required = requiredTerrainForBuilding(building);
  if (required !== null) {
    return required === terrain;
  }
  return true;
}

////////////////////////////////////////////////////////////////////////////////
// Unique City Association
////////////////////////////////////////////////////////////////////////////////

// For a given tile, return the index of the associated city (if any) – the closest city within Chebyshev distance 2.
// If tied, the first city in the board order is used.
function getAssociatedCityIndex(tile: TileData, board: Board): number | null {
  let bestCityIndex: number | null = null;
  let bestDistance = Infinity;
  board.tiles.forEach((candidate, idx) => {
    if (candidate.terrain === Terrain.City) {
      const dx = Math.abs(candidate.x - tile.x);
      const dy = Math.abs(candidate.y - tile.y);
      const distance = Math.max(dx, dy);
      if (distance <= 2 && distance < bestDistance) {
        bestDistance = distance;
        bestCityIndex = idx;
      }
    }
  });
  return bestCityIndex;
}

// Check if the associated city already has the candidate advanced building in its domain.
function associatedCityHasAdvancedBuilding(
  board: Board,
  candidate: Building,
  associatedCityIndex: number
): boolean {
  for (let j = 0; j < board.tiles.length; j++) {
    const t = board.tiles[j];
    if (getAssociatedCityIndex(t, board) === associatedCityIndex && t.building === candidate) {
      return true;
    }
  }
  return false;
}

////////////////////////////////////////////////////////////////////////////////
// Keyboard mappings
////////////////////////////////////////////////////////////////////////////////

const terrainKeyMap: Record<string, Terrain> = {
  n: Terrain.None,
  d: Terrain.Field,
  f: Terrain.Forest,
  h: Terrain.Mountain,
  c: Terrain.City,
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

////////////////////////////////////////////////////////////////////////////////
// UI styling
////////////////////////////////////////////////////////////////////////////////

const containerStyle: React.CSSProperties = {
  margin: "20px",
};

const boardStyle: React.CSSProperties = {
  display: "grid",
  gap: "2px",
};

const tileStyle: React.CSSProperties = {
  width: "40px",
  height: "40px",
  border: "1px solid #666",
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

////////////////////////////////////////////////////////////////////////////////
// Grid size selection
////////////////////////////////////////////////////////////////////////////////

const gridSizes = [
  { label: "Tiny (11x11)", width: 11, height: 11 },
  { label: "Small (14x14)", width: 14, height: 14 },
  { label: "Normal (16x16)", width: 16, height: 16 },
  { label: "Large (18x18)", width: 18, height: 18 },
  { label: "Huge (20x20)", width: 20, height: 20 },
  { label: "Massive (30x30)", width: 30, height: 30 },
];

////////////////////////////////////////////////////////////////////////////////
// Optimization logic
////////////////////////////////////////////////////////////////////////////////

// 1) Place basic resource buildings on Field/Forest/Mountain
function placeBasicResourceBuildings(board: Board): Board {
  const newBoard: Board = { ...board, tiles: board.tiles.map((t) => ({ ...t })) };
  newBoard.tiles.forEach((tile, i) => {
    if (tile.building !== Building.None) return;
    if (tile.terrain === Terrain.Field) {
      newBoard.tiles[i].building = Building.Farm;
    } else if (tile.terrain === Terrain.Forest) {
      newBoard.tiles[i].building = Building.LumberHut;
    } else if (tile.terrain === Terrain.Mountain) {
      newBoard.tiles[i].building = Building.Mine;
    }
  });
  return newBoard;
}

// Test total Market bonus if we place candidate advanced building on tile tileIndex.
function testAdvancedBuilding(
  board: Board,
  tileIndex: number,
  candidate: Building
): number {
  const testBoard: Board = {
    ...board,
    tiles: board.tiles.map((t, i) =>
      i === tileIndex ? { ...t, building: candidate } : { ...t }
    ),
  };
  return calculateTotalMarketBonus(testBoard);
}

// 2) Place advanced buildings (Sawmill, Windmill, Forge, Market) on empty terrain=NONE,
// ensuring that each tile is associated with a unique city and that city gets at most one of each type.
function placeAdvancedBuildingsWithCityLimits(board: Board): Board {
  let newBoard: Board = { ...board, tiles: board.tiles.map((t) => ({ ...t })) };
  const baselineBonus = calculateTotalMarketBonus(newBoard);

  for (let i = 0; i < newBoard.tiles.length; i++) {
    const tile = newBoard.tiles[i];
    if (tile.terrain !== Terrain.None || tile.building !== Building.None) continue;
    // Determine the tile's associated city, if any.
    const associatedCityIndex = getAssociatedCityIndex(tile, newBoard);

    let bestBuilding = Building.None;
    let bestScore = baselineBonus;

    const advancedCandidates = [Building.Sawmill, Building.Windmill, Building.Forge, Building.Market];

    for (const candidate of advancedCandidates) {
      if (!canPlaceBuildingOnTerrain(candidate, tile.terrain)) continue;
      // If the tile is associated with a city, check if that city already has this candidate.
      if (associatedCityIndex !== null && associatedCityHasAdvancedBuilding(newBoard, candidate, associatedCityIndex)) {
        continue;
      }
      const score = testAdvancedBuilding(newBoard, i, candidate);
      if (score > bestScore) {
        bestScore = score;
        bestBuilding = candidate;
      }
    }
    if (bestBuilding !== Building.None) {
      newBoard.tiles[i].building = bestBuilding;
    }
  }
  return newBoard;
}

// 3) Remove advanced buildings that, if removed, do not reduce the total Market bonus.
function removeUselessAdvancedBuildings(board: Board): Board {
  let changed = true;
  let currentBoard: Board = board;
  while (changed) {
    changed = false;
    const baselineBonus = calculateTotalMarketBonus(currentBoard);
    const newTiles = currentBoard.tiles.map((tile, i) => {
      if (
        tile.building === Building.Sawmill ||
        tile.building === Building.Windmill ||
        tile.building === Building.Forge ||
        tile.building === Building.Market
      ) {
        const testBoard: Board = {
          ...currentBoard,
          tiles: currentBoard.tiles.map((t, j) =>
            j === i ? { ...t, building: Building.None } : { ...t }
          ),
        };
        const newBonus = calculateTotalMarketBonus(testBoard);
        if (newBonus >= baselineBonus) {
          changed = true;
          return { ...tile, building: Building.None };
        }
      }
      return tile;
    });
    currentBoard = { ...currentBoard, tiles: newTiles };
  }
  return currentBoard;
}

// Main optimization pipeline.
function optimizeBoard(board: Board): Board {
  let optimized = placeBasicResourceBuildings(board);
  optimized = placeAdvancedBuildingsWithCityLimits(optimized);
  optimized = removeUselessAdvancedBuildings(optimized);
  return optimized;
}

////////////////////////////////////////////////////////////////////////////////
// Main component
////////////////////////////////////////////////////////////////////////////////

export default function PolytopiaMarketPlanner() {
  const [sizeIndex, setSizeIndex] = useState<number>(0);
  const initialWidth = gridSizes[0].width;
  const initialHeight = gridSizes[0].height;

  const [board, setBoard] = useState<Board>(() => createInitialBoard(initialWidth, initialHeight));
  const [hoveredTile, setHoveredTile] = useState<TileData | null>(null);
  const [configText, setConfigText] = useState("");

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!hoveredTile) return;
      const key = e.key.toLowerCase();
      const terrainCandidate = terrainKeyMap[key];
      const buildingCandidate = buildingKeyMap[key];
      if (terrainCandidate !== undefined) {
        setBoard((prev) => ({
          ...prev,
          tiles: prev.tiles.map((t) => {
            if (t.x === hoveredTile.x && t.y === hoveredTile.y) {
              let newBuilding = t.building;
              if (!canPlaceBuildingOnTerrain(newBuilding, terrainCandidate)) {
                newBuilding = Building.None;
              }
              return { ...t, terrain: terrainCandidate, building: newBuilding };
            }
            return t;
          }),
        }));
      } else if (buildingCandidate !== undefined) {
        const forcedTerrain = requiredTerrainForBuilding(buildingCandidate);
        setBoard((prev) => ({
          ...prev,
          tiles: prev.tiles.map((t) => {
            if (t.x === hoveredTile.x && t.y === hoveredTile.y) {
              let newTerrain = t.terrain;
              if (forcedTerrain !== null) {
                newTerrain = forcedTerrain;
              }
              if (!canPlaceBuildingOnTerrain(buildingCandidate, newTerrain)) {
                return t;
              }
              return { ...t, terrain: newTerrain, building: buildingCandidate };
            }
            return t;
          }),
        }));
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hoveredTile]);

  const totalMarketBonus = calculateTotalMarketBonus(board);

  function handleExportClick() {
    const meaningfulTiles = board.tiles.filter(
      (t) => t.terrain !== Terrain.None || t.building !== Building.None
    );
    const exportBoard = {
      width: board.width,
      height: board.height,
      tiles: meaningfulTiles.map((t) => {
        const obj: any = { x: t.x, y: t.y };
        if (t.terrain !== Terrain.None) obj.terrain = t.terrain;
        if (t.building !== Building.None) obj.building = t.building;
        return obj;
      }),
    };
    const json = JSON.stringify(exportBoard, null, 2);
    setConfigText(json);
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
            const oldTile = newBoard.tiles[index];
            newBoard.tiles[index] = {
              ...oldTile,
              terrain: parseTerrainValue(tileObj.terrain),
              building: parseBuildingValue(tileObj.building),
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

  function handleOptimizeClick() {
    const newBoard = optimizeBoard(board);
    setBoard(newBoard);
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
          Current Board: {gridSizeLabel} with {board.width * board.height} tiles
        </p>
        <strong>Keyboard Shortcuts</strong>
        <div style={{ marginTop: 8 }}>
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
            Simply hover over a tile with the mouse and press the corresponding key. Enjoy planning!
          </p>
        </div>
      </div>
      <p>Market bonus: {totalMarketBonus}</p>
      <button onClick={handleExportClick}>Export</button>
      <button onClick={handleApplyClick} style={{ marginLeft: 8 }}>Apply</button>
      {/*<button onClick={handleOptimizeClick} style={{ marginLeft: 8 }}>Optimize</button>*/}
      <p style={{ marginTop: 8, marginBottom: 4 }}>Board JSON:</p>
      <textarea style={{ width: "100%", height: "150px" }} value={configText} onChange={handleConfigChange} />
      <div style={{ marginTop: 20, ...boardStyle, gridTemplateColumns: `repeat(${board.width}, 40px)` }}>
        {board.tiles.map((tile) => {
          const baseColor = getTerrainColor(tile.terrain);
          const bldgColor = getBuildingColor(tile.building);
          return (
            <div
              key={`${tile.x}-${tile.y}`}
              style={{ ...tileStyle, backgroundColor: baseColor }}
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
                {tile.building !== Building.None ? tile.building : ""}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
