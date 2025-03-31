// BoardOverlay.tsx
import React from "react";
import { Board } from "../models/Board";
import StyledTile from "./StyledTile";
import { boardGridCommonStyle } from "./BoardGridStyles";

interface BoardOverlayProps {
  board: Board;
}

const BoardOverlay: React.FC<BoardOverlayProps> = ({board}) => {
  return (
    <div style={boardGridCommonStyle(board.width, false)}>
      {board.tiles.map((tile) => (
        <StyledTile
          key={`${tile.x}-${tile.y}`}
          tile={tile}
          board={board}
          onMouseEnter={() => {
          }}
          onClick={() => {
          }}
        />
      ))}
    </div>
  );
};

export default BoardOverlay;
