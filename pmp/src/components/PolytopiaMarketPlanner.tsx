// Filename: ./components/PolytopiaMarketPlanner.tsx

import React, { useEffect, useState } from "react";
import { MenuItem } from "@mui/material";
import BoardGrid from "./BoardGrid";
import { MouseOptions } from "./MouseOptions";
import { TileData } from "../models/Board";
import { useBoardActions } from "../contexts/BoardActionsContext";
import BoardExporter from "./BoardExporter";
import CityManagementPanel from "./CityManagementPanel";
import BoardSizeSelector from "./BoardSizeSelector";
import OptimizationControls from "./OptimizationControls";

export default function PolytopiaMarketPlanner() {
  // Hover and selection for the “right-click” or menu usage
  const [hoveredTile, setHoveredTile] = useState<TileData | null>(null);
  const [selectedTile, setSelectedTile] = useState<TileData | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  // The board actions from BoardActionsContext
  const {handleTileAction} = useBoardActions();

  // Optionally, we can allow hotkeys for placing buildings:
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (hoveredTile) {
        handleTileAction(e.key, hoveredTile);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hoveredTile, handleTileAction]);

  return (
    <div style={{margin: 20}}>
      <h1>Polytopia Market Planner</h1>

      {/* Smaller sub-components that were previously all in BoardControls */}
      <BoardSizeSelector/>
      <BoardExporter/>
      <CityManagementPanel/>
      <OptimizationControls/>

      {/* The grid itself */}
      <BoardGrid
        boardStyle={{display: "grid", gap: 2, marginTop: 20}}
        tileStyle={{
          width: 40,
          height: 40,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          userSelect: "none",
          fontSize: "0.7rem",
          textAlign: "center",
        }}
        {...{
          setHoveredTile,
          setSelectedTile,
          setMenuAnchor,
        }}
      />

      {/* Popup menu for placing terrain/buildings via a click menu */}
      <MouseOptions
        anchorEl={menuAnchor}
        onClose={() => setMenuAnchor(null)}
        callbackfn={(action) => (
          <MenuItem
            key={action.key}
            onClick={() => {
              if (selectedTile) handleTileAction(action.key, selectedTile);
              setMenuAnchor(null);
            }}
          >
            {action.label}
          </MenuItem>
        )}
      />
    </div>
  );
}
