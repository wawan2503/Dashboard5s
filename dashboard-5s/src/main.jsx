import React from "react";
import ReactDOM from "react-dom/client";
import { EventType, PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import App from "./App.jsx";
import { authStorageKeys, msalConfig } from "./authConfig.js";
import "./index.css";
import { ensureMsalReady } from "./msalBootstrap.js";

const rootEl = document.getElementById("root");
const root = ReactDOM.createRoot(rootEl);

const hasWebCrypto = Boolean(globalThis.crypto && globalThis.crypto.subtle);
const isSecureContext = Boolean(globalThis.isSecureContext);

if (!hasWebCrypto) {
  root.render(
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          maxWidth: 820,
          width: "100%",
          background: "#fff",
          border: "1px solid rgba(0,0,0,0.08)",
          borderRadius: 12,
          padding: 18,
          boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: 8 }}>Tidak bisa mulai (WebCrypto tidak tersedia)</h2>
        <div style={{ color: "rgba(0,0,0,0.75)", fontSize: 13, lineHeight: 1.55 }}>
          Aplikasi ini pakai MSAL dan butuh WebCrypto. Biasanya error ini muncul kalau dibuka lewat HTTP di alamat IP (bukan
          <code style={{ fontFamily: "monospace" }}> localhost</code>) atau browser terlalu lama.
        </div>
        <div style={{ marginTop: 10, fontSize: 12, color: "rgba(0,0,0,0.65)" }}>
          Origin: <code style={{ fontFamily: "monospace" }}>{window.location.origin}</code> | Secure context:{" "}
          <code style={{ fontFamily: "monospace" }}>{String(isSecureContext)}</code>
        </div>
        <div style={{ marginTop: 12, fontSize: 13, color: "rgba(0,0,0,0.75)" }}>
          Solusi cepat:
          <ul style={{ margin: "8px 0 0 18px" }}>
            <li>Buka dari komputer yang sama: <code style={{ fontFamily: "monospace" }}>http://localhost:8001</code></li>
            <li>Atau gunakan HTTPS (mis. reverse proxy / sertifikat) lalu pastikan redirect URI di Azure sesuai.</li>
          </ul>
        </div>
      </div>
    </div>
  );
} else {
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

      try {
        const username = event.payload.account.username;
        if (username) localStorage.setItem(authStorageKeys.loginHint, username);
      } catch {
        // ignore (storage might be blocked)
      }
    }
  });

  root.render(
    <div
      style={{
        maxWidth: 520,
        margin: "72px auto",
        background: "#fff",
        border: "1px solid rgba(0,0,0,0.08)",
        borderRadius: 12,
        padding: 20,
      }}
    >
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
}
