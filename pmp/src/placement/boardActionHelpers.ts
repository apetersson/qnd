// boardActionHelpers.ts

import { Board, Building, Terrain, TileData } from "../models/Board";
import { claimCityArea, extendCity, removeCityAssociation } from "./city";
import { ADVANCED_BUILDINGS } from "../models/buildingTypes";

// Example: one helper to handle "Set Terrain"
export function performSetTerrain(tile: TileData, newTerrain: Terrain, board: Board) {
  // Special logic about removing city associations if we lose a city tile
  const wasCity = tile.terrain === Terrain.City && tile.cityId;

  tile.terrain = newTerrain;
  if (newTerrain === Terrain.City) {
    // become city
    tile.cityId = `${tile.x}-${tile.y}`;
    // claim area
    const updated = claimCityArea(board, tile);
    board.tiles = updated.tiles;
  } else {
    // not a city
    tile.building = Building.None;
    if (wasCity) {
      // remove any city references
      const updated = removeCityAssociation(board, tile.cityId!);
      board.tiles = updated.tiles;
    }
  }
}

// For “Extend City”
export function performExtendCity(tile: TileData, board: Board) {
  if (tile.cityId) {
    const updated = extendCity(board, tile.cityId);
    board.tiles = updated.tiles;
  }
}

// Another example: “Set Building”
export function performSetBuilding(tile: TileData, newBuilding: Building, board: Board) {
  // Clear any old building
  tile.building = Building.None;

  // Possibly force terrain changes (like your code for Farm => FIELD).
  switch (newBuilding) {
    case Building.Farm:
      tile.terrain = Terrain.Field;
      break;
    case Building.LumberHut:
      tile.terrain = Terrain.Forest;
      break;
    case Building.Mine:
      tile.terrain = Terrain.Mountain;
      break;
  }

  // For advanced buildings, only allow one per city
  if (
    tile.cityId &&
    ADVANCED_BUILDINGS.includes(newBuilding)
  ) {
    const alreadyExists = board.tiles.some(
      (t) => t.cityId === tile.cityId && t.building === newBuilding
    );
    if (alreadyExists) {
      // do nothing, or revert
      return;
    }
  }

  tile.building = newBuilding;
}
