import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { InteractionStatus } from "@azure/msal-browser";
import { useMsal } from "@azure/msal-react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import SharePointAuditDashboard from "./SharePointAuditDashboard.jsx";
import { authStorageKeys, loginRequest } from "./authConfig.js";

let inMemoryAutoLoginAttempted = false;

function loadLoginHint() {
  try {
    return localStorage.getItem(authStorageKeys.loginHint) || "";
  } catch {
    return "";
  }
}

function getSessionFlag(key) {
  try {
    return sessionStorage.getItem(key) || "";
  } catch {
    if (key === authStorageKeys.autoLoginAttempted) return inMemoryAutoLoginAttempted ? "1" : "0";
    return "";
  }
}

function setSessionFlag(key, value) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    if (key === authStorageKeys.autoLoginAttempted) inMemoryAutoLoginAttempted = value === "1";
  }
}

function Container({ children }) {
  return (
    <div style={{ width: "100%" }}>
      {children}
    </div>
  );
}

function Card({ children }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid rgba(0,0,0,0.08)",
        borderRadius: 12,
        padding: 16,
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
      }}
    >
      {children}
    </div>
  );
}

function RequireAuth({ instance, account, inProgress, err, setErr, children }) {
  const [isRetrying, setIsRetrying] = useState(false);
  const forcedRetryOnceRef = useRef(false);

  const tryLoginRedirect = useCallback(async () => {
    try {
      setErr?.("");
      setIsRetrying(true);

      const loginHint = loadLoginHint();
      // If we know the last username, let Microsoft auto-pick that account (no account picker).
      // Fallback to account picker only when we don't have a hint.
      const request = {
        ...loginRequest,
        ...(loginHint ? { loginHint } : null),
        ...(loginHint ? null : { prompt: "select_account" }),
      };

      await instance.loginRedirect(request);
    } catch (e) {
      setErr?.(e?.message || String(e));
    } finally {
      setIsRetrying(false);
    }
  }, [instance, setErr]);

  const debugInfo = useMemo(() => {
    let cachedAccounts = 0;
    try {
      cachedAccounts = instance.getAllAccounts?.()?.length || 0;
    } catch {
      cachedAccounts = 0;
    }

    return {
      origin: window.location.origin,
      redirectUri: window.location.origin + "/",
      secureContext: String(Boolean(globalThis.isSecureContext)),
      cachedAccounts: String(cachedAccounts),
      autoLoginAttempted: String(getSessionFlag(authStorageKeys.autoLoginAttempted) || "0"),
    };
  }, [instance]);

  useEffect(() => {
    if (account) return;
    if (inProgress !== InteractionStatus.None) return;

    // Auto-redirect once per tab/session to avoid infinite loops.
    // Some browsers restore sessionStorage after a restart (restore tabs), which can leave this flag stuck at "1"
    // even though no MSAL account is present. In that case, force exactly one retry per mount.
    const attempted = getSessionFlag(authStorageKeys.autoLoginAttempted) === "1";
    const cachedAccounts = instance.getAllAccounts?.()?.length || 0;

    if (attempted) {
      if (!forcedRetryOnceRef.current && cachedAccounts === 0) {
        forcedRetryOnceRef.current = true;
        setSessionFlag(authStorageKeys.autoLoginAttempted, "1");
        void tryLoginRedirect();
      }
      return;
    }

    setSessionFlag(authStorageKeys.autoLoginAttempted, "1");
    void tryLoginRedirect();
  }, [account, inProgress, instance, tryLoginRedirect]);

  if (account) return children;

  return (
    <Container>
      <div style={{ marginTop: 72 }}>
        <div
          style={{
            maxWidth: 560,
            margin: "0 auto",
            background: "#fff",
            border: "1px solid rgba(0,0,0,0.08)",
            borderRadius: 12,
            padding: 16,
            boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 6 }}>Memproses sesi Microsoft...</h2>
          <div style={{ color: "rgba(0,0,0,0.7)", fontSize: 13 }}>
            Jika belum ada sesi, halaman akan otomatis dialihkan ke login Microsoft.
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: "rgba(0,0,0,0.6)" }}>
            Status: {String(inProgress || "-")}
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: "rgba(0,0,0,0.55)", lineHeight: 1.45 }}>
            Origin: <code style={{ fontFamily: "monospace" }}>{debugInfo.origin}</code> | Redirect URI:{" "}
            <code style={{ fontFamily: "monospace" }}>{debugInfo.redirectUri}</code>
            <br />
            Secure context: <code style={{ fontFamily: "monospace" }}>{debugInfo.secureContext}</code> | Cached accounts:{" "}
            <code style={{ fontFamily: "monospace" }}>{debugInfo.cachedAccounts}</code> | Auto-login attempted:{" "}
            <code style={{ fontFamily: "monospace" }}>{debugInfo.autoLoginAttempted}</code>
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => {
                setSessionFlag(authStorageKeys.autoLoginAttempted, "0");
                void tryLoginRedirect();
              }}
              disabled={inProgress !== InteractionStatus.None || isRetrying}
            >
              {isRetrying ? "Mencoba login..." : "Coba login lagi"}
            </button>
            <button
              type="button"
              onClick={() => {
                try {
                  localStorage.removeItem(authStorageKeys.loginHint);
                } catch {
                  // ignore
                }
                setSessionFlag(authStorageKeys.autoLoginAttempted, "0");
                instance.setActiveAccount?.(null);
                setErr?.("Session reset. Silakan klik 'Coba login lagi'.");
              }}
              disabled={inProgress !== InteractionStatus.None || isRetrying}
            >
              Reset sesi
            </button>
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: "rgba(0,0,0,0.55)", lineHeight: 1.45 }}>
            Jika hanya terjadi di Vercel: pastikan Redirect URI SPA di Azure App Registration berisi{" "}
            <code style={{ fontFamily: "monospace" }}>{debugInfo.redirectUri}</code> (harus persis sama).
          </div>
          {err ? (
            <pre style={{ whiteSpace: "pre-wrap", marginTop: 12, background: "#ffecec", color: "#a40000", padding: 10, borderRadius: 8 }}>
              {err}
            </pre>
          ) : null}
        </div>
      </div>
    </Container>
  );
}

function DashboardPage({ instance, account, setErr, forceRerender }) {
  const onLogout = async () => {
    try {
      setErr("");
      setSessionFlag(authStorageKeys.autoLoginAttempted, "0");
      instance.setActiveAccount?.(null);
      forceRerender();
      await instance.logoutRedirect({ account });
    } catch (e) {
      setErr(e?.message || String(e));
    }
  };

  return (
    <div style={{ width: "100%", padding: 16 }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <SharePointAuditDashboard instance={instance} account={account} onLogout={onLogout} />
      </div>
    </div>
  );
}

export default function App() {
  const { instance, accounts, inProgress } = useMsal();
  const [, forceRerender] = useReducer((x) => x + 1, 0);
  const [err, setErr] = useState("");

  const activeAccount = instance.getActiveAccount?.() || accounts?.[0] || instance.getAllAccounts?.()?.[0] || null;

  useEffect(() => {
    const current = instance.getActiveAccount?.();
    const fallback = accounts?.[0] || instance.getAllAccounts?.()?.[0] || null;
    if (!current && fallback) instance.setActiveAccount?.(fallback);
  }, [accounts, instance]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route
          path="/dashboard"
          element={
            <RequireAuth instance={instance} account={activeAccount} inProgress={inProgress} err={err} setErr={setErr}>
              <DashboardPage instance={instance} account={activeAccount} setErr={setErr} forceRerender={forceRerender} />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
