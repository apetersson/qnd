import { Board, Building, getNeighbors, Terrain, TileData } from "../models/Board";
import { Technology } from "../models/Technology";

/** Interface for a dynamic action that can be applied on a tile during optimisation*/
export interface Action {
  id: string;
  description: string;
  cost: number; // Positive cost for placements, negative for removals
  perform: (tile: TileData, board: Board) => void;
  canApply: (tile: TileData, board: Board) => boolean;
  requiredTech: Technology;
}

// Define the list of terrains where advanced building actions are allowed.
const ADV_BUILDINGS_TERRAIN = [Terrain.None, Terrain.Field];

// Extract each action into a constant

export const SAWMILL_ACTION: Action = {
  id: 'place-sawmill',
  description: 'Place Sawmill',
  cost: 5,
  requiredTech: Technology.Mathematics,
  perform: (tile, _board) => {
    tile.building = Building.Sawmill;
  },
  canApply: (tile, board) => {
    if (!ADV_BUILDINGS_TERRAIN.includes(tile.terrain)) return false;
    if (tile.building !== Building.None) return false;
    if (!tile.cityId) return false;
    // Ensure the city does not already have a sawmill.
    if (board.tiles.some(t => t.cityId === tile.cityId && t.building === Building.Sawmill)) return false;
    // Require a neighboring LumberHut.
    return getNeighbors(tile, board).some(n => n.building === Building.LumberHut);
  },
};

export const FORGE_ACTION: Action = {
  id: 'place-forge',
  description: 'Place Forge',
  cost: 5,
  requiredTech: Technology.Smithery,
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
};

export const WINDMILL_ACTION: Action = {
  id: 'place-windmill',
  description: 'Place Windmill',
  cost: 5,
  requiredTech: Technology.Construction,
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
};

export const MARKET_ACTION: Action = {
  id: 'place-market',
  description: 'Place Market',
  cost: 5,
  requiredTech: Technology.Trade,
  perform: (tile, _board) => {
    tile.building = Building.Market;
  },
  canApply: (tile, board) => {
    if (!ADV_BUILDINGS_TERRAIN.includes(tile.terrain)) return false;
    if (tile.building !== Building.None) return false;
    if (!tile.cityId) return false;
    if (board.tiles.some(t => t.cityId === tile.cityId && t.building === Building.Market)) return false;
    return true;
  },
};

export const REMOVE_FOREST_ACTION: Action = {
  id: 'remove-forest',
  description: 'Remove Forest',
  cost: -1,
  requiredTech: Technology.Forestry,
  perform: (tile, _board) => {
    if (tile.terrain === Terrain.Forest) {
      tile.terrain = Terrain.None;
    }
  },
  canApply: (tile, _board) => tile.building === Building.None && tile.terrain === Terrain.Forest,
};

export const BURN_FOREST_ACTION: Action = {
  id: 'burn-forest',
  description: 'Burn Forest',
  cost: 5,
  requiredTech: Technology.Construction,
  perform: (tile, _board) => {
    if (tile.terrain === Terrain.Forest) {
      tile.terrain = Terrain.Field;
    }
  },
  canApply: (tile, _board) => tile.terrain === Terrain.Forest && tile.building === Building.None,
};

export const DESTROY_BUILDING_ACTION: Action = {
  id: 'destroy-building',
  description: 'Destroy Building',
  cost: 0,
  requiredTech: Technology.Chivalry,
  perform: (tile, _board) => {
    tile.building = Building.None;
  },
  canApply: (tile, _board) => tile.building !== Building.None,
};

export const GROW_FOREST_ACTION: Action = {
  id: 'grow-forest',
  description: 'Grow Forest',
  cost: 5,
  requiredTech: Technology.Spiritualism,
  perform: (tile, _board) => {
    tile.terrain = Terrain.Forest;
  },
  canApply: (tile, _board) => tile.terrain === Terrain.None && tile.building === Building.None,
};

export const LUMBER_HUT_ACTION: Action = {
  id: 'add-lumber-hut',
  description: 'Add Lumber Hut',
  cost: 3,
  requiredTech: Technology.Forestry,
  perform: (tile, _board) => {
    tile.building = Building.LumberHut;
  },
  canApply: (tile, _board) => tile.terrain === Terrain.Forest && tile.building === Building.None,
};

export const FARM_ACTION: Action = {
  id: 'add-farm',
  description: 'Add Farm',
  cost: 5,
  requiredTech: Technology.Farming,
  perform: (tile, _board) => {
    tile.building = Building.Farm;
  },
  canApply: (tile, _board) => tile.terrain === Terrain.Field && tile.building === Building.None,
};

export const MINE_ACTION: Action = {
  id: 'add-mine',
  description: 'Add Mine',
  cost: 5,
  requiredTech: Technology.Mining,
  perform: (tile, _board) => {
    tile.building = Building.Mine;
  },
  canApply: (tile, _board) => tile.terrain === Terrain.Mountain && tile.building === Building.None,
};

// Export the dynamic actions list
export const dynamicActions: Action[] = [
  SAWMILL_ACTION,
  FORGE_ACTION,
  WINDMILL_ACTION,
  MARKET_ACTION,
  REMOVE_FOREST_ACTION,
  BURN_FOREST_ACTION,
  DESTROY_BUILDING_ACTION,
  GROW_FOREST_ACTION,
  LUMBER_HUT_ACTION,
  FARM_ACTION,
  MINE_ACTION,
];
