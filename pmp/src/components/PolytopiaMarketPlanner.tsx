// Filename: ./components/PolytopiaMarketPlanner.tsx

import { useEffect, useState } from "react";
import BoardGrid from "./BoardGrid";
import { MouseOptions } from "./MouseOptions";
import { TileData } from "../models/Board";
import { useBoardActions, } from "../contexts/BoardActionsContext";
import BoardExporter from "./BoardExporter";
import CityManagementPanel from "./CityManagementPanel";
import BoardSizeSelector from "./BoardSizeSelector";
import OptimizationControls from "./OptimizationControls";
import ShortcutsInfo from "./ShortcutsInfo";
import SolutionList, { Solution } from "./SolutionList";
import BoardOverlay from "./BoardOverlay";
import { useOptimizationContext } from "../contexts/OptimizationContext";

export default function PolytopiaMarketPlanner() {
  const [hoveredTile, setHoveredTile] = useState<TileData | null>(null);
  const [selectedTile, setSelectedTile] = useState<TileData | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  // New state for solution overlay
  const [solutionOverlay, setSolutionOverlay] = useState<Solution | null>(null);

  // Assume solutionList comes from your optimization context:
  const {solutionList} = useOptimizationContext();

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

      <BoardSizeSelector/>
      <BoardExporter/>
      <CityManagementPanel/>
      <ShortcutsInfo/>
      <OptimizationControls/>
      <SolutionList
        solutions={solutionList}
        onSolutionSelect={(solutionOrNull: Solution | null) => {
          setSolutionOverlay(solutionOrNull);
          //
          // // Toggle selection: if clicking the already-selected solution, deselect it.
          // if (solutionOverlay && solutionOrNull && solutionOverlay.iteration === solutionOrNull.iteration) {
          //   setSolutionOverlay(null);
          // } else {
          //   setSolutionOverlay(solutionOrNull);
          // }
        }}
      />


      {/* Wrap board and overlay in a relatively positioned container */}
      <div style={{display: "flex", position: "relative"}}>
        <div style={{position: "relative"}}>
          {!solutionOverlay && <BoardGrid
              setHoveredTile={setHoveredTile}
              setSelectedTile={setSelectedTile}
              setMenuAnchor={setMenuAnchor}
          />}
          {/* Render the overlay if a solution is selected or hovered */}
          {solutionOverlay && <BoardOverlay board={solutionOverlay.boardSnapshot}/>}
        </div>
        {/* Right side: display the optimisation history */}
        <div style={{marginLeft: 20}}>
          <textarea
            readOnly
            value={solutionOverlay ? solutionOverlay.history.join("\n") : ""}
            style={{width: 300, height: 400}}
          />
        </div>
      </div>

      {/* Popup menu for tile actions */}
      <MouseOptions
        anchorEl={menuAnchor}
        onClose={() => setMenuAnchor(null)}
        selectedTile={selectedTile}
      />

    </div>
  );
}
