import React from "react";
import { Board, Building, Terrain, TileData } from "../models/Board";
import { getBuildingLevel, getMarketLevel } from "../placement/placement";
import { buildingKeys } from "../contexts/BoardActionsContext";
import { computeTileBorderStyle } from "./ComputeTileBorderStyle";

// Image imports
import cityImg from "./images/city.webp";
import farmImg from "./images/farm.webp";
import forgeImg from "./images/forge.webp";
import lumberHutImg from "./images/lumber_hut.webp";
import marketImg from "./images/market.webp";
import mineImg from "./images/mine.webp";
import sawmillImg from "./images/sawmill.webp";
import windmillImg from "./images/windmill.webp";
import { useOptimizationContext } from "../contexts/OptimizationContext";

export const terrainColors: Record<Terrain, string> = {
  [Terrain.None]: "#ffffff",
  [Terrain.Field]: "#fff9e6",
  [Terrain.Forest]: "#e8f5e9",
  [Terrain.Mountain]: "#f5f5f5",
  [Terrain.City]: "#bc99dd",
  [Terrain.Water]: "#00bfff",
};

export const buildingColors: Record<Building, string> = {
  [Building.None]: "transparent",
  [Building.Farm]: "#fff176",
  [Building.LumberHut]: "#81c784",
  [Building.Mine]: "#b0bec5",
  [Building.Sawmill]: "#388e3c",
  [Building.Windmill]: "#fdd835",
  [Building.Forge]: "#78909c",
  [Building.Market]: "#ff8a65",
  [Building.Monument]: "#8db6b4",
};

interface StyledTileProps {
  tile: TileData;
  board: Board;
  onMouseEnter: (tile: TileData) => void;
  onClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  useImages: boolean;
}

// Simple helper to lighten a hex color by a given percentage.
function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.slice(1), 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  const newR = Math.min(255, Math.floor(r + (255 - r) * (percent / 100)));
  const newG = Math.min(255, Math.floor(g + (255 - g) * (percent / 100)));
  const newB = Math.min(255, Math.floor(b + (255 - b) * (percent / 100)));
  return `#${((1 << 24) + (newR << 16) + (newG << 8) + newB)
    .toString(16)
    .slice(1)}`;
}

const tileContainerStyle: React.CSSProperties = {
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
};

const StyledTile: React.FC<StyledTileProps> = ({tile, board, onMouseEnter, onClick, useImages}) => {
  const {cityToggles} = useOptimizationContext();

  // Determine base color; if it's a city and its toggle is off, use a lighter color.
  let baseColor = terrainColors[tile.terrain];
  if (tile.terrain === Terrain.City && tile.cityId && !cityToggles[tile.cityId]) {
    baseColor = lightenColor(baseColor, 70); // Lighten by 30%
  }

  const bldgColor = buildingColors[tile.building];
  const borderStyle = computeTileBorderStyle(tile, board);

  let displayText = "";
  if (tile.building !== Building.None) {
    if (tile.building === Building.Market) {
      displayText = getMarketLevel(tile, board).toString();
    } else if ([Building.Sawmill, Building.Windmill, Building.Forge].includes(tile.building)) {
      displayText = `${buildingKeys[tile.building].toUpperCase()}${getBuildingLevel(tile, board)}`;
    } else {
      displayText = buildingKeys[tile.building].toUpperCase();
    }
  } else if (tile.terrain === Terrain.City && tile.cityId !== undefined) {
    displayText = `${tile.cityId}`;
  }


  const buildingImageMap: Record<Building, string | null> = {
    [Building.None]: null,
    [Building.Farm]: farmImg,
    [Building.LumberHut]: lumberHutImg,
    [Building.Mine]: mineImg,
    [Building.Sawmill]: sawmillImg,
    [Building.Windmill]: windmillImg,
    [Building.Forge]: forgeImg,
    [Building.Market]: marketImg,
    [Building.Monument]: null,
  };

  const buildingImg = buildingImageMap[tile.building];

// Special terrain-level override: show city image even if no building
  const isCityTile = tile.terrain === Terrain.City;
  const cityImageOverride = isCityTile && tile.building === Building.None;

// NEW: Only compute finalImage if useImages is enabled
  const finalImage = useImages
    ? buildingImg || (cityImageOverride ? cityImg : null)
    : null;

  const useImage = !!finalImage;

  // Determine style dimensions dynamically
  const innerTileDynamicStyle: React.CSSProperties = {
    width: useImage ? "100%" : "90%",
    height: useImage ? "100%" : "60%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: !useImage && bldgColor !== "transparent" ? "1px solid #999" : "none",
    backgroundColor: useImage ? "transparent" : bldgColor,
    overflow: "hidden",
    position: "relative",
  };

  return (
    <div
      style={{
        ...tileContainerStyle,
        ...borderStyle,
        backgroundColor: baseColor,
      }}
      onMouseEnter={() => onMouseEnter(tile)}
      onClick={onClick}
    >
      <div style={innerTileDynamicStyle}>
        {finalImage ? (
          <img
            src={finalImage}
            alt={tile.building !== Building.None ? tile.building : tile.terrain}
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
              pointerEvents: "none",
            }}
          />
        ) : (
          displayText
        )}
      </div>
    </div>
  );
};

export default StyledTile;
