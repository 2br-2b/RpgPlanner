import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { useRegisterSW } from "virtual:pwa-register/react";
import { App } from "./app.jsx";
import { ShareApp } from "./share-view.jsx";
import { ThemeTestPage } from "./theme-test.jsx";
import "./theme-parchment.css";
import "./theme-chalkboard.css";
import "./theme-corkboard.css";
import "./theme-newspaper.css";
import "./theme-blueprint.css";
import "./theme-battletech.css";
import "./theme-bubblegum.css";

function Root() {
  const { needRefresh: [needRefresh], updateSW } = useRegisterSW();
  useEffect(() => {
    if (needRefresh) updateSW(true);
  }, [needRefresh, updateSW]);

  const shareMatch = window.location.pathname.match(/^\/share\/(.+)$/);
  const isThemeTest = window.location.pathname === "/themes";
  return isThemeTest ? <ThemeTestPage /> : shareMatch ? <ShareApp shareGuid={shareMatch[1]} /> : <App />;
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
