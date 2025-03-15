// src/optimization/optimizeAdvancedBuildings.ts
import { Board, TileData, Building, Terrain } from "../models/Board";
import { getNeighbors } from "../models/Board";

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

export function getMarketLevel(tile: TileData, board: Board): number {
  const MARKET_ADJ_BUILDINGS = [Building.Sawmill, Building.Windmill, Building.Forge];
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
    if ([Building.Sawmill, Building.Windmill, Building.Forge].includes(nbr.building)) {
      bonus += Math.min(getBuildingLevel(nbr, board), 8);
    }
  }
  return bonus;
}

export function removeAdvancedBuildings(board: Board): Board {
  return {
    ...board,
    tiles: board.tiles.map((t) =>
      [Building.Sawmill, Building.Windmill, Building.Forge, Building.Market].includes(t.building)
        ? { ...t, building: Building.None }
        : { ...t }
    ),
  };
}

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

function copyBoard(board: Board): Board {
  return {
    width: board.width,
    height: board.height,
    tiles: board.tiles.map((t) => ({ ...t })),
  };
}

export function optimizeAdvancedBuildings(board: Board): Board {
  const initialBoard = removeAdvancedBuildings(board);
  const candidateIndices = initialBoard.tiles
    .map((tile, index) =>
      tile.terrain === Terrain.None && tile.building === Building.None ? index : -1
    )
    .filter((index) => index !== -1);

  let bestBonus = calculateMarketBonus(initialBoard);
  let bestBoard = copyBoard(initialBoard);
  let iterationCount = 0;

  function rec(i: number, currentBoard: Board, usedCities: Set<string>) {
    iterationCount++;
    if (iterationCount % 10000 === 0) {
      console.log(
        `Iteration ${iterationCount}, Kandidatenindex ${i}, aktueller Bestbonus: ${bestBonus}`
      );
    }
    if (i === candidateIndices.length) {
      const bonus = calculateMarketBonus(currentBoard);
      if (bonus > bestBonus) {
        bestBonus = bonus;
        bestBoard = copyBoard(currentBoard);
        console.log(`Neuer Bestbonus: ${bestBonus} nach ${iterationCount} Iterationen.`);
      }
      return;
    }
    const idx = candidateIndices[i];
    rec(i + 1, currentBoard, usedCities);
    const tile = currentBoard.tiles[idx];
    const nearestCity = getNearestCity(tile, board);
    const cityKey = nearestCity ? `${nearestCity.x}-${nearestCity.y}` : null;
    const options: Building[] = [Building.Sawmill, Building.Windmill, Building.Forge, Building.Market];
    for (const option of options) {
      if (cityKey && usedCities.has(cityKey)) continue;
      currentBoard.tiles[idx].building = option;
      if (cityKey) usedCities.add(cityKey);
      rec(i + 1, currentBoard, usedCities);
      currentBoard.tiles[idx].building = Building.None;
      if (cityKey) usedCities.delete(cityKey);
    }
  }

  rec(0, initialBoard, new Set<string>());
  console.log(
    `Optimierung abgeschlossen. Gesamtiterationen: ${iterationCount}. Bester Bonus: ${bestBonus}`
  );
  return bestBoard;
}
