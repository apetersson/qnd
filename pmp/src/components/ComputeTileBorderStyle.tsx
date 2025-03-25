import { Board, TileData } from "../models/Board";
import React from "react";

export function computeTileBorderStyle(tile: TileData, board: Board): React.CSSProperties {
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