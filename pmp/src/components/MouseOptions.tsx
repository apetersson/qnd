import { Menu, MenuItem } from "@mui/material";
import { buildingKeyMap, terrainKeyMap, useBoardActions } from "../contexts/BoardActionsContext";
import { TileData } from "../models/Board";
import { useBoardState } from "../contexts/BoardStateContext";
import { BoardAction } from "../placement/BoardAction";
import { getBoardAction } from "../placement/getBoardAction";

interface MouseOptionsProps {
  anchorEl: HTMLElement | null;
  onClose: () => void;
  selectedTile: TileData | null;
}

export function MouseOptions({anchorEl, onClose, selectedTile}: MouseOptionsProps) {
  const {handleTileAction} = useBoardActions();
  const {board} = useBoardState();

  if (!selectedTile) {
    return (
      <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={onClose}>
        <MenuItem onClick={onClose}>No tile selected</MenuItem>
      </Menu>
    );
  }

  // We’ll build a comprehensive list of all possible keys we want to show:
  //  - all terrain keys from terrainKeyMap
  //  - all building keys from buildingKeyMap
  //  - plus special single-char keys if any
  //   e.g. "e" for city extension
  const allKeys = new Set<string>();

  // from terrainKeyMap
  Object.keys(terrainKeyMap).forEach((k) => allKeys.add(k));
  // from buildingKeyMap
  Object.keys(buildingKeyMap).forEach((k) => allKeys.add(k));
  // special ones
  allKeys.add("e");

  // Now we see which ones yield a valid BoardAction for the selected tile
  const validActions = Array.from(allKeys)
    .map((k) => {
      return getBoardAction(k, selectedTile, board); // either BoardAction or null
    })
    .filter((a) => a !== null) as BoardAction[]; // filter out null

  return (
    <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={onClose}>
      {validActions.map((action) => (
        <MenuItem
          key={action.key}
          onClick={() => {
            handleTileAction(action.key, selectedTile);
            onClose();
          }}
        >
          {action.label}
        </MenuItem>
      ))}
    </Menu>
  );
}
