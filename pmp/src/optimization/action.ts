import { Board, Building, getNeighbors, Terrain, TileData } from "../models/Board";
import { Technology } from "../models/Technology";
import { HistoryEntry } from "../models/historyEntry";

/** Interface for a dynamic action that can be applied on a tile during optimisation*/
export interface Action {
  id: string;
  description: string;
  cost: number; // Positive cost for placements, negative for removals
  perform: (tile: TileData, board: Board) => void;
  canApply: (tile: TileData, board: Board, history: HistoryEntry[], remainingBudget: number) => boolean;
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
  canApply: (tile, _board, history, remainingBudget) => {
    //it only makes sense to destroy something on a tile if we didn't already create something here as part of the optimisation process,
    // otherwise we'll get loops
    if (tile.building === Building.None) return false;

    //check if we have a chance to rebuild what we destroyed,
    // since it only makes sense to destroy to make place for something else or move it.
    const alreadyDeleted = history.filter(previousValue => previousValue.actionId === "destroy-building").length;
    const assumed_Cost_rebuild = 5;
    if (((alreadyDeleted + 1) * assumed_Cost_rebuild / remainingBudget) > 1) return false;

    //check if we placed something on that tile earlier, if so don't destroy what we just placed
    for (const historyEntry of history) {
      if (isBuildingPlacementAction(historyEntry.actionId)) {
        if (historyEntry.x === tile.x && historyEntry.y === tile.y) return false;
      }
    }
    //todo also check the other way don't place the same stuff we just destroyed on the same spot again.
    // for this we will need to keep track of what we deleted in the history and do the check in canApply of the placement actions
    return true;
  },
};

/*https://apetersson.github.io/qnd/pmp/#eJxdlcluhDAMQCHOBgGGI+qp50pInZG6/f+P1YljY3Pzc5z4xU2ZvO3bW87DPhzhfcBolChj5Fo0SVQkWiRa+44V947H8D58wOt8ITqLYDEghorfDSOiuzBxMWFm/Gs4cTHhrFer5CiSFFU1d4BWc4fXas6qOe0SuZjVnFVzVq0Xs1rvy2quqw07iBpQN1YDOzWzGhhZDezUgLqxGlg1sFMDPbUVMXQ139U8Ru28r/OrNfe0gzBqrMP28g4CX+G73cggIIYLPaLTPQLNj3v0YuqRqPhtw8vQNv/8xGM2vI3l0psSV6donSI/AHKKx6idor5oQATtFC/j+n8SxSnenKjJ5RSVU51YlDeQrF3SOoAIF0bE1v/n/G1/9L5KmBEDY3VKN6d0m1O6OaX+DGDP/a16iUKPqkQmY5bINE+WUKv1A5LlA5L78UvPbXj5qRn71/n8RHbIg2JAHoWrTuOmQ1HVmazOZGcyXRN7oA4VB7wznvjAodwSxSaq7SSfu2bbvGfj6ZC98Z5p1J0j1/+czydyQh4VZ65vXDXnuyY1UJq0QzRXTLBcucmV21AtR2Rn5ApdRuSKkq9yRbeucrdEwQTYGRaZIUfjvvRXEClSAouZVkYG4fqmln7GjBG/KY5WWR32VX7a1p5zklskt1LuHybrkPc=*/

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

/** Returns true if this action is one that places a building (used to find follow-up). */
export function isBuildingPlacementAction(actionId: string): boolean {
  // Example: match "place-" or "add-" IDs, or check if perform(...) sets tile.building != NONE
  return (
    actionId.startsWith("place-") ||
    actionId.startsWith("add-")
  );
}