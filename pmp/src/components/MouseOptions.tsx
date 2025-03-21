import React from "react";
import { Menu } from "@mui/material";
import { buildingKeyMap, terrainKeyMap } from "../hooks/useBoardControls";

export function MouseOptions(props: {
  anchorEl: HTMLElement | null,
  onClose: () => void,
  callbackfn: (action: { key: string, label: string }) => React.JSX.Element
}) {

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

  return <Menu
    anchorEl={props.anchorEl}
    open={!!props.anchorEl}
    onClose={props.onClose}
  >
    {dynamicPopupActions.map(props.callbackfn)}
  </Menu>;
}