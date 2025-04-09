import { Board } from "./Board";

import { HistoryEntry } from "./historyEntry";

export interface Solution {
  marketBonus: number;
  foodBonus: number;
  iteration: number;
  boardSnapshot: Board;
  history: HistoryEntry[];
}