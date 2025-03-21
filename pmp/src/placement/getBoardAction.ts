// getBoardAction.ts
import { Board, Terrain, TileData } from "../models/Board";
import { buildingKeyMap, terrainKeyMap } from "../contexts/BoardActionsContext";
import { performExtendCity, performSetBuilding, performSetTerrain } from "./boardActionHelpers";
import { BoardAction } from "./BoardAction";
import { ADVANCED_BUILDINGS } from "../models/buildingTypes";

export function getBoardAction(
  key: string,
  tile: TileData,
  board: Board
): BoardAction | null {
  const lowerKey = key.toLowerCase();

  // 1) Check for "extend city"
  if (lowerKey === "e") {
    // can apply?
    if (tile.terrain === Terrain.City && tile.cityId) {
      return {
        key: "e",
        label: "Extend City",
        perform: (boardRef) => {
          // find the same tile in boardRef
          const updatedTile = boardRef.tiles.find((t) => t.x === tile.x && t.y === tile.y);
          if (updatedTile) {
            performExtendCity(updatedTile, boardRef);
          }
        },
      };
    }
    // not applicable
    return null;
  }

  // 2) Check if it’s a terrain key
  if (terrainKeyMap[lowerKey] !== undefined) {
    const newTerrain = terrainKeyMap[lowerKey];
    // canApply? If you have more specific rules, do them here
    // e.g. "can't set terrain to City if there's already a building"
    // or "can't set city if tile is water" etc.
    // We'll do a trivial "always okay" except removing building if new terrain != City
    return {
      key: lowerKey,
      label: `Set terrain: ${newTerrain}`,
      perform: (boardRef) => {
        const updatedTile = boardRef.tiles.find((t) => t.x === tile.x && t.y === tile.y);
        if (!updatedTile) return;
        performSetTerrain(updatedTile, newTerrain, boardRef);
      },
    };
  }

  // 3) Check if it’s a building key
  if (buildingKeyMap[lowerKey] !== undefined) {
    const newBldg = buildingKeyMap[lowerKey];
    // canApply? For example, skip if tile.terrain === City, etc.
    if (tile.terrain === Terrain.City) {
      return null;
    }
    // If it's an advanced building, check if this city already has that building
    if (ADVANCED_BUILDINGS.includes(newBldg) && tile.cityId) {
      const alreadyExists = board.tiles.some(
        (t) => t.cityId === tile.cityId && t.building === newBldg
      );
      if (alreadyExists) {
        return null;
      }
    }
    return {
      key: lowerKey,
      label: `Set building: ${newBldg}`,
      perform: (boardRef) => {
        const updatedTile = boardRef.tiles.find((t) => t.x === tile.x && t.y === tile.y);
        if (!updatedTile) return;
        performSetBuilding(updatedTile, newBldg, boardRef);
      },
    };
  }

  // 4) If none of the above matched:
  return null;
}
