
import React from "react";
import { useBoardState } from "../contexts/BoardStateContext";
import {
  placeAdvancedBuildingsSimple,
  placeBasicResourceBuildings,
  removeNonContributingBasicBuildings
} from "../placement/placement";


const CityManagementPanel: React.FC = () => {
  const { board, setBoard } = useBoardState();

  const handlePlaceBasicBuildings = () => {
    setBoard(placeBasicResourceBuildings(board));
  };

  const handlePlaceAdvancedBuildings = () => {
    setBoard(placeAdvancedBuildingsSimple(board));
  };

  const handleRemoveNonContributing = () => {
    setBoard(removeNonContributingBasicBuildings(board));
  };

  return (
    <div style={{ marginBottom: 12 }}>
      <button onClick={handlePlaceBasicBuildings} style={{ marginRight: 8 }}>
        Place Basic Buildings
      </button>
      <button onClick={handlePlaceAdvancedBuildings} style={{ marginRight: 8 }}>
        Place Advanced Buildings
      </button>
      <button onClick={handleRemoveNonContributing}>
        Remove Non-Contributing Basics
      </button>
    </div>
  );
};

export default CityManagementPanel;
