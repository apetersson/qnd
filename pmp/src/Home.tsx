import React from "react";
import { Link } from "react-router-dom";
import { LINKS } from "./main";

export const Home: React.FC = () => (
  <div>
    <h1>Qick and dirty tools</h1>
    <ul>
      {LINKS.map(link => (
        <li key={link.path}>
          <Link to={link.path}>{link.name}</Link>
        </li>
      ))}
    </ul>
  </div>
);