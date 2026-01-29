import React from "react";
import ReactDOM from "react-dom/client";
import { EventType, PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import App from "./App.jsx";
import { msalConfig } from "./authConfig.js";
import "./index.css";
import { ensureMsalReady } from "./msalBootstrap.js";

const rootEl = document.getElementById("root");
const root = ReactDOM.createRoot(rootEl);

let msalInstance;
try {
  msalInstance = new PublicClientApplication(msalConfig);
} catch (e) {
  root.render(
    <pre style={{ whiteSpace: "pre-wrap", padding: 16, color: "#a40000", fontFamily: "monospace" }}>
      {`MSAL init error: ${e?.message || String(e)}`}
    </pre>
  );
  throw e;
}

msalInstance.addEventCallback((event) => {
  if (
    (event.eventType === EventType.LOGIN_SUCCESS || event.eventType === EventType.ACQUIRE_TOKEN_SUCCESS) &&
    event.payload?.account
  ) {
    msalInstance.setActiveAccount(event.payload.account);
  }
});

root.render(
  <div style={{ maxWidth: 520, margin: "72px auto", background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12, padding: 20 }}>
    <h2 style={{ marginTop: 0 }}>Memproses login...</h2>
    <p style={{ color: "rgba(0,0,0,0.7)", marginBottom: 0 }}>Tunggu sebentar, sedang membaca sesi Microsoft.</p>
  </div>
);

ensureMsalReady(msalInstance)
  .catch((e) => {
    root.render(
      <pre style={{ whiteSpace: "pre-wrap", padding: 16, color: "#a40000", fontFamily: "monospace" }}>
        {`MSAL startup error: ${e?.message || String(e)}`}
      </pre>
    );
    throw e;
  })
  .finally(() => {
    root.render(
      <React.StrictMode>
        <MsalProvider instance={msalInstance}>
          <App />
        </MsalProvider>
      </React.StrictMode>
    );
  });
