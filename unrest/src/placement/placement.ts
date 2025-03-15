// src/placement/placement.ts
import { Board, TileData, Building, Terrain } from "../models/Board";
import { getNeighbors } from "../models/Board";

export function getBuildingLevel(tile: TileData, board: Board): number {
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

export function placeBasicResourceBuildings(board: Board): Board {
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

export function placeAdvancedBuildingsSimple(board: Board): Board {
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
        if (tile.cityId) {
          const alreadyExists = newBoard.tiles.some(
            (t) => t.cityId === tile.cityId && t.building === candidate
          );
          if (alreadyExists) return; // nicht platzieren, wenn bereits vorhanden
        }
        newBoard.tiles[i].building = candidate;
      }
    }
  });
  return newBoard;
}

export function removeNonContributingBasicBuildings(board: Board): Board {
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
