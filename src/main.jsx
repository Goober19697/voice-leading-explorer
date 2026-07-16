import React from "react";
import ReactDOM from "react-dom/client";
import VoiceLeadingExplorer from "./VoiceLeadingExplorer.jsx";

// Optional: override the piano sample CDN via .env (see .env.example).
// The component reads window.SAMPLE_BASE_URL so the same file also works
// in the no-build standalone HTML version.
if (import.meta.env.VITE_SAMPLE_BASE_URL) {
  window.SAMPLE_BASE_URL = import.meta.env.VITE_SAMPLE_BASE_URL;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <VoiceLeadingExplorer />
  </React.StrictMode>
);
