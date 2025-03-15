// src/placement/city.ts
import { Board, TileData, Terrain } from "../models/Board";
import { getNeighbors } from "../models/Board";

/**
 * Beim Setzen einer Stadt wird das aktuelle Tile als Stadt markiert.
 * Die cityId wird auf seine eigene Koordinate gesetzt und alle direkt angrenzenden,
 * noch unzugewiesenen Tiles erhalten diese cityId.
 */
export function claimCityArea(board: Board, cityTile: TileData): Board {
  const cityId = `${cityTile.x}-${cityTile.y}`;
  const newBoard: Board = {
    ...board,
    tiles: board.tiles.map(tile => ({ ...tile })),
  };

  // Setze das Stadt-Tile: Terrain wird auf City und cityId wird gesetzt
  const idx = newBoard.tiles.findIndex(t => t.x === cityTile.x && t.y === cityTile.y);
  if (idx !== -1) {
    newBoard.tiles[idx].terrain = Terrain.City;
    newBoard.tiles[idx].cityId = cityId;
  }

  // Claim direkt angrenzende Tiles, falls noch keine Zuordnung vorhanden ist
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
 * Erweitert die Stadt (mit der angegebenen cityId) um eine Schicht:
 * Für jedes Tile, das bereits dieser Stadt zugeordnet ist, werden alle angrenzenden,
 * noch unzugewiesenen Tiles ebenfalls der Stadt zugeordnet.
 * Bereits zugeordnete Tiles bleiben unverändert.
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
