// Filename: ./utils/boardExport.ts

import pako from "pako";
import { Board, TileData, Terrain, Building, createInitialBoard } from "../models/Board";

export interface BoardExportData {
  width: number;
  height: number;
  tiles: TileData[];
}

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
      if (idx > -1) newBoard.tiles[idx] = { ...newBoard.tiles[idx], ...t };
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
  const decompressed = pako.inflate(bytes, { to: "string" });
  const parsed = JSON.parse(decompressed);
  if (parsed && parsed.width && parsed.height && Array.isArray(parsed.tiles)) {
    const newBoard = createInitialBoard(parsed.width, parsed.height);
    parsed.tiles.forEach((t: TileData) => {
      const idx = newBoard.tiles.findIndex((bt) => bt.x === t.x && bt.y === t.y);
      if (idx > -1) newBoard.tiles[idx] = { ...newBoard.tiles[idx], ...t };
    });
    return newBoard;
  }
  throw new Error("Invalid board configuration");
}
