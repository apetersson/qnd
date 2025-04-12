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
import SolutionList from "./SolutionList";
import BoardOverlay from "./BoardOverlay";
import { useOptimizationContext } from "../contexts/OptimizationContext";
import { useBoardState } from "../contexts/BoardStateContext";
import { ImageViewToggle } from "./ImageViewToggle";
import { Solution } from "../models/Solution";

export default function PolytopiaMarketPlanner() {
  const [hoveredTile, setHoveredTile] = useState<TileData | null>(null);
  const [selectedTile, setSelectedTile] = useState<TileData | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  // New state for selected optimisation
  const [selectedSolution, setSelectedSolution] = useState<Solution | null>(null);

  const {solutionList} = useOptimizationContext();
  const {setBoard} = useBoardState();
  const {handleTileAction} = useBoardActions();
  const [useImages, setUseImages] = useState(false);

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
      <a style={{color: "black", textDecoration: "none"}} target={"_blank"}
         href={"https://discord.com/channels/283436219780825088/368485048493539329/1359533536717045821"} rel="noreferrer"><h3>very cool
        but kinda cheating &rarr;</h3></a>


      <BoardSizeSelector/>
      <BoardExporter/>
      <CityManagementPanel/>
      <ShortcutsInfo/>
      <OptimizationControls/>
      <SolutionList
        solutions={solutionList}
        selectedSolution={selectedSolution}
        onSolutionSelect={(solutionOrNull: Solution | null) =>
          setSelectedSolution(
            selectedSolution &&
            solutionOrNull &&
            selectedSolution.iteration === solutionOrNull.iteration
              ? null
              : solutionOrNull
          )
        }
      />

      {/* Apply Button */}
      {/*
  Always reserve space for the "Apply to Board" button by wrapping it in a container with a fixed height.
*/}
      <div style={{minHeight: "25px", marginTop: "10px"}}>
        {selectedSolution && (
          <button
            onClick={() => {
              setBoard(selectedSolution.boardSnapshot);
              setSelectedSolution(null);
            }}
          >
            Apply to Board
          </button>
        )}
      </div>


      {/* Board / Overlay */}
      <div style={{display: "flex", position: "relative"}}>
        <div style={{position: "relative"}}>
          {!selectedSolution ? (
            <BoardGrid
              setHoveredTile={setHoveredTile}
              setSelectedTile={setSelectedTile}
              setMenuAnchor={setMenuAnchor}
              useImages={useImages}
            />
          ) : (
            <BoardOverlay board={selectedSolution.boardSnapshot} useImages={useImages}/>
          )}
        </div>
        <div style={{marginLeft: 20}}>
          <textarea
            readOnly
            value={selectedSolution ? selectedSolution.history.map(value => value.description).join("\n") : ""}
            style={{width: 300, height: 400}}
          />
        </div>
      </div>

      <ImageViewToggle checked={useImages} onChange={(e) => setUseImages(e.target.checked)}/>
      {selectedTile && <MouseOptions
        anchorEl={menuAnchor}
        onClose={() => setMenuAnchor(null)}
        selectedTile={selectedTile}
      />}

    </div>
  );
}
