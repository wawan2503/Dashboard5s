// src/App.jsx
import React, { useEffect, useReducer, useState } from "react";
import { useMsal } from "@azure/msal-react";
import { HashRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import SharePointAuditDashboard from "./SharePointAuditDashboard.jsx";
import { loginRequest, msalConfig } from "./authConfig.js";

function Shell({ children }) {
  return <div style={{ width: "100%", margin: "0 auto" }}>{children}</div>;
}

function RequireAuth({ account, children }) {
  const location = useLocation();
  if (!account) return <Navigate to="/" replace state={{ from: location }} />;
  return children;
}

function LoginPage({ instance, inProgress, err, setErr, account }) {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (account) {
      const target = location.state?.from?.pathname || "/dashboard";
      navigate(target, { replace: true });
    }
  }, [account, location.state, navigate]);

  const goDashboard = () => {
    navigate("/dashboard", { replace: true });
  };

  const login = async () => {
    try {
      setErr("");
      // Redirect keeps auth in the same tab (no popup/new-tab behavior).
      await instance.loginRedirect({ ...loginRequest, prompt: "select_account" });
    } catch (e) {
      setErr(e?.message || String(e));
    }
  };

  return (
    <Shell>
      <div
        style={{
          maxWidth: 520,
          margin: "72px auto",
          background: "#fff",
          border: "1px solid rgba(0,0,0,0.08)",
          borderRadius: 12,
          padding: 20,
          boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Login</h2>
        <p style={{ color: "rgba(0,0,0,0.7)" }}>Silakan login untuk masuk ke halaman dashboard.</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={login} disabled={inProgress === "login" || inProgress === "handleRedirect"}>
            Login
          </button>
          <button onClick={goDashboard} disabled={!account}>
            Masuk Dashboard
          </button>
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: "rgba(0,0,0,0.6)" }}>Status: {String(inProgress)}</div>
        <div style={{ marginTop: 4, fontSize: 12, color: "rgba(0,0,0,0.6)" }}>
          Active account: {account?.username || "-"}
        </div>
        <div style={{ marginTop: 4, fontSize: 12, color: "rgba(0,0,0,0.6)" }}>
          Redirect URI: {msalConfig?.auth?.redirectUri}
        </div>
        <div style={{ marginTop: 4, fontSize: 12, color: "rgba(0,0,0,0.6)" }}>
          Authority: {msalConfig?.auth?.authority}
        </div>

        {err && (
          <pre style={{ marginTop: 12, background: "#ffecec", color: "#a40000", padding: 10, borderRadius: 8 }}>
            {err}
          </pre>
        )}
      </div>
    </Shell>
  );
}

function DashboardPage({ instance, account, setErr, forceRerender }) {
  const navigate = useNavigate();

  const logout = async () => {
    try {
      setErr("");
      instance.setActiveAccount?.(null);
      forceRerender();
      await instance.logoutRedirect({ account });
    } catch (e) {
      setErr(e?.message || String(e));
      navigate("/", { replace: true });
    }
  };

  return (
    <Shell>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button onClick={logout}>Logout</button>
      </div>
      <SharePointAuditDashboard instance={instance} account={account} />
    </Shell>
  );
}

function AppRoutes({ instance, accounts, inProgress, err, setErr, forceRerender }) {
  const active = instance.getActiveAccount?.();
  const any = accounts?.[0] || instance.getAllAccounts?.()?.[0];
  const account = active || any;

  useEffect(() => {
    if (!active && any) instance.setActiveAccount?.(any);
  }, [active, any, instance]);

  return (
    <Routes>
      <Route
        path="/"
        element={
          <LoginPage
            instance={instance}
            inProgress={inProgress}
            err={err}
            setErr={setErr}
            account={account}
          />
        }
      />
      <Route
        path="/dashboard"
        element={
          <RequireAuth account={account}>
            <DashboardPage instance={instance} account={account} setErr={setErr} forceRerender={forceRerender} />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to={account ? "/dashboard" : "/"} replace />} />
    </Routes>
  );
}

export default function App() {
  const { instance, accounts, inProgress } = useMsal();
  const [, forceRerender] = useReducer((x) => x + 1, 0);
  const [err, setErr] = useState("");

  return (
    <HashRouter>
      <AppRoutes
        instance={instance}
        accounts={accounts}
        inProgress={inProgress}
        err={err}
        setErr={setErr}
        forceRerender={forceRerender}
      />
    </HashRouter>
  );
}
