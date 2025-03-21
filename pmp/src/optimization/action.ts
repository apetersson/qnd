import { Board, Building, getNeighbors, Terrain, TileData } from "../models/Board";

/** Interface for a dynamic action that can be applied on a tile */
export interface Action {
  id: string;
  description: string;
  cost: number; // Positive cost for placements, negative for removals
  /** Applies the action to the given tile (mutating it) */
  perform: (tile: TileData, board: Board) => void;
  /** Determines if the action can be applied to the given tile */
  canApply: (tile: TileData, board: Board) => boolean;
}

/** List of terrains where advanced building actions are allowed */
const ADV_BUILDINGS_TERRAIN = [Terrain.None, Terrain.Field];
/** Dynamic list of actions. You can extend this list with other actions later. */
export const dynamicActions: Action[] = [
  {
    id: 'place-sawmill',
    description: 'Place Sawmill',
    cost: 5,
    perform: (tile, _board) => {
      tile.building = Building.Sawmill;
    },
    canApply: (tile, board) => {
      if (!ADV_BUILDINGS_TERRAIN.includes(tile.terrain)) return false;
      if (tile.terrain !== Terrain.None) return false;
      if (tile.building !== Building.None) return false;
      if (!tile.cityId) return false;
      // Ensure the city does not already have a sawmill.
      if (board.tiles.some(t => t.cityId === tile.cityId && t.building === Building.Sawmill)) return false;
      // Require a neighboring LumberHut.
      return getNeighbors(tile, board).some(n => n.building === Building.LumberHut);
    },
  },
  {
    id: 'place-forge',
    description: 'Place Forge',
    cost: 5,
    perform: (tile, _board) => {
      tile.building = Building.Forge;
    },
    canApply: (tile, board) => {
      if (!ADV_BUILDINGS_TERRAIN.includes(tile.terrain)) return false;
      if (tile.building !== Building.None) return false;
      if (!tile.cityId) return false;
      if (board.tiles.some(t => t.cityId === tile.cityId && t.building === Building.Forge)) return false;
      // Require a neighboring Mine.
      return getNeighbors(tile, board).some(n => n.building === Building.Mine);
    },
  },
  {
    id: 'place-windmill',
    description: 'Place Windmill',
    cost: 5,
    perform: (tile, _board) => {
      tile.building = Building.Windmill;
    },
    canApply: (tile, board) => {
      if (!ADV_BUILDINGS_TERRAIN.includes(tile.terrain)) return false;
      if (tile.building !== Building.None) return false;
      if (!tile.cityId) return false;
      if (board.tiles.some(t => t.cityId === tile.cityId && t.building === Building.Windmill)) return false;
      // Require a neighboring Farm.
      return getNeighbors(tile, board).some(n => n.building === Building.Farm);
    },
  },
  {
    id: 'place-market',
    description: 'Place Market',
    cost: 5,
    perform: (tile, _board) => {
      tile.building = Building.Market;
    },
    canApply: (tile, board) => {
      if (!ADV_BUILDINGS_TERRAIN.includes(tile.terrain)) return false;
      if (tile.building !== Building.None) return false;
      if (!tile.cityId) return false;
      if (board.tiles.some(t => t.cityId === tile.cityId && t.building === Building.Market)) return false;
      return true; // Market can always be placed if the tile is empty.
    },
  },
  {
    id: 'remove-forest',
    description: 'Remove Forest',
    cost: -1,
    perform: (tile, _board) => {
      if (tile.terrain === Terrain.Forest) {
        tile.terrain = Terrain.None;
      }
    },
    canApply: (tile, _board) => {
      if (tile.building !== Building.None) return false;
      return tile.terrain === Terrain.Forest;
    },
  },
  // New actions:
  {
    id: 'burn-forest',
    description: 'Burn Forest',
    cost: 5,
    perform: (tile, _board) => {
      if (tile.terrain === Terrain.Forest) {
        tile.terrain = Terrain.Field;
      }
    },
    canApply: (tile, _board) => {
      // Only allow burning if the tile is a forest and has no building.
      return tile.terrain === Terrain.Forest && tile.building === Building.None;
    },
  },
  {
    id: 'destroy-building',
    description: 'Destroy Building',
    cost: 5,
    perform: (tile, _board) => {
      // Remove any building on the tile.
      tile.building = Building.None;
    },
    canApply: (tile, _board) => {
      // Can only destroy if there's a building present.
      return tile.building !== Building.None;
    },
  },
  {
    id: 'grow-forest',
    description: 'Grow Forest',
    cost: 5,
    perform: (tile, _board) => {
      // Transform an empty tile into a forest.
      tile.terrain = Terrain.Forest;
    },
    canApply: (tile, _board) => {
      // Allow growth only if the tile is completely empty.
      return tile.terrain === Terrain.None && tile.building === Building.None;
    },
  },
  {
    id: 'add-lumber-hut',
    description: 'Add Lumber Hut',
    cost: 3,
    perform: (tile, _board) => {
      tile.building = Building.LumberHut;
    },
    canApply: (tile, _board) => {
      // Only allowed on forest tiles with no building.
      return tile.terrain === Terrain.Forest && tile.building === Building.None;
    },
  },
  {
    id: 'add-farm',
    description: 'Add Farm',
    cost: 5,
    perform: (tile, _board) => {
      tile.building = Building.Farm;
    },
    canApply: (tile, _board) => {
      // Only allowed on field tiles with no building.
      return tile.terrain === Terrain.Field && tile.building === Building.None;
    },
  },
  {
    id: 'add-mine',
    description: 'Add Mine',
    cost: 5,
    perform: (tile, _board) => {
      tile.building = Building.Mine;
    },
    canApply: (tile, _board) => {
      // Only allowed on mountain tiles with no building.
      return tile.terrain === Terrain.Mountain && tile.building === Building.None;
    },
  },
];