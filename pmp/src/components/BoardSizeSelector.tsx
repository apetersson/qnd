import React from "react";
import { useBoardState } from "../contexts/BoardStateContext";
import { gridSizes } from "../models/sizes";
import { createInitialBoard } from "../models/Board";

const BoardSizeSelector: React.FC = () => {
  const {board, setBoard} = useBoardState();

  // Compute the current index based on the board dimensions.
  const matchIndex = gridSizes.findIndex(
    (sz) => sz.width === board.width && sz.height === board.height
  );
  const currentIndex = matchIndex >= 0 ? matchIndex : 0;

  const handleSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const idx = Number(e.target.value);
    const {width, height} = gridSizes[idx]!;
    setBoard(createInitialBoard(width, height));
  };

  return (
    <div style={{marginBottom: 12}}>
      <strong>Grid Size:</strong>
      <select onChange={handleSizeChange} value={currentIndex} style={{marginLeft: 8}}>
        {gridSizes.map((sz, i) => (
          <option key={i} value={i}>
            {sz.label}
          </option>
        ))}
      </select>
      <p>
        Current Board: {`${board.width}x${board.height}`} with {board.width * board.height} tiles
      </p>
    </div>
  );
};

export default BoardSizeSelector;
