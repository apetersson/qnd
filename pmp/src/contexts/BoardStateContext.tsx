import React, { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { Board, createInitialBoard } from "../models/Board";
import { exportBoardStateForURL, importBoardStateFromURL } from "../utils/boardExport";

interface BoardStateContextType {
  board: Board;
  setBoard: React.Dispatch<React.SetStateAction<Board>>;
}

const BoardStateContext = createContext<BoardStateContextType | undefined>(undefined);

interface BoardStateProviderProps {
  children: ReactNode;
  initialWidth: number;
  initialHeight: number;
}

export const BoardStateProvider: React.FC<BoardStateProviderProps> = ({
                                                                        children,
                                                                        initialWidth,
                                                                        initialHeight,
                                                                      }) => {
  const [board, setBoard] = useState<Board>(() => {
    if (window.location.hash.length > 1) {
      try {
        const encoded = window.location.hash.substring(1);
        return importBoardStateFromURL(encoded);
      } catch (err) {
        console.error("Error decoding board state from URL:", err);
      }
    }
    return createInitialBoard(initialWidth, initialHeight);
  });

  useEffect(() => {
    try {
      const initialBoard = createInitialBoard(initialWidth, initialHeight);
      const currentExport = exportBoardStateForURL(board);
      const initialExport = exportBoardStateForURL(initialBoard);
      if (currentExport !== initialExport) {
        window.history.replaceState(null, "", `#${currentExport}`);
      } else {
        window.history.replaceState(null, "", window.location.pathname);
      }
    } catch (err) {
      console.error("Error encoding board state:", err);
    }
  }, [board, initialWidth, initialHeight]);

  return (
    <BoardStateContext.Provider value={{ board, setBoard }}>
      {children}
    </BoardStateContext.Provider>
  );
};

export function useBoardState(): BoardStateContextType {
  const context = useContext(BoardStateContext);
  if (!context) {
    throw new Error("useBoardState must be used within a BoardStateProvider");
  }
  return context;
}
