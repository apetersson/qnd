// Filename: ./components/MouseOptions.tsx
import React from "react";
import { Menu, MenuItem } from "@mui/material";
import { buildingKeyMap, terrainKeyMap } from "../contexts/BoardActionsContext";
import { Terrain, TileData } from "../models/Board";
import { useBoardActions } from "../contexts/BoardActionsContext";

interface MouseOptionsProps {
  anchorEl: HTMLElement | null;
  onClose: () => void;
  selectedTile: TileData | null;
}

export function MouseOptions({ anchorEl, onClose, selectedTile }: MouseOptionsProps) {
  const { handleTileAction } = useBoardActions();

  // Base actions for terrain and buildings
  const dynamicPopupActions = [
    ...Object.entries(terrainKeyMap).map(([key, terrain]) => ({
      key,
      label: `Set Terrain: ${terrain}`,
    })),
    ...Object.entries(buildingKeyMap).map(([key, building]) => ({
      key,
      label: `Set Building: ${building}`,
    })),
  ];

  // Add Extend City option if selected tile is a city
  if (selectedTile?.terrain === Terrain.City && selectedTile.cityId) {
    dynamicPopupActions.push({
      key: "e",
      label: "Extend City",
    });
  }

  return (
    <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={onClose}>
      {dynamicPopupActions.map((action) => (
        <MenuItem
          key={action.key}
          onClick={() => {
            if (selectedTile) handleTileAction(action.key, selectedTile);
            onClose();
          }}
        >
          {action.label}
        </MenuItem>
      ))}
    </Menu>
  );
}