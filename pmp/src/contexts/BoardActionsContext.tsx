// Filename: ./contexts/BoardActionsContext.tsx

import React, { createContext, ReactNode, useContext } from "react";
import { Building, Terrain, TileData } from "../models/Board";
import { useBoardState } from "./BoardStateContext";
import { claimCityArea, extendCity, removeCityAssociation } from "../placement/city";
import { ADVANCED_BUILDINGS } from "../models/buildingTypes";

// For convenience, match the old "key -> terrain" or "key -> building" logic.
export const terrainKeyMap: Record<string, Terrain> = {
  n: Terrain.None,
  d: Terrain.Field,
  f: Terrain.Forest,
  h: Terrain.Mountain,
  c: Terrain.City,
  w: Terrain.Water,
};

export const buildingKeys: Record<Building, string> = {
  [Building.None]: "0",
  [Building.Farm]: "r",
  [Building.LumberHut]: "l",
  [Building.Mine]: "i",
  [Building.Sawmill]: "s",
  [Building.Windmill]: "p",
  [Building.Forge]: "o",
  [Building.Market]: "m",
};

export const buildingKeyMap: Record<string, Building> = Object.keys(buildingKeys).reduce(
  (acc, b) => {
    const bType = b as Building;
    const key = buildingKeys[bType];
    acc[key] = bType;
    return acc;
  },
  {} as Record<string, Building>
);

/** Defines the actions we can perform on the board. */
interface BoardActionsContextType {
  handleTileAction: (key: string, tile: TileData) => void;
}

const BoardActionsContext = createContext<BoardActionsContextType | undefined>(
  undefined
);

export const BoardActionsProvider: React.FC<{ children: ReactNode }> = ({
                                                                          children,
                                                                        }) => {
  const { board, setBoard } = useBoardState();

  /**
   * The same logic previously in `useBoardControls` for setting terrain, building,
   * city expansions, etc. Moved here so that any component can call it via context.
   */
  function handleTileAction(key: string, tile: TileData) {
    if (key.toLowerCase() === "e") {
      // Extend city
      if (tile.terrain === Terrain.City && tile.cityId) {
        setBoard((prev) => extendCity(prev, tile.cityId!));
      }
      return;
    }

    const lowerKey = key.toLowerCase();
    const terrainCandidate = terrainKeyMap[lowerKey];
    const buildingCandidate = buildingKeyMap[lowerKey];

    if (terrainCandidate !== undefined) {
      setBoard((prevBoard) => {
        const updated = prevBoard.tiles.map((t) => {
          if (t.x === tile.x && t.y === tile.y) {
            // Setting a new city?
            if (terrainCandidate === Terrain.City) {
              return {
                ...t,
                terrain: Terrain.City,
                cityId: `${t.x}-${t.y}`,
              };
            }
            return { ...t, terrain: terrainCandidate };
          }
          return t;
        });

        // If creating a city, claim its adjacent area
        if (terrainCandidate === Terrain.City) {
          const newBoard = { ...prevBoard, tiles: updated };
          return claimCityArea(newBoard, tile);
        } else {
          // If we removed a city tile, remove that city association
          if (tile.terrain === Terrain.City && tile.cityId) {
            const newBoard = { ...prevBoard, tiles: updated };
            return removeCityAssociation(newBoard, tile.cityId);
          }
        }
        return { ...prevBoard, tiles: updated };
      });
    } else if (buildingCandidate !== undefined) {
      // Setting a building by key
      setBoard((prevBoard) => ({
        ...prevBoard,
        tiles: prevBoard.tiles.map((t) => {
          if (t.x === tile.x && t.y === tile.y) {
            // "0" building means "None"
            if (buildingCandidate === Building.None) {
              return { ...t, building: Building.None };
            }
            // For advanced buildings, only allow one per city
            if (t.cityId && ADVANCED_BUILDINGS.includes(buildingCandidate)) {
              const alreadyExists = prevBoard.tiles.some(
                (tt) =>
                  tt.cityId === t.cityId && tt.building === buildingCandidate
              );
              if (alreadyExists) {
                return t; // do nothing if it already exists
              }
            }
            // Force certain terrain if placing a basic building
            let forcedTerrain = Terrain.None;
            if (buildingCandidate === Building.Farm) forcedTerrain = Terrain.Field;
            if (buildingCandidate === Building.LumberHut) forcedTerrain = Terrain.Forest;
            if (buildingCandidate === Building.Mine) forcedTerrain = Terrain.Mountain;

            return {
              ...t,
              terrain: forcedTerrain !== Terrain.None ? forcedTerrain : t.terrain,
              building: buildingCandidate,
            };
          }
          return t;
        }),
      }));
    }
  }

  return (
    <BoardActionsContext.Provider value={{ handleTileAction }}>
      {children}
    </BoardActionsContext.Provider>
  );
};

/** Hook to access board actions. */
export function useBoardActions(): BoardActionsContextType {
  const context = useContext(BoardActionsContext);
  if (!context) {
    throw new Error("useBoardActions must be used within a BoardActionsProvider");
  }
  return context;
}
