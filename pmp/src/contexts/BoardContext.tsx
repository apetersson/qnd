// src/contexts/BoardContext.tsx

import React, { createContext, ReactNode, useContext, useEffect, useState, } from "react";
import { Board, createInitialBoard } from "../models/Board";
import * as pako from "pako";

/**
 * Helper function to encode board state as a compressed, base64 string.
 * This allows us to persist board state in the URL hash.
 */
function encodeState(state: any): string {
  const json = JSON.stringify(state);
  const compressed = pako.deflate(json);
  // Convert the Uint8Array into a string, then base64-encode it.
  const binaryString = String.fromCharCode(...Array.from(compressed));
  return btoa(binaryString);
}

/**
 * Helper function to decode board state from a compressed, base64 string.
 */
function decodeState(encoded: string): any {
  const binaryString = atob(encoded);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const decompressed = pako.inflate(bytes, {to: "string"});
  return JSON.parse(decompressed);
}

/**
 * Interface for our BoardContext.
 * It provides the current board state and a function to update it.
 */
interface BoardContextType {
  board: Board;
  setBoard: React.Dispatch<React.SetStateAction<Board>>;
}

/**
 * Create the BoardContext with an undefined default.
 * Consumers must be wrapped in a BoardProvider.
 */
const BoardContext = createContext<BoardContextType | undefined>(undefined);

/**
 * Props for the BoardProvider component.
 * Optionally accepts initial board dimensions.
 */
interface BoardProviderProps {
  children: ReactNode;
  initialWidth?: number;
  initialHeight?: number;
}

/**
 * BoardProvider component.
 * It initializes the board state from the URL hash if available;
 * otherwise, it uses the provided initial dimensions (defaulting to 11x11).
 *
 * It also sets up an effect to update the URL hash whenever the board changes.
 */
export const BoardProvider: React.FC<BoardProviderProps> = ({
                                                              children,
                                                              initialWidth = 11,
                                                              initialHeight = 11,
                                                            }) => {
  const [board, setBoard] = useState<Board>(() => {
    // Try to load a previously saved board state from the URL hash.
    if (window.location.hash.length > 1) {
      try {
        const encoded = window.location.hash.substring(1);
        const loadedBoard = decodeState(encoded);
        return loadedBoard;
      } catch (err) {
        console.error("Error decoding board state from URL:", err);
      }
    }
    // If no state is found, create a new board.
    return createInitialBoard(initialWidth, initialHeight);
  });

  // Update the URL hash whenever the board state changes.
  useEffect(() => {
    try {
      const encodedState = encodeState(board);
      window.history.replaceState(null, "", `#${encodedState}`);
    } catch (err) {
      console.error("Error encoding board state:", err);
    }
  }, [board]);

  return (
    <BoardContext.Provider value={{board, setBoard}}>
      {children}
    </BoardContext.Provider>
  );
};

/**
 * Custom hook to access the BoardContext.
 * It throws an error if used outside a BoardProvider.
 */
export const useBoardState = (): BoardContextType => {
  const context = useContext(BoardContext);
  if (!context) {
    throw new Error("useBoardState must be used within a BoardProvider");
  }
  return context;
};
