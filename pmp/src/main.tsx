import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import RiotProbabilityCalculator from './RiotProbabilityCalculator';
import { Home } from "./Home";
import PolytopiaMarketPlanner from "./components/PolytopiaMarketPlanner";

export const LINKS = [
  {path: '/riotCalc', name: 'Riot Probability Calculator'},
  {path: '/pmp', name: 'Polytopia Market Planner'},
];

const rootElement = document.getElementById('root') as HTMLElement;
const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PolytopiaMarketPlanner/>}/>
        {/*<Route path="/riotCalc" element={<RiotProbabilityCalculator/>}/>*/}
        {/*<Route path="/pmp" element={<PolytopiaMarketPlanner/>}/>*/}
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
