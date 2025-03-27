// Filename: ./main.tsx

import React from "react";
import ReactDOM from "react-dom/client";
import PolytopiaMarketPlanner from "./components/PolytopiaMarketPlanner";
import { BoardStateProvider } from "./contexts/BoardStateContext";
import { BoardActionsProvider } from "./contexts/BoardActionsContext";
import { OptimizationProvider } from "./contexts/OptimizationContext";

const rootElement = document.getElementById("root") as HTMLElement;
const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <BoardStateProvider initialWidth={16} initialHeight={16}>
      <BoardActionsProvider>
        <OptimizationProvider>
          <PolytopiaMarketPlanner />
        </OptimizationProvider>
      </BoardActionsProvider>
    </BoardStateProvider>
  </React.StrictMode>
);
