import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";

const startupUrl = new URL(window.location.href);
const redirectedPath = startupUrl.searchParams.get("__spa_redirect");
const hashPath = window.location.hash.startsWith("#/")
  ? window.location.hash.slice(1)
  : "";

if (redirectedPath) {
  const decodedPath = decodeURIComponent(redirectedPath);
  window.history.replaceState(null, "", decodedPath);
} else if (hashPath) {
  window.history.replaceState(null, "", hashPath);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
