// Define Technology as an enum.
export enum Technology {
  Forestry = "Forestry",
  Mathematics = "Mathematics",
  Trade = "Trade",
  Spiritualism = "Spiritualism",
  Farming = "Farming",
  Construction = "Construction",
  Chivalry = "Chivalry",
  Mining = "Mining",
  Smithery = "Smithery",
}

// Specify the order in which tech categories should appear.
export const techOrder: Technology[] = [
  Technology.Forestry,
  Technology.Mathematics,
  Technology.Trade,
  Technology.Spiritualism,
  Technology.Farming,
  Technology.Construction,
  Technology.Chivalry,
  Technology.Mining,
  Technology.Smithery,
];
// Default tech settings: only enable Forestry, Mathematics, and Trade.
export const defaultTechEnabled: Record<Technology, boolean> = {
  [Technology.Forestry]: true,
  [Technology.Mathematics]: true,
  [Technology.Trade]: true,
  [Technology.Spiritualism]: false,
  [Technology.Farming]: false,
  [Technology.Construction]: false,
  [Technology.Chivalry]: false,
  [Technology.Mining]: false,
  [Technology.Smithery]: false,
};