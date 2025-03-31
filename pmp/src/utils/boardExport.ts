// Filename: ./utils/boardExport.ts

import pako from "pako";
import {
  Board,
  Building,
  Building as ModelBuilding,
  createInitialBoard,
  Terrain,
  Terrain as ModelTerrain,
  TileData,
  TileData as ModelTileData
} from "../models/Board";
// Import from the generated wire format instead of protobufjs
import {
  BoardExportData as WireBoardExportData,
  Building as WireBuilding,
  decodeBoardExportData,
  encodeBoardExportData,
  Terrain as WireTerrain,
  Tile as WireTile,
} from "../proto/wire-format"; // Adjust path if needed

export interface BoardExportData {
  width: number;
  height: number;
  tiles: TileData[];
}


// --- Mappings between Model Enums and Wire Enums ---
// Although the string values match, explicit mapping is safer.

const modelToWireTerrain: { [key in ModelTerrain]: WireTerrain } = {
  [ModelTerrain.None]: WireTerrain.NONE,
  [ModelTerrain.Field]: WireTerrain.FIELD,
  [ModelTerrain.Forest]: WireTerrain.FOREST,
  [ModelTerrain.Mountain]: WireTerrain.MOUNTAIN,
  [ModelTerrain.City]: WireTerrain.CITY,
  [ModelTerrain.Water]: WireTerrain.WATER,
};

const wireToModelTerrain: { [key in WireTerrain]: ModelTerrain } = {
  [WireTerrain.NONE]: ModelTerrain.None,
  [WireTerrain.FIELD]: ModelTerrain.Field,
  [WireTerrain.FOREST]: ModelTerrain.Forest,
  [WireTerrain.MOUNTAIN]: ModelTerrain.Mountain,
  [WireTerrain.CITY]: ModelTerrain.City,
  [WireTerrain.WATER]: ModelTerrain.Water,
};

const modelToWireBuilding: { [key in ModelBuilding]: WireBuilding } = {
  [ModelBuilding.None]: WireBuilding.B_NONE, // Note the B_ prefix in wire format
  [ModelBuilding.Farm]: WireBuilding.FARM,
  [ModelBuilding.LumberHut]: WireBuilding.LUMBER_HUT,
  [ModelBuilding.Mine]: WireBuilding.MINE,
  [ModelBuilding.Sawmill]: WireBuilding.SAWMILL,
  [ModelBuilding.Windmill]: WireBuilding.WINDMILL,
  [ModelBuilding.Forge]: WireBuilding.FORGE,
  [ModelBuilding.Market]: WireBuilding.MARKET,
  [ModelBuilding.Monument]: WireBuilding.MONUMENT,
};

const wireToModelBuilding: { [key in WireBuilding]: ModelBuilding } = {
  [WireBuilding.B_NONE]: ModelBuilding.None,
  [WireBuilding.FARM]: ModelBuilding.Farm,
  [WireBuilding.LUMBER_HUT]: ModelBuilding.LumberHut,
  [WireBuilding.MINE]: ModelBuilding.Mine,
  [WireBuilding.SAWMILL]: ModelBuilding.Sawmill,
  [WireBuilding.WINDMILL]: ModelBuilding.Windmill,
  [WireBuilding.FORGE]: ModelBuilding.Forge,
  [WireBuilding.MARKET]: ModelBuilding.Market,
  [WireBuilding.MONUMENT]: ModelBuilding.Monument,
};

// --- End Mappings ---


/**
 * Exports only non‑empty tile data as a plain JSON string.
 * Used for BoardExporter (human‑readable).
 */
export function exportBoardState(board: Board): string {
  const exportData: BoardExportData = {
    width: board.width,
    height: board.height,
    tiles: board.tiles.filter(
      (t) => t.terrain !== Terrain.None || t.building !== Building.None || t.cityId
    ),
  };
  return JSON.stringify(exportData);
}

/**
 * Imports board state from a plain JSON string.
 */
export function importBoardState(data: string): Board {
  const parsed = JSON.parse(data);
  if (parsed && parsed.width && parsed.height && Array.isArray(parsed.tiles)) {
    const newBoard = createInitialBoard(parsed.width, parsed.height);
    parsed.tiles.forEach((t: TileData) => {
      const idx = newBoard.tiles.findIndex((bt) => bt.x === t.x && bt.y === t.y);
      if (idx > -1) newBoard.tiles[idx] = {...newBoard.tiles[idx], ...t};
    });
    return newBoard;
  }
  throw new Error("Invalid board configuration");
}

