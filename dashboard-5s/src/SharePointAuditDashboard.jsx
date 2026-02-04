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

async function fetchAllListItems({ instance, account, hostname, sitePath, listId, pageSize = 200, maxPages = 20, onTokenScopes }) {
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

function isMeaningfulValue(v) {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim() !== "";
  return true;
}

function getFieldValue(fieldsObj, label, fieldMap) {
  if (!fieldsObj) return "";

  const alias = fieldMap?.[label];
  const candidates = Array.isArray(alias) ? alias : alias ? [alias] : [];
  for (const k of candidates) {
    if (k in fieldsObj && isMeaningfulValue(fieldsObj[k])) return fieldsObj[k];
  }

  const desired = normalizeKey(label);
  for (const k of Object.keys(fieldsObj)) {
    if (normalizeKey(k) === desired) return fieldsObj[k];
  }

  if (label in fieldsObj) return fieldsObj[label];
  return "";
}

function mapGraphItemsToRows(items, fieldMap) {
  return (items || []).map((item) => {
    const fields = item?.fields && typeof item.fields === "object" ? item.fields : null;
    if (!fields) return item;
    const row = { id: item.id };
    row.Title = getFieldValue(fields, "Title", fieldMap);
    for (const f of AUDIT_FIELDS) row[f] = getFieldValue(fields, f, fieldMap);
    return row;
  });
}

export default function SharePointAuditDashboard({ instance, account }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [siteId, setSiteId] = useState("");
  const [items, setItems] = useState(null);
  const [tokenScopes, setTokenScopes] = useState("");

  const config = useMemo(() => sharepointListConfig, []);
  const rows = useMemo(() => mapGraphItemsToRows(items || [], config.fieldMap), [config.fieldMap, items]);

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
      const msg = e?.message || String(e);
      // acquireAccessToken() triggers redirect and throws; avoid flashing error.
      if (/redirecting/i.test(msg)) return;
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Auto-load when account changes.
    setError("");
    setSiteId("");
    setItems(null);
    setTokenScopes("");
    if (account) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.homeAccountId]);

  return (
    <div>
      {error ? (
        <pre style={{ whiteSpace: "pre-wrap", margin: "0 0 12px 0", background: "#ffecec", color: "#a40000", padding: 10, borderRadius: 10 }}>
          {error}
        </pre>
      ) : null}

      {loading ? (
        <div style={{ marginBottom: 12, fontSize: 13, color: "rgba(0,0,0,0.65)" }}>Mengambil data SharePoint...</div>
      ) : null}

      <AuditDashboard source={`sharepoint-list:${siteId || config.listId}`} listItems={rows} />
      {tokenScopes ? (
        <div style={{ marginTop: 10, fontSize: 11, color: "rgba(0,0,0,0.5)" }}>Token scopes: {tokenScopes}</div>
      ) : null}
    </div>
  );
}
