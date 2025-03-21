import React from "react";
import { Board, Building, Terrain, TileData } from "../models/Board";
import { getBuildingLevel, getMarketLevel } from "../placement/placement";

interface BoardGridProps {
  board: Board;
  boardStyle: React.CSSProperties;
  tileStyle: React.CSSProperties;
  getTerrainColor: (terrain: Terrain) => string;
  getBuildingColor: (building: Building) => string;
  computeTileBorderStyle: (tile: TileData, board: Board) => React.CSSProperties;
  setHoveredTile: (tile: TileData | null) => void;
  setSelectedTile: (tile: TileData | null) => void;
  setMenuAnchor: (anchor: HTMLElement | null) => void;
  buildingKeys: Record<Building, string>;
}

const BoardGrid: React.FC<BoardGridProps> = ({
                                               board,
                                               boardStyle,
                                               tileStyle,
                                               getTerrainColor,
                                               getBuildingColor,
                                               computeTileBorderStyle,
                                               setHoveredTile,
                                               setSelectedTile,
                                               setMenuAnchor,
                                               buildingKeys,
                                             }) => {
  return (
    <div
      style={{
        marginTop: 20,
        ...boardStyle,
        gridTemplateColumns: `repeat(${board.width}, 40px)`,
      }}
      onMouseLeave={() => setHoveredTile(null)}
    >
      {board.tiles.map((tile) => {
        // Determine the background color based on the tile's terrain.
        const baseColor = getTerrainColor(tile.terrain);
        // Determine the color for the building.
        const bldgColor = getBuildingColor(tile.building);
        // Compute border style based on neighboring tiles.
        const borderStyle = computeTileBorderStyle(tile, board);
        let displayText = "";
        if (tile.building !== Building.None) {
          if (tile.building === Building.Market) {
            displayText = getMarketLevel(tile, board).toString();
          } else if (
            [Building.Sawmill, Building.Windmill, Building.Forge].includes(
              tile.building
            )
          ) {
            displayText = `${buildingKeys[tile.building].toUpperCase()}${getBuildingLevel(
              tile,
              board
            )}`;
          } else {
            displayText = buildingKeys[tile.building].toUpperCase();
          }
        }
        return (
          <div
            key={`${tile.x}-${tile.y}`}
            style={{...tileStyle, ...borderStyle, backgroundColor: baseColor}}
            onMouseEnter={() => setHoveredTile(tile)}
            onClick={(e) => {
              setSelectedTile(tile);
              setMenuAnchor(e.currentTarget);
            }}
          >
            <div
              style={{
                width: "90%",
                height: "60%",
                backgroundColor: bldgColor,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: bldgColor === "transparent" ? "none" : "1px solid #999",
              }}
            >
              {displayText}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default BoardGrid;
