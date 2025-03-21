// Filename: ./contexts/BoardStateContext.tsx

import React, { createContext, ReactNode, useContext, useEffect, useState, } from "react";
import { Board, createInitialBoard } from "../models/Board";
import * as pako from "pako";

/** Helper function to encode board state as a compressed, base64 string. */
function encodeState(state: Board): string {
  const json = JSON.stringify(state);
  const compressed = pako.deflate(json);
  // Convert the Uint8Array into a string, then base64-encode it.
  const binaryString = String.fromCharCode(...Array.from(compressed));
  return btoa(binaryString);
}

/** Helper function to decode board state from a compressed, base64 string. */
function decodeState(encoded: string): Board {
  const binaryString = atob(encoded);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const decompressed = pako.inflate(bytes, {to: "string"});
  return JSON.parse(decompressed);
}

/** Context type: includes the board and setBoard. */
interface BoardStateContextType {
  board: Board;
  setBoard: React.Dispatch<React.SetStateAction<Board>>;
}

const BoardStateContext = createContext<BoardStateContextType | undefined>(
  undefined
);

interface BoardStateProviderProps {
  children: ReactNode;
  initialWidth?: number;
  initialHeight?: number;
}

/**
 * Provides the board state and its setter, handling URL-hash serialization.
 */
export const BoardStateProvider: React.FC<BoardStateProviderProps> = ({
                                                                        children,
                                                                        initialWidth = 11,
                                                                        initialHeight = 11,
                                                                      }) => {
  const [board, setBoard] = useState<Board>(() => {
    // Try to load a previously saved board state from the URL hash.
    if (window.location.hash.length > 1) {
      try {
        const encoded = window.location.hash.substring(1);
        return decodeState(encoded);
      } catch (err) {
        console.error("Error decoding board state from URL:", err);
      }
    }
    // If no valid state is found, create a new board.
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
    <BoardStateContext.Provider value={{board, setBoard}}>
      {children}
    </BoardStateContext.Provider>
  );
};

/** Hook to easily access board state. */
export function useBoardState(): BoardStateContextType {
  const context = useContext(BoardStateContext);
  if (!context) {
    throw new Error("useBoardState must be used within a BoardStateProvider");
  }
  return context;
}
