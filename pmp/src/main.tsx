import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import PolytopiaMarketPlanner from "./components/PolytopiaMarketPlanner";

export const LINKS = [
  {path: '/riotCalc', name: 'Riot Probability Calculator'},
  {path: '/pmp', name: 'Polytopia Market Planner'},
];

const rootElement = document.getElementById('root') as HTMLElement;
const root = ReactDOM.createRoot(rootElement);

const base = import.meta.env.MODE === "production" ? "/qnd/pmp" : "/";


root.render(
  <React.StrictMode>
    <BrowserRouter basename={base}>
      <Routes>
        <Route path="/" element={<PolytopiaMarketPlanner/>}/>
        {/*<Route path="/riotCalc" element={<RiotProbabilityCalculator/>}/>*/}
        {/*<Route path="/pmp" element={<PolytopiaMarketPlanner/>}/>*/}
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
//