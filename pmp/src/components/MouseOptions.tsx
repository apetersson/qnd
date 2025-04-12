// src/components/MouseOptions.tsx
import React from "react";
import { Menu, MenuItem } from "@mui/material";
import { buildingKeyMap, terrainKeyMap, useBoardActions } from "../contexts/BoardActionsContext";
import { useBoardState } from "../contexts/BoardStateContext";
import { getBoardAction } from "../placement/getBoardAction";
import { useOptimizationContext } from "../contexts/OptimizationContext";
import { Terrain, TileData } from "../models/Board";
import { BoardAction } from "../placement/BoardAction";

interface MouseOptionsProps {
  anchorEl: HTMLElement | null;
  onClose: () => void;
  selectedTile: TileData;
}

export function MouseOptions({anchorEl, onClose, selectedTile}: MouseOptionsProps) {
  const {handleTileAction} = useBoardActions();
  const {board} = useBoardState();
  const {cityToggles, setCityToggles} = useOptimizationContext();

  // Build a set of keys for terrain, building and special commands (e.g. "e" for extend city)
  const allKeys = new Set<string>();
  Object.keys(terrainKeyMap).forEach((k) => allKeys.add(k));
  Object.keys(buildingKeyMap).forEach((k) => allKeys.add(k));
  allKeys.add("e");

  // Now we see which ones yield a valid BoardAction for the selected tile
  const validActions = Array.from(allKeys)
    .map((k) => {
      return getBoardAction(k, selectedTile, board); // either BoardAction or null
    })
    .filter((a) => a !== null) as BoardAction[]; // filter out null

  return (
    <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={onClose}>
      {/* If the selected tile represents a city, add a toggle action */}
      {selectedTile && selectedTile.cityId && selectedTile.terrain === Terrain.City && (
        <MenuItem
          onClick={() => {
            // Toggle the inclusion state for this city in optimization.
            setCityToggles((prev) => ({
              ...prev,
              [selectedTile.cityId!]: !prev[selectedTile.cityId!],
            }));
            onClose();
          }}
        >
          {cityToggles[selectedTile.cityId!]
            ? "Exclude City from Optimization"
            : "Include City in Optimization"}
        </MenuItem>
      )}
      {
        validActions.map((action) => (
          <MenuItem
            key={action.key}
            onClick={() => {
              handleTileAction(action.key, selectedTile);
              onClose();
            }}
          >
            {action.label}
          </MenuItem>
        ))
      }
    </Menu>
  );
}
