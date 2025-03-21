import React from "react";
import { Board, Building, Terrain, TileData } from "../models/Board";
import { getBuildingLevel, getMarketLevel } from "../placement/placement";
import { buildingKeys } from "../contexts/BoardActionsContext";
import { useBoardState } from "../contexts/BoardStateContext";

interface BoardGridProps {
  setHoveredTile: (tile: TileData | null) => void;
  setSelectedTile: (tile: TileData | null) => void;
  setMenuAnchor: (anchor: HTMLElement | null) => void;
}

export const terrainColors: Record<Terrain, string> = {
  [Terrain.None]: "#ffffff",
  [Terrain.Field]: "#fff9e6",
  [Terrain.Forest]: "#e8f5e9",
  [Terrain.Mountain]: "#f5f5f5",
  [Terrain.City]: "#8c63b3",
  [Terrain.Water]: "#00bfff",
};

export const buildingColors: Record<Building, string> = {
  [Building.None]: "transparent",
  [Building.Farm]: "#fff176",
  [Building.LumberHut]: "#81c784",
  [Building.Mine]: "#b0bec5",
  [Building.Sawmill]: "#388e3c",
  [Building.Windmill]: "#fdd835",
  [Building.Forge]: "#78909c",
  [Building.Market]: "#ff8a65",
  [Building.Monument]: "#8db6b4",
};

// Container style for the grid
const containerStyle: React.CSSProperties = {
  display: "grid",
  gap: 2,
  marginTop: 20,
};

// Base style for each tile (outer container)
const tileContainerStyle: React.CSSProperties = {
  width: 40,
  height: 40,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  userSelect: "none",
  fontSize: "0.7rem",
  textAlign: "center",
};

// Inner tile style for displaying content (e.g. building info)
const innerTileStyle: React.CSSProperties = {
  width: "90%",
  height: "60%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid #999",
};

function computeTileBorderStyle(tile: TileData, board: Board): React.CSSProperties {
  const topTile = board.tiles.find((t) => t.x === tile.x && t.y === tile.y - 1);
  const rightTile = board.tiles.find((t) => t.x === tile.x + 1 && t.y === tile.y);
  const bottomTile = board.tiles.find((t) => t.x === tile.x && t.y === tile.y + 1);
  const leftTile = board.tiles.find((t) => t.x === tile.x - 1 && t.y === tile.y);
  return {
    borderTop: topTile && topTile.cityId !== tile.cityId ? "1px solid red" : "1px solid #666",
    borderRight: rightTile && rightTile.cityId !== tile.cityId ? "1px solid red" : "1px solid #666",
    borderBottom: bottomTile && bottomTile.cityId !== tile.cityId ? "1px solid red" : "1px solid #666",
    borderLeft: leftTile && leftTile.cityId !== tile.cityId ? "1px solid red" : "1px solid #666",
  };
}

export default function BoardGrid({
                                    setHoveredTile,
                                    setSelectedTile,
                                    setMenuAnchor,
                                  }: BoardGridProps) {
  const {board} = useBoardState();
  const gridTemplateColumns = `repeat(${board.width}, 40px)`;

  return (
    <div
      style={{...containerStyle, gridTemplateColumns}}
      onMouseLeave={() => setHoveredTile(null)}
    >
      {board.tiles.map((tile) => {
        const baseColor = terrainColors[tile.terrain];
        const bldgColor = buildingColors[tile.building];
        const borderStyle = computeTileBorderStyle(tile, board);
        let displayText = "";
        if (tile.building !== Building.None) {
          if (tile.building === Building.Market) {
            displayText = getMarketLevel(tile, board).toString();
          } else if (
            [Building.Sawmill, Building.Windmill, Building.Forge].includes(tile.building)
          ) {
            displayText = `${buildingKeys[tile.building].toUpperCase()}${getBuildingLevel(
              tile,
              board
            )}`;
          } else {
            displayText = buildingKeys[tile.building].toUpperCase();
          }
        }
        return (
          <div
            key={`${tile.x}-${tile.y}`}
            style={{
              ...tileContainerStyle,
              ...borderStyle,
              backgroundColor: baseColor,
            }}
            onMouseEnter={() => setHoveredTile(tile)}
            onClick={(e) => {
              setSelectedTile(tile);
              setMenuAnchor(e.currentTarget);
            }}
          >
            <div
              style={{
                ...innerTileStyle,
                backgroundColor: bldgColor,
                border: bldgColor === "transparent" ? "none" : innerTileStyle.border,
              }}
            >
              {displayText}
            </div>
          </div>
        );
      })}
    </div>
  );
}
