import { Building } from "./Board";

export const MARKET_CONTRIBUTIONG_BUILDINGS: Building[] = [
  Building.Sawmill,
  Building.Windmill,
  Building.Forge,
];


export const ADVANCED_BUILDINGS: Building[] = [
  ...MARKET_CONTRIBUTIONG_BUILDINGS,
  Building.Market,
];
