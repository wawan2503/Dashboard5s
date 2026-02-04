import React, { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { InteractionStatus } from "@azure/msal-browser";
import { useMsal } from "@azure/msal-react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Dashboard from "./Dashboard.jsx";
import SharePointAuditDashboard from "./SharePointAuditDashboard.jsx";
import { authStorageKeys, loginRequest } from "./authConfig.js";

let inMemoryAutoLoginAttempted = false;

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

  const tryLoginRedirect = useCallback(async () => {
    try {
      setErr?.("");
      setIsRetrying(true);
      await instance.loginRedirect({ ...loginRequest, prompt: "select_account" });
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
    // If the redirect flow fails to produce an account (misconfigured redirect URI, blocked storage, etc),
    // we keep the user on this screen and allow manual retry.
    if (getSessionFlag(authStorageKeys.autoLoginAttempted) === "1") return;

    setSessionFlag(authStorageKeys.autoLoginAttempted, "1");
    void tryLoginRedirect();
  }, [account, inProgress, tryLoginRedirect]);

  if (account) return children;

  return (
    <Container>
      <div style={{ marginTop: 72 }}>
        <Card>
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
        </Card>
      </div>
    </Container>
  );
}

function AppShell({ account, onLogout, children }) {
  const userLabel = useMemo(() => {
    const name = account?.name || "";
    const username = account?.username || "";
    return name && username ? `${name} (${username})` : name || username || "";
  }, [account]);

  return (
    <Container>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.2 }}>Dashboard 5S</div>
          {userLabel ? <div style={{ fontSize: 12, color: "rgba(0,0,0,0.6)" }}>Login sebagai {userLabel}</div> : null}
        </div>
        {account ? (
          <button onClick={onLogout} type="button">
            Logout
          </button>
        ) : null}
      </div>
      {children}
    </Container>
  );
}

function DashboardPage({ instance, account, setErr, forceRerender }) {
  const [tab, setTab] = useState("audit");

  const onLogout = async () => {
    try {
      setErr("");
      setSessionFlag(authStorageKeys.autoLoginAttempted, "0");
      instance.setActiveAccount?.(null);
      forceRerender();
      try {
        localStorage.removeItem(authStorageKeys.loginHint);
      } catch {
        // ignore
      }
      await instance.logoutRedirect({ account });
    } catch (e) {
      setErr(e?.message || String(e));
    }
  };

  return (
    <AppShell account={account} onLogout={onLogout}>
      <Card>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <button onClick={() => setTab("audit")} type="button" disabled={tab === "audit"}>
            Audit 5S (SharePoint)
          </button>
          <button onClick={() => setTab("graph")} type="button" disabled={tab === "graph"}>
            Profil (Graph)
          </button>
        </div>

        {tab === "audit" ? <SharePointAuditDashboard instance={instance} account={account} /> : <Dashboard instance={instance} account={account} />}
      </Card>
    </AppShell>
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
