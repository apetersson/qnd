// src/models/Board.ts
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

export interface TileData {
  x: number;
  y: number;
  terrain: Terrain;
  building: Building;
  cityId: string | null; // Property indicating city association (using coordinates as id)
}

export interface Board {
  width: number;
  height: number;
  tiles: TileData[];
}

export function createInitialBoard(width: number, height: number): Board {
  const tiles: TileData[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      tiles.push({
        x,
        y,
        terrain: Terrain.None,
        building: Building.None,
        cityId: null,
      });
    }
  }
  return { width, height, tiles };
}

export function getNeighbors(tile: TileData, board: Board): TileData[] {
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
