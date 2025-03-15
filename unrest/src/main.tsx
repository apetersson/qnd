import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import RiotProbabilityCalculator from './RiotProbabilityCalculator';
import PolytopiaMarketPlanner from './PolytopiaMarketPlanner';
import { Home } from "./Home";

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
        <Route path="/" element={<Home/>}/>
        <Route path="/riotCalc" element={<RiotProbabilityCalculator/>}/>
        <Route path="/pmp" element={<PolytopiaMarketPlanner/>}/>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
