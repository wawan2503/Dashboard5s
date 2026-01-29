import React, { useEffect, useMemo, useState } from "react";
import AuditDashboard from "./AuditDashboard.jsx";
import { AUDIT_FIELDS } from "./auditFields.js";
import { sharepointListConfig } from "./sharepointListConfig.js";
import { acquireAccessToken, graphGetJson, graphListItemsUrl, graphScopes, graphSiteByPathUrl } from "./graph.js";

function decodeJwtClaim(token, claimName) {
  try {
    const parts = String(token).split(".");
    if (parts.length < 2) return "";
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join("")
    );
    const payload = JSON.parse(json);
    const v = payload?.[claimName];
    return v === undefined || v === null ? "" : String(v);
  } catch {
    return "";
  }
}

function Card({ title, children }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid rgba(0,0,0,0.08)",
        borderRadius: 12,
        padding: 16,
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        marginBottom: 12,
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

async function fetchAllListItems({
  instance,
  account,
  hostname,
  sitePath,
  listId,
  pageSize = 200,
  maxPages = 20,
  onTokenScopes,
}) {
  const accessToken = await acquireAccessToken({
    instance,
    account,
    scopes: graphScopes.sharepoint,
    redirectHintKey: "sp:autoload",
    onToken: (tokenResponse) => {
      const scp = typeof tokenResponse?.accessToken === "string" ? decodeJwtClaim(tokenResponse.accessToken, "scp") : "";
      const scopes = Array.isArray(tokenResponse?.scopes) ? tokenResponse.scopes.join(" ") : "";
      if (typeof onTokenScopes === "function") onTokenScopes(scp || scopes || "");
    },
  });

  const site = await graphGetJson({
    accessToken,
    url: graphSiteByPathUrl(hostname, sitePath),
  });

  const siteId = site?.id;
  if (!siteId) throw new Error("Tidak bisa mendapatkan siteId dari Graph.");

  const items = [];
  let nextUrl = graphListItemsUrl(siteId, listId, pageSize);

  for (let i = 0; i < maxPages && nextUrl; i += 1) {
    const page = await graphGetJson({ accessToken, url: nextUrl });
    if (Array.isArray(page?.value)) items.push(...page.value);
    nextUrl = page?.["@odata.nextLink"] || null;
  }

  return { siteId, items };
}

function decodeSharePointKey(key) {
  return String(key).replace(/_x([0-9A-Fa-f]{4})_/g, (_, hex) => {
    const codePoint = Number.parseInt(hex, 16);
    if (Number.isNaN(codePoint)) return _;
    return String.fromCharCode(codePoint);
  });
}

function normalizeKey(key) {
  return decodeSharePointKey(key)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function getAnyFieldValue(fieldsObj, desiredLabel) {
  if (!fieldsObj) return "";
  const desired = normalizeKey(desiredLabel);
  for (const k of Object.keys(fieldsObj)) {
    if (normalizeKey(k) === desired) return fieldsObj[k];
  }
  if (desiredLabel in fieldsObj) return fieldsObj[desiredLabel];
  return "";
}

function mapGraphItemsToRows(items) {
  return (items || []).map((item) => {
    const fields = item?.fields && typeof item.fields === "object" ? item.fields : null;
    if (!fields) return item;
    const row = { id: item.id };
    row.Title = getAnyFieldValue(fields, "Title");
    for (const f of AUDIT_FIELDS) row[f] = getAnyFieldValue(fields, f);
    return row;
  });
}

function valueToSearchText(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function rowMatchesUser(row, needles) {
  const fieldsToCheck = ["Created By", "Modified By", "Auditor", "Auditee", "Auditee2", "Add Auditee", "Approval Creator", "Approvers"];
  const hay = fieldsToCheck
    .map((k) => valueToSearchText(row?.[k]))
    .join(" ")
    .toLowerCase();
  return needles.some((n) => n && hay.includes(n));
}

export default function SharePointAuditDashboard({ instance, account }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [siteId, setSiteId] = useState("");
  const [items, setItems] = useState(null);
  const [onlyMine, setOnlyMine] = useState(true);
  const [tokenScopes, setTokenScopes] = useState("");

  const config = useMemo(() => sharepointListConfig, []);

  const load = async () => {
    try {
      setError("");
      setLoading(true);
      const res = await fetchAllListItems({
        instance,
        account,
        hostname: config.hostname,
        sitePath: config.sitePath,
        listId: config.listId,
        onTokenScopes: setTokenScopes,
      });
      setSiteId(res.siteId);
      setItems(res.items);
      try {
        sessionStorage.removeItem("sp:autoload");
      } catch {
        // ignore
      }
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Reset when account changes.
    setError("");
    setSiteId("");
    setItems(null);
    setOnlyMine(true);
    setTokenScopes("");
  }, [account?.homeAccountId]);

  useEffect(() => {
    if (!account) return;
    if (items !== null) return;
    try {
      const shouldAuto = sessionStorage.getItem("sp:autoload") === "1";
      if (shouldAuto) void load();
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.homeAccountId, items]);

  const rows = useMemo(() => {
    const mapped = mapGraphItemsToRows(items || []);
    if (!onlyMine) return mapped;

    const needles = [
      account?.username?.toLowerCase(),
      account?.name?.toLowerCase(),
    ].filter(Boolean);

    if (needles.length === 0) return mapped;
    return mapped.filter((r) => rowMatchesUser(r, needles));
  }, [account?.name, account?.username, items, onlyMine]);

  return (
    <div>
      <Card title="SharePoint List Source">
        <div style={{ fontSize: 13, color: "rgba(0,0,0,0.8)", lineHeight: 1.5 }}>
          <div>
            <b>Host:</b> {config.hostname}
          </div>
          <div>
            <b>Site path:</b> /{config.sitePath}
          </div>
          <div>
            <b>List ID:</b> {config.listId}
          </div>
          <div>
            <b>Site ID:</b> {siteId || "-"}
          </div>
          <div>
            <b>Items (total):</b> {Array.isArray(items) ? items.length : "-"}
          </div>
          <div>
            <b>Items (ditampilkan):</b> {Array.isArray(items) ? rows.length : "-"}
          </div>
          <div>
            <b>Token scopes (scp):</b> {tokenScopes || "-"}
          </div>
          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={load} disabled={loading}>
              {loading ? "Loading..." : "Ambil Data SharePoint"}
            </button>
          </div>
          <label style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
            <input
              type="checkbox"
              checked={onlyMine}
              onChange={(e) => setOnlyMine(e.target.checked)}
              disabled={!Array.isArray(items)}
            />
            Hanya data saya (filter by Created By / Auditor / Auditee)
          </label>
          {Array.isArray(items) && items.length > 0 && rows.length === 0 && onlyMine ? (
            <div style={{ marginTop: 10, fontSize: 12, color: "#7a5d00", background: "rgba(241, 196, 15, 0.18)", padding: 10, borderRadius: 10 }}>
              Data ada, tapi filter “Hanya data saya” tidak menemukan kecocokan untuk akun ini. Coba matikan centang untuk melihat semua data.
            </div>
          ) : null}
          {items === null ? (
            <div style={{ marginTop: 10, fontSize: 12, color: "rgba(0,0,0,0.65)" }}>
              Belum ambil data. Klik “Ambil Data SharePoint”. Jika diminta consent <code>Sites.Read.All</code>, setelah kembali ke app akan auto-load lagi.
            </div>
          ) : null}
          <div style={{ marginTop: 10, fontSize: 12, color: "rgba(0,0,0,0.65)" }}>
            Permission yang dipakai: delegated <code>Sites.Read.All</code>. Kalau muncul error admin consent, klik “Grant admin consent” di Azure App Registration.
          </div>
        </div>
      </Card>

      {error ? (
        <Card title="Error">
          <pre style={{ whiteSpace: "pre-wrap", margin: 0, background: "#ffecec", color: "#a40000", padding: 10, borderRadius: 8 }}>
            {error}
          </pre>
        </Card>
      ) : null}

      <AuditDashboard source="sharepoint-list" listItems={items === null ? [] : rows} />
    </div>
  );
}
