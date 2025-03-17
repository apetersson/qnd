// ./components/BoardVisuals.tsx
import React from "react";
import { Board, TileData } from "../models/Board";
import Tile from "./Tile";

interface BoardVisualsProps {
  board: Board;
  onTileHover: (tile: TileData) => void;
  onTileClick: (tile: TileData, event: React.MouseEvent<HTMLDivElement>) => void;
  onMouseLeave: () => void;
}

const boardStyle: React.CSSProperties = {
  marginTop: 20,
  display: "grid",
  gap: "2px",
};

const BoardVisuals: React.FC<BoardVisualsProps> = ({
                                                     board,
                                                     onTileHover,
                                                     onTileClick,
                                                     onMouseLeave,
                                                   }) => {
  return (
    <div
      style={{ ...boardStyle, gridTemplateColumns: `repeat(${board.width}, 40px)` }}
      onMouseLeave={onMouseLeave}
    >
      {board.tiles.map((tile) => (
        <Tile
          key={`${tile.x}-${tile.y}`}
          tile={tile}
          board={board}
          onHover={onTileHover}
          onClick={onTileClick}
        />
      ))}
    </div>
  );
};

export default BoardVisuals;
