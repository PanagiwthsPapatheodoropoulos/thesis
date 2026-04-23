/**
 * @fileoverview Application bootstrap entry point.
 * Mounts the root React component into the DOM element with id "root".
 * React StrictMode is enabled to surface potential issues during development.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);