/**
 * Exports board state for URL storage:
 * Filters out empty tile data, stringifies, compresses with pako, then base64-encodes.
 */
export function exportBoardStateForURL(board: Board): string {
  const exportData: BoardExportData = {
    width: board.width,
    height: board.height,
    tiles: board.tiles.filter(
      (t) => t.terrain !== Terrain.None || t.building !== Building.None || t.cityId
    ),
  };
  const json = JSON.stringify(exportData);
  const compressed = pako.deflate(json);
  const binaryString = String.fromCharCode(...Array.from(compressed));
  return btoa(binaryString);
}

/**
 * Imports board state from the URL:
 * Base64-decodes, decompresses via pako, then parses and reconstructs the board.
 */
export function importBoardStateFromURL(data: string): Board {
  const binaryString = atob(data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const decompressed = pako.inflate(bytes, {to: "string"});
  const parsed = JSON.parse(decompressed);
  if (parsed && parsed.width && parsed.height && Array.isArray(parsed.tiles)) {
    const newBoard = createInitialBoard(parsed.width, parsed.height);
    parsed.tiles.forEach((t: TileData) => {
      const idx = newBoard.tiles.findIndex((bt) => bt.x === t.x && bt.y === t.y);
      if (idx > -1) newBoard.tiles[idx] = {...newBoard.tiles[idx], ...t};
    });
    return newBoard;
  }
  throw new Error("Invalid board configuration");
}

/**
 * Exports board state for URL storage using the generated wire-format.
 * Filters out empty tiles, encodes with wire-format functions, compresses, then base64‑encodes.
 */
export function exportBoardStateForURLWithProtobuf(board: Board): string {
  // Create the payload conforming to WireBoardExportData
  const payload: WireBoardExportData = {
    width: board.width,
    height: board.height,
    // Map only non‑empty tiles to WireTile format using the mappings
    tiles: board.tiles
      .filter((t) => t.terrain !== ModelTerrain.None || t.building !== ModelBuilding.None || t.cityId)
      .map((modelTile: ModelTileData): WireTile => {
        return {
          x: modelTile.x,
          y: modelTile.y,
          terrain: modelToWireTerrain[modelTile.terrain]!, // Use mapping
          building: modelToWireBuilding[modelTile.building]!, // Use mapping
          cityId: modelTile.cityId || undefined
        };
      })
  };

  // Use the encode function from wire-format.ts
  const buffer = encodeBoardExportData(payload);

  // Compress with pako
  const compressed = pako.deflate(buffer);

  // Base64 encode
  // Convert Uint8Array to binary string first for btoa
  let binaryString = '';
  const len = compressed.length;
  for (let i = 0; i < len; i++) {
    binaryString += String.fromCharCode(compressed[i]!);
  }
  return btoa(binaryString);
}

/**
 * Imports board state from a base64 string that was created with the new export function.
 */
export function importBoardStateFromURLWithProtobuf(data: string): Board {
  // Base64 decode
  const binaryString = atob(data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Decompress with pako
  const decompressed = pako.inflate(bytes);

  // Use the decode function from wire-format.ts
  const decodedObject: WireBoardExportData = decodeBoardExportData(decompressed);

  if (!decodedObject.width || !decodedObject.height) {
    throw new Error("Invalid decoded board data: missing width or height");
  }

  // Create the initial board using Model types
  const newBoard = createInitialBoard(decodedObject.width, decodedObject.height);

  // Map the decoded WireTile objects back to ModelTileData
  (decodedObject.tiles || []).forEach((wireTile: WireTile) => {
    if (wireTile.x === undefined || wireTile.y === undefined) return; // Skip tiles without coordinates

    const idx = newBoard.tiles.findIndex(
      (bt) => bt.x === wireTile.x && bt.y === wireTile.y
    );
    if (idx > -1 && newBoard.tiles[idx]) {
      const modelTile = newBoard.tiles[idx]!;
      modelTile.x = wireTile.x;
      modelTile.y = wireTile.y;
      // Use reverse mapping for enums, provide defaults if undefined
      modelTile.terrain = wireTile.terrain ? wireToModelTerrain[wireTile.terrain] : ModelTerrain.None;
      modelTile.building = wireTile.building ? wireToModelBuilding[wireTile.building] : ModelBuilding.None;
      // Map undefined or empty string from wire format back to null for the model
      modelTile.cityId = wireTile.cityId || null;
    }
  });

  return newBoard;
}