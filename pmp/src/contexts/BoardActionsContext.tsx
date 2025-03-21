// Filename: ./contexts/BoardActionsContext.tsx

import React, { createContext, ReactNode, useContext } from "react";
import { Building, Terrain, TileData } from "../models/Board";
import { useBoardState } from "./BoardStateContext";
import { getBoardAction } from "../placement/getBoardAction";

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
  [Building.Monument]: "u",
  [Building.None]: "0",
  [Building.Farm]: "r",
  [Building.LumberHut]: "l",
  [Building.Mine]: "i",
  [Building.Sawmill]: "s",
  [Building.Windmill]: "p",
  [Building.Forge]: "o",
  [Building.Market]: "m"
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

interface BoardActionsContextType {
  handleTileAction: (key: string, tile: TileData) => void;
}

const BoardActionsContext = createContext<BoardActionsContextType | undefined>(
  undefined
);

export const BoardActionsProvider: React.FC<{ children: ReactNode }> = ({children}) => {
  const {board, setBoard} = useBoardState();

  function handleTileAction(key: string, tile: TileData) {
    const action = getBoardAction(key, tile, board);
    if (!action) return; // not valid => do nothing

    setBoard((oldBoard) => {
      // clone
      const newBoard = {
        ...oldBoard,
        tiles: oldBoard.tiles.map((t) => ({...t})),
      };
      // perform
      action.perform(newBoard);
      return newBoard;
    });
  }

  return (
    <BoardActionsContext.Provider value={{handleTileAction}}>
      {children}
    </BoardActionsContext.Provider>
  );
};

export function useBoardActions(): BoardActionsContextType {
  const context = useContext(BoardActionsContext);
  if (!context) {
    throw new Error("useBoardActions must be used within a BoardActionsProvider");
  }
  return context;
}