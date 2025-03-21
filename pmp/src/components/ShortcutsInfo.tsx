// Filename: ./components/ShortcutsInfo.tsx

import React from "react";
import { buildingKeyMap, terrainKeyMap } from "../contexts/BoardActionsContext";

const ShortcutsInfo: React.FC = () => {
  return (
    <>
      <strong>Keyboard Shortcuts</strong>
      <div style={{marginTop: 8}}>
        <p>
          <strong>Terrain</strong>
        </p>
        <ul>
          {Object.entries(terrainKeyMap).map(([key, terrain]) => (
            <li key={`terrain-${key}`}>
              <strong>{key}</strong> – {terrain}
            </li>
          ))}
          <li key={`terrain-e`}>
            <strong>e</strong> – Extend City
          </li>
        </ul>

        <p>
          <strong>Buildings</strong>
        </p>
        <ul>
          {Object.entries(buildingKeyMap).map(([key, building]) => (
            <li key={`building-${key}`}>
              <strong>{key}</strong> – {building}
            </li>
          ))}
        </ul>

        <p>
          Tip: Press <strong>&quot;c&quot;</strong> to set a tile as City (automatically
          claim adjacent tiles), <strong>&quot;e&quot;</strong> to extend the hovered city.
        </p>
      </div>
    </>
  );
};

export default ShortcutsInfo;
