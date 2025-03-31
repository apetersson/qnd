import React, { useState } from "react";
import { useBoardState } from "../contexts/BoardStateContext";
import { exportBoardState, importBoardState } from "../utils/boardExport";

const BoardExporter: React.FC = () => {
  const { board, setBoard } = useBoardState();
  const [configText, setConfigText] = useState("");

  const handleExportClick = () => {
    const exportData = exportBoardState(board);
    setConfigText(exportData);
  };

  const handleApplyClick = () => {
    try {
      const newBoard = importBoardState(configText);
      setBoard(newBoard);
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