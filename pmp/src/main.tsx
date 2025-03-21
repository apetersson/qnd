import React from "react";
import ReactDOM from "react-dom/client";
import PolytopiaMarketPlanner from "./components/PolytopiaMarketPlanner";
import { BoardProvider } from "./contexts/BoardContext";

const rootElement = document.getElementById("root") as HTMLElement;
const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <BoardProvider initialWidth={11} initialHeight={11}>
      <PolytopiaMarketPlanner/>
    </BoardProvider>
  </React.StrictMode>
);
