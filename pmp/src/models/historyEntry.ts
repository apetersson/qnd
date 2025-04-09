export interface HistoryEntry {
  actionId: string;
  description: string;
  x: number;
  y: number;
  cityId: string | null;
  cost: number;
}