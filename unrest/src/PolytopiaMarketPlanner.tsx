import React, { useState, useEffect, ChangeEvent } from "react";

////////////////////////////////////////////////////////////////////////////////
// Data types
////////////////////////////////////////////////////////////////////////////////

export enum Terrain {
  None = "NONE",
  Field = "FIELD",
  Forest = "FOREST",
  Mountain = "MOUNTAIN",
  City = "CITY",
  Water = "WATER",
}

export enum Building {
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

export interface TileData {
  x: number;
  y: number;
  terrain: Terrain;
  building: Building;
}

export interface Board {
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
    case "WATER":
      return Terrain.Water;
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

// Für fortschrittliche Gebäude (außer Market) entspricht der Level der Anzahl angrenzender unterstützender Gebäude.
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

// Für eine Market-Kachel summieren wir die Levels der angrenzenden unterstützenden Gebäude.
function getMarketLevel(tile: TileData, board: Board): number {
  let sum = 0;
  const neighbors = getNeighbors(tile, board);
  for (const nbr of neighbors) {
    if (MARKET_ADJ_BUILDINGS.includes(nbr.building)) {
      sum += getBuildingLevel(nbr, board);
    }
  }
  return sum;
}

export function calculateMarketBonus(board: Board): number {
  return board.tiles.reduce((acc, t) => acc + calculateMarketBonusForTile(t, board), 0);
}

function calculateMarketBonusForTile(tile: TileData, board: Board): number {
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

////////////////////////////////////////////////////////////////////////////////
// Terrain-building constraints
////////////////////////////////////////////////////////////////////////////////

// Blockiert Platzierungen auf Wasser, egal welchen Gebäudetyp.
function canPlaceBuildingOnTerrain(building: Building, terrain: Terrain): boolean {
  if (terrain === Terrain.Water) return false;
  const required = requiredTerrainForBuilding(building);
  if (required !== null) {
    return required === terrain;
  }
  return true;
}

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

////////////////////////////////////////////////////////////////////////////////
// Keyboard mappings
////////////////////////////////////////////////////////////////////////////////

const terrainKeyMap: Record<string, Terrain> = {
  n: Terrain.None,
  d: Terrain.Field,
  f: Terrain.Forest,
  h: Terrain.Mountain,
  c: Terrain.City,
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

////////////////////////////////////////////////////////////////////////////////
// Zusätzliche Funktionen: Optimierung und Entfernen nicht beitragender Basic-Gebäude
////////////////////////////////////////////////////////////////////////////////

// Hilfsfunktion: Ermittelt die nächstgelegene Stadt (Manhattan-Distanz)
function getNearestCity(tile: TileData, board: Board): TileData | null {
  let minDist = Infinity;
  let nearest: TileData | null = null;
  board.tiles.forEach((t) => {
    if (t.terrain === Terrain.City) {
      const dist = Math.abs(t.x - tile.x) + Math.abs(t.y - tile.y);
      if (dist < minDist) {
        minDist = dist;
        nearest = t;
      }
    }
  });
  return nearest;
}

// Optimiert die Platzierung fortschrittlicher Gebäude (Sawmill, Windmill, Forge)
// unter Beachtung: max. 1 pro Stadt (nächste Stadt ermittelt via Manhattan-Distanz)
function optimizeAdvancedBuildings(board: Board): Board {
  // Entferne bestehende fortschrittliche Gebäude (Sawmill, Windmill, Forge, Market)
  const newBoard: Board = {
    ...board,
    tiles: board.tiles.map((t) =>
      [Building.Sawmill, Building.Windmill, Building.Forge, Building.Market].includes(t.building)
        ? { ...t, building: Building.None }
        : { ...t }
    ),
  };

  type Candidate = {
    tile: TileData;
    candidateType: Building;
    candidateValue: number;
    cityKey: string | null;
  };

  const candidates: Candidate[] = [];
  newBoard.tiles.forEach((tile) => {
    if (tile.terrain === Terrain.None && tile.building === Building.None) {
      const neighbors = getNeighbors(tile, newBoard);
      const sawmillPotential = neighbors.filter((n) => n.building === Building.LumberHut).length;
      const windmillPotential = neighbors.filter((n) => n.building === Building.Farm).length;
      const forgePotential = neighbors.filter((n) => n.building === Building.Mine).length;
      let candidateType: Building = Building.None;
      let candidateValue = 0;
      if (sawmillPotential > 0 || windmillPotential > 0 || forgePotential > 0) {
        if (sawmillPotential >= windmillPotential && sawmillPotential >= forgePotential) {
          candidateType = Building.Sawmill;
          candidateValue = sawmillPotential;
        } else if (windmillPotential >= forgePotential) {
          candidateType = Building.Windmill;
          candidateValue = windmillPotential;
        } else {
          candidateType = Building.Forge;
          candidateValue = forgePotential;
        }
      }
      if (candidateType !== Building.None) {
        const nearestCity = getNearestCity(tile, newBoard);
        const cityKey = nearestCity ? `${nearestCity.x}-${nearestCity.y}` : null;
        candidates.push({ tile, candidateType, candidateValue, cityKey });
      }
    }
  });

  // Für jede Stadt: wähle den Kandidaten mit dem höchsten Wert
  const bestCandidates: Record<string, Candidate> = {};
  candidates.forEach((candidate) => {
    if (candidate.cityKey) {
      if (
        !bestCandidates[candidate.cityKey] ||
        candidate.candidateValue > bestCandidates[candidate.cityKey].candidateValue
      ) {
        bestCandidates[candidate.cityKey] = candidate;
      }
    }
  });

  Object.values(bestCandidates).forEach((candidate) => {
    const index = newBoard.tiles.findIndex(
      (t) => t.x === candidate.tile.x && t.y === candidate.tile.y
    );
    if (index !== -1) {
      newBoard.tiles[index].building = candidate.candidateType;
    }
  });

  return newBoard;
}

// Entfernt alle Basic-Gebäude (Farm, LumberHut, Mine),
// die nicht angrenzend zu einem unterstützenden fortschrittlichen Gebäude liegen.
function removeNonContributingBasicBuildings(board: Board): Board {
  const newBoard: Board = { ...board, tiles: board.tiles.map((t) => ({ ...t })) };
  newBoard.tiles.forEach((tile, i) => {
    if (tile.building === Building.Farm) {
      const supports = getNeighbors(tile, newBoard).some((n) => n.building === Building.Windmill);
      if (!supports) {
        newBoard.tiles[i].building = Building.None;
      }
    } else if (tile.building === Building.LumberHut) {
      const supports = getNeighbors(tile, newBoard).some((n) => n.building === Building.Sawmill);
      if (!supports) {
        newBoard.tiles[i].building = Building.None;
      }
    } else if (tile.building === Building.Mine) {
      const supports = getNeighbors(tile, newBoard).some((n) => n.building === Building.Forge);
      if (!supports) {
        newBoard.tiles[i].building = Building.None;
      }
    }
  });
  return newBoard;
}

////////////////////////////////////////////////////////////////////////////////
// Advanced Building Placement (Simple Version)
////////////////////////////////////////////////////////////////////////////////

function placeAdvancedBuildingsSimple(board: Board): Board {
  const newBoard: Board = { ...board, tiles: board.tiles.map((t) => ({ ...t })) };
  newBoard.tiles.forEach((tile, i) => {
    if (tile.terrain === Terrain.None && tile.building === Building.None) {
      const neighbors = getNeighbors(tile, newBoard);
      const bonusSawmill = neighbors.filter((t) => t.building === Building.LumberHut).length;
      const bonusWindmill = neighbors.filter((t) => t.building === Building.Farm).length;
      const bonusForge = neighbors.filter((t) => t.building === Building.Mine).length;
      let candidate: Building = Building.None;
      if (bonusSawmill > 0 || bonusWindmill > 0 || bonusForge > 0) {
        if (bonusSawmill >= bonusWindmill && bonusSawmill >= bonusForge) {
          candidate = Building.Sawmill;
        } else if (bonusWindmill >= bonusForge) {
          candidate = Building.Windmill;
        } else {
          candidate = Building.Forge;
        }
      }
      if (candidate !== Building.None) {
        newBoard.tiles[i].building = candidate;
      }
    }
  });
  return newBoard;
}

////////////////////////////////////////////////////////////////////////////////
// Basic Resource Placement
////////////////////////////////////////////////////////////////////////////////

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

  const totalMarketBonus = calculateMarketBonus(board);

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

  // "Place Basic Buildings" button handler.
  function handlePlaceBasicBuildingsClick() {
    const newBoard = placeBasicResourceBuildings(board);
    setBoard(newBoard);
  }

  // "Place Buildings" button handler for advanced buildings (Simple).
  function handlePlaceBuildingsClick() {
    const newBoard = placeAdvancedBuildingsSimple(board);
    setBoard(newBoard);
  }

  // Neues Feature: Optimale Platzierung fortschrittlicher Gebäude
  function handleOptimizeClick() {
    const newBoard = optimizeAdvancedBuildings(board);
    setBoard(newBoard);
  }

  // Neues Feature: Entferne nicht beitragende Basic-Gebäude
  function handleRemoveNonContributingClick() {
    const newBoard = removeNonContributingBasicBuildings(board);
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
          <p>Simply hover over a tile and press the corresponding key.</p>
        </div>
      </div>
      <p>Market bonus: {totalMarketBonus}</p>
      <button onClick={handleExportClick}>Export</button>
      <button onClick={handleApplyClick} style={{ marginLeft: 8 }}>
        Apply
      </button>
      <button onClick={handlePlaceBasicBuildingsClick} style={{ marginLeft: 8 }}>
        Place Basic Buildings
      </button>
      <button onClick={handlePlaceBuildingsClick} style={{ marginLeft: 8 }}>
        Place Buildings
      </button>
      <button onClick={handleOptimizeClick} style={{ marginLeft: 8 }}>
        Optimize Advanced Buildings
      </button>
      <button onClick={handleRemoveNonContributingClick} style={{ marginLeft: 8 }}>
        Remove Non-Contributing Basics
      </button>
      <p style={{ marginTop: 8, marginBottom: 4 }}>Board JSON:</p>
      <textarea style={{ width: "100%", height: "150px" }} value={configText} onChange={handleConfigChange} />
      <div style={{ marginTop: 20, ...boardStyle, gridTemplateColumns: `repeat(${board.width}, 40px)` }}>
        {board.tiles.map((tile) => {
          const baseColor = getTerrainColor(tile.terrain);
          const bldgColor = getBuildingColor(tile.building);
          let displayText = "";
          if (tile.building !== Building.None) {
            if (tile.building === Building.Market) {
              displayText = getMarketLevel(tile, board).toString();
            } else if ([Building.Sawmill, Building.Windmill, Building.Forge].includes(tile.building)) {
              displayText = getBuildingLevel(tile, board).toString();
            } else {
              displayText = tile.building;
            }
          }
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
                {displayText}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
