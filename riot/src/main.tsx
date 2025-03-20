import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import RiotProbabilityCalculator from "./RiotProbabilityCalculator";


const rootElement = document.getElementById('root') as HTMLElement;
const root = ReactDOM.createRoot(rootElement);

const base = import.meta.env.MODE === "production" ? "/qnd/riot" : "/";


root.render(
  <React.StrictMode>
    <BrowserRouter basename={base}>
      <Routes>
        <Route path="/" element={<RiotProbabilityCalculator/>}/>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
//