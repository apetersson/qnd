// ./components/Tile.tsx
import React from "react";
import { TileData, Board, Building } from "../models/Board";
import { getMarketLevel, getBuildingLevel } from "../placement/placement";

// Inline-Stile – du kannst diese später in ein .module.scss auslagern
const tileStyle: React.CSSProperties = {
  width: "40px",
  height: "40px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  userSelect: "none",
  fontSize: "0.7rem",
  textAlign: "center",
};

const getTerrainColor = (terrain: string): string => {
  switch (terrain) {
    case "FIELD":
      return "#fff9e6";
    case "FOREST":
      return "#e8f5e9";
    case "MOUNTAIN":
      return "#f5f5f5";
    case "CITY":
      return "#8c63b3";
    case "WATER":
      return "#00bfff";
    default:
      return "#ffffff";
  }
};

const getBuildingColor = (building: string): string => {
  switch (building) {
    case "FARM":
      return "#fff176";
    case "WINDMILL":
      return "#fdd835";
    case "LUMBER_HUT":
      return "#81c784";
    case "SAWMILL":
      return "#388e3c";
    case "MINE":
      return "#b0bec5";
    case "FORGE":
      return "#78909c";
    case "MARKET":
      return "#ff8a65";
    default:
      return "transparent";
  }
};

const computeTileBorderStyle = (tile: TileData, board: Board): React.CSSProperties => {
  const topTile = board.tiles.find((t) => t.x === tile.x && t.y === tile.y - 1);
  const rightTile = board.tiles.find((t) => t.x === tile.x + 1 && t.y === tile.y);
  const bottomTile = board.tiles.find((t) => t.x === tile.x && t.y === tile.y + 1);
  const leftTile = board.tiles.find((t) => t.x === tile.x - 1 && t.y === tile.y);
  const borderTop = topTile && topTile.cityId !== tile.cityId ? "1px solid red" : "1px solid #666";
  const borderRight = rightTile && rightTile.cityId !== tile.cityId ? "1px solid red" : "1px solid #666";
  const borderBottom = bottomTile && bottomTile.cityId !== tile.cityId ? "1px solid red" : "1px solid #666";
  const borderLeft = leftTile && leftTile.cityId !== tile.cityId ? "1px solid red" : "1px solid #666";
  return { borderTop, borderRight, borderBottom, borderLeft };
};

const buildingKeys: Record<Building, string> = {
  NONE: "0",
  FARM: "r",
  LUMBER_HUT: "l",
  MINE: "i",
  SAWMILL: "s",
  WINDMILL: "p",
  FORGE: "o",
  MARKET: "m",
};

interface TileProps {
  tile: TileData;
  board: Board;
  onHover: (tile: TileData) => void;
  onClick: (tile: TileData, event: React.MouseEvent<HTMLDivElement>) => void;
}

const Tile: React.FC<TileProps> = ({ tile, board, onHover, onClick }) => {
  const baseColor = getTerrainColor(tile.terrain);
  const bldgColor = getBuildingColor(tile.building);
  const borderStyle = computeTileBorderStyle(tile, board);

  let displayText = "";
  if (tile.building !== "NONE") {
    if (tile.building === "MARKET") {
      displayText = getMarketLevel(tile, board).toString();
    } else if (
      [ "SAWMILL", "WINDMILL", "FORGE" ].includes(tile.building)
    ) {
      displayText = `${buildingKeys[tile.building].toUpperCase()}${getBuildingLevel(tile, board)}`;
    } else {
      displayText = buildingKeys[tile.building].toUpperCase();
    }
  }

  return (
    <div
      style={{ ...tileStyle, ...borderStyle, backgroundColor: baseColor }}
      onMouseEnter={() => onHover(tile)}
      onClick={(e) => onClick(tile, e)}
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
};

export default Tile;
