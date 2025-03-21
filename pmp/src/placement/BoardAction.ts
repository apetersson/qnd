// BoardAction.ts
import { Board } from "../models/Board";

export interface BoardAction {
  key: string;      // the single-character or so
  label: string;    // for UI display
  perform: (board: Board) => void;
}
