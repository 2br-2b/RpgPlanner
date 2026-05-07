import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app.jsx";
import { ShareApp } from "./share-view.jsx";
import "./theme-parchment.css";
import "./theme-chalkboard.css";
import "./theme-corkboard.css";
import "./theme-newspaper.css";
import "./theme-blueprint.css";
import "./theme-battletech.css";

const shareMatch = window.location.pathname.match(/^\/share\/(.+)$/);

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {shareMatch ? <ShareApp shareGuid={shareMatch[1]} /> : <App />}
  </React.StrictMode>,
);
