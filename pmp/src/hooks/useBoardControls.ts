// Filename: ./hooks/useBoardControls.ts
import { useEffect } from "react";
import { useBoardState } from "../contexts/BoardContext";
import { TileData, Terrain, Building } from "../models/Board";
import { claimCityArea, extendCity, removeCityAssociation } from "../placement/city";
import { ADVANCED_BUILDINGS } from "../models/buildingTypes";

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

export const buildingKeyMap: Record<string, Building> = Object.keys(buildingKeys).reduce((acc, b) => {
  const bType = b as Building;
  const key = buildingKeys[bType];
  acc[key] = bType;
  return acc;
}, {} as Record<string, Building>);

export function useBoardControls(hoveredTile: TileData | null) {
  const { board, setBoard } = useBoardState();

  const handleTileAction = (key: string, tile: TileData) => {
    if (key.toLowerCase() === "e") {
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
            if (terrainCandidate === Terrain.City) {
              return { ...t, terrain: Terrain.City, cityId: `${t.x}-${t.y}` };
            }
            return { ...t, terrain: terrainCandidate };
          }
          return t;
        });

        if (terrainCandidate === Terrain.City) {
          const cityTile = prevBoard.tiles.find((t) => t.x === tile.x && t.y === tile.y);
          if (cityTile) {
            return claimCityArea({ ...prevBoard, tiles: updated }, cityTile);
          }
        } else {
          if (tile.terrain === Terrain.City && tile.cityId) {
            return removeCityAssociation({ ...prevBoard, tiles: updated }, tile.cityId);
          }
        }
        return { ...prevBoard, tiles: updated };
      });
    } else if (buildingCandidate !== undefined) {
      setBoard((prevBoard) => ({
        ...prevBoard,
        tiles: prevBoard.tiles.map((t) => {
          if (t.x === tile.x && t.y === tile.y) {
            if (buildingCandidate === Building.None) return { ...t, building: Building.None };
            if (t.cityId && ADVANCED_BUILDINGS.includes(buildingCandidate)) {
              const alreadyExists = prevBoard.tiles.some(
                (tile2) => tile2.cityId === t.cityId && tile2.building === buildingCandidate
              );
              if (alreadyExists) return t;
            }
            const forcedTerrain =
              buildingCandidate === Building.Farm
                ? Terrain.Field
                : buildingCandidate === Building.LumberHut
                  ? Terrain.Forest
                  : buildingCandidate === Building.Mine
                    ? Terrain.Mountain
                    : Terrain.None;
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
  };

  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (hoveredTile) handleTileAction(e.key, hoveredTile);
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [hoveredTile, board]);

  return { handleTileAction, buildingKeyMap };
}