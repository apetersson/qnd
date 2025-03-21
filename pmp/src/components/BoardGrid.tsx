import React from "react";
import { Board, Building, Terrain, TileData } from "../models/Board";
import { getBuildingLevel, getMarketLevel } from "../placement/placement";

interface BoardGridProps {
  board: Board;
  boardStyle: React.CSSProperties;
  tileStyle: React.CSSProperties;
  setHoveredTile: (tile: TileData | null) => void;
  setSelectedTile: (tile: TileData | null) => void;
  setMenuAnchor: (anchor: HTMLElement | null) => void;
  buildingKeys: Record<Building, string>;
}


function computeTileBorderStyle(tile: TileData, board: Board): React.CSSProperties {
  const topTile = board.tiles.find(t => t.x === tile.x && t.y === tile.y - 1);
  const rightTile = board.tiles.find(t => t.x === tile.x + 1 && t.y === tile.y);
  const bottomTile = board.tiles.find(t => t.x === tile.x && t.y === tile.y + 1);
  const leftTile = board.tiles.find(t => t.x === tile.x - 1 && t.y === tile.y);
  const borderTop = topTile && topTile.cityId !== tile.cityId ? "1px solid red" : "1px solid #666";
  const borderRight = rightTile && rightTile.cityId !== tile.cityId ? "1px solid red" : "1px solid #666";
  const borderBottom = bottomTile && bottomTile.cityId !== tile.cityId ? "1px solid red" : "1px solid #666";
  const borderLeft = leftTile && leftTile.cityId !== tile.cityId ? "1px solid red" : "1px solid #666";
  return {borderTop, borderRight, borderBottom, borderLeft};
}

const getTerrainColor = (t: Terrain) => {
  switch (t) {
    case Terrain.Field:
      return "#fff9e6";
    case Terrain.Forest:
      return "#e8f5e9";
    case Terrain.Mountain:
      return "#f5f5f5";
    case Terrain.City:
      return "#8c63b3";
    case Terrain.Water:
      return "#00bfff";
    default:
      return "#ffffff";
  }
};
const getBuildingColor = (b: Building) => {
  switch (b) {
    case Building.Farm:
      return "#fff176";
    case Building.Windmill:
      return "#fdd835";
    case Building.LumberHut:
      return "#81c784";
    case Building.Sawmill:
      return "#388e3c";
    case Building.Mine:
      return "#b0bec5";
    case Building.Forge:
      return "#78909c";
    case Building.Market:
      return "#ff8a65";
    default:
      return "transparent";
  }
}


const BoardGrid: React.FC<BoardGridProps> = ({
                                               board,
                                               boardStyle,
                                               tileStyle,
                                               setHoveredTile,
                                               setSelectedTile,
                                               setMenuAnchor,
                                               buildingKeys,
                                             }) => {
  return (
    <div
      style={{
        marginTop: 20,
        ...boardStyle,
        gridTemplateColumns: `repeat(${board.width}, 40px)`,
      }}
      onMouseLeave={() => setHoveredTile(null)}
    >
      {board.tiles.map((tile) => {
        // Determine the background color based on the tile's terrain.
        const baseColor = getTerrainColor(tile.terrain);
        // Determine the color for the building.
        const bldgColor = getBuildingColor(tile.building);
        // Compute border style based on neighboring tiles.
        const borderStyle = computeTileBorderStyle(tile, board);
        let displayText = "";
        if (tile.building !== Building.None) {
          if (tile.building === Building.Market) {
            displayText = getMarketLevel(tile, board).toString();
          } else if (
            [Building.Sawmill, Building.Windmill, Building.Forge].includes(
              tile.building
            )
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
            style={{...tileStyle, ...borderStyle, backgroundColor: baseColor}}
            onMouseEnter={() => setHoveredTile(tile)}
            onClick={(e) => {
              setSelectedTile(tile);
              setMenuAnchor(e.currentTarget);
            }}
          >
            <div
              style={{
                width: "90%",
                height: "60%",
                backgroundColor: bldgColor,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: bldgColor === "transparent" ? "none" : "1px solid #999",
              }}
            >
              {displayText}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default BoardGrid;
