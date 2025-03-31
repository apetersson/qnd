// BoardGrid.tsx
import { TileData } from "../models/Board";
import { useBoardState } from "../contexts/BoardStateContext";
import StyledTile from "./StyledTile";
import { boardGridCommonStyle } from "./BoardGridStyles";

interface BoardGridProps {
  setHoveredTile: (tile: TileData | null) => void;
  setSelectedTile: (tile: TileData | null) => void;
  setMenuAnchor: (anchor: HTMLElement | null) => void;
  useImages: boolean;
}

export default function BoardGrid({
                                    setHoveredTile,
                                    setSelectedTile,
                                    setMenuAnchor,
                                    useImages,
                                  }: BoardGridProps) {
  const {board} = useBoardState();

  return (
    <div
      style={boardGridCommonStyle(board.width)}
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
          useImages={useImages}
        />
      ))}
    </div>
  );
}
