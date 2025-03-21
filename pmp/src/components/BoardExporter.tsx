import React, { useState } from "react";
import { useBoardState } from "../contexts/BoardStateContext";
import { Building, createInitialBoard, Terrain, TileData } from "../models/Board";

const BoardExporter: React.FC = () => {
  const { board, setBoard } = useBoardState();
  const [configText, setConfigText] = useState("");

  const handleExportClick = () => {
    // Only export non-empty tiles to reduce clutter
    const exportData = {
      width: board.width,
      height: board.height,
      tiles: board.tiles.filter(
        (t) => t.terrain !== Terrain.None || t.building !== Building.None || t.cityId
      ),
    };
    setConfigText(JSON.stringify(exportData, null, 2));
  };

  const handleApplyClick = () => {
    try {
      const parsed = JSON.parse(configText);
      if (parsed?.width && parsed?.height && Array.isArray(parsed.tiles)) {
        const newBoard = createInitialBoard(parsed.width, parsed.height);
        parsed.tiles.forEach((t: TileData) => {
          const idx = newBoard.tiles.findIndex((bt) => bt.x === t.x && bt.y === t.y);
          if (idx > -1) newBoard.tiles[idx] = { ...newBoard.tiles[idx], ...t };
        });
        setBoard(newBoard);
      }
    } catch (err) {
      alert("Invalid board configuration JSON.");
      console.error(err);
    }
  };

  return (
    <div style={{ marginBottom: 12 }}>
      <button onClick={handleExportClick}>Export Data</button>
      <button onClick={handleApplyClick} style={{ marginLeft: 8 }}>
        Load Data
      </button>

      <p style={{ marginTop: 8, marginBottom: 4 }}>Board JSON:</p>
      <textarea
        style={{ width: "100%", height: "150px" }}
        value={configText}
        onChange={(e) => setConfigText(e.target.value)}
      />
    </div>
  );
};

export default BoardExporter;
