// src/placement/city.ts
import { Board, TileData, Terrain } from "../models/Board";
import { getNeighbors } from "../models/Board";

/**
 * When setting a city, mark the current tile as a city.
 * The cityId is set to its own coordinates and all directly adjacent,
 * unassigned tiles receive this cityId.
 */
export function claimCityArea(board: Board, cityTile: TileData): Board {
  const cityId = `${cityTile.x}-${cityTile.y}`;
  const newBoard: Board = {
    ...board,
    tiles: board.tiles.map(tile => ({ ...tile })),
  };

  // Set the city tile: change terrain to City and assign cityId
  const idx = newBoard.tiles.findIndex(t => t.x === cityTile.x && t.y === cityTile.y);
  if (idx !== -1) {
    newBoard.tiles[idx].terrain = Terrain.City;
    newBoard.tiles[idx].cityId = cityId;
  }

  // Claim directly adjacent tiles if they are not already assigned
  const neighbors = getNeighbors(cityTile, board);
  neighbors.forEach(nbr => {
    const nbrIdx = newBoard.tiles.findIndex(t => t.x === nbr.x && t.y === nbr.y);
    if (nbrIdx !== -1 && newBoard.tiles[nbrIdx].cityId === null) {
      newBoard.tiles[nbrIdx].cityId = cityId;
    }
  });

  return newBoard;
}

/**
 * Extends the city (with the specified cityId) by one layer:
 * For each tile already assigned to this city, assign all adjacent, unassigned tiles to the city.
 * Already assigned tiles remain unchanged.
 */
export function extendCity(board: Board, cityId: string): Board {
  const newBoard: Board = {
    ...board,
    tiles: board.tiles.map(tile => ({ ...tile })),
  };
  board.tiles.forEach(tile => {
    if (tile.cityId === cityId) {
      const neighbors = getNeighbors(tile, board);
      neighbors.forEach(nbr => {
        const idx = newBoard.tiles.findIndex(t => t.x === nbr.x && t.y === nbr.y);
        if (idx !== -1 && newBoard.tiles[idx].cityId === null) {
          newBoard.tiles[idx].cityId = cityId;
        }
      });
    }
  });
  return newBoard;
}
// Removes the city association from all tiles with the given cityId.
export function removeCityAssociation(board: Board, cityId: string): Board {
  const newBoard: Board = {
    ...board,
    tiles: board.tiles.map(tile => ({ ...tile })),
  };
  newBoard.tiles.forEach(tile => {
    if (tile.cityId === cityId) {
      tile.cityId = null;
    }
  });
  return newBoard;
}
