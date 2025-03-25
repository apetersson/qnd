import React from "react";
import { TileData } from "../models/Board";
import { useBoardState } from "../contexts/BoardStateContext";
import StyledTile from "./StyledTile";

interface BoardGridProps {
  setHoveredTile: (tile: TileData | null) => void;
  setSelectedTile: (tile: TileData | null) => void;
  setMenuAnchor: (anchor: HTMLElement | null) => void;
}

// Container style for the grid
const containerStyle: React.CSSProperties = {
  display: "grid",
  gap: 2,
  marginTop: 20,
};

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
      {board.tiles.map((tile) => (
        <StyledTile
          key={`${tile.x}-${tile.y}`}
          tile={tile}
          board={board}
          onMouseEnter={(t) => setHoveredTile(t)}
          onClick={(e) => {
            setSelectedTile(tile);
            setMenuAnchor(e.currentTarget);
          }}
        />
      ))}
    </div>
  );
}
