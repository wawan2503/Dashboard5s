import React, { useMemo, useState } from "react";
import { AUDIT_FIELDS } from "./auditFields.js";
import { AUDIT_SAMPLE_ROWS } from "./auditSampleData.js";

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

  // Direct hit by normalized key (fast path).
  for (const k of Object.keys(fieldsObj)) {
    if (normalizeKey(k) === desired) return fieldsObj[k];
  }

  // Fallback: try exact label.
  if (desiredLabel in fieldsObj) return fieldsObj[desiredLabel];

  return "";
}

function formatValue(value) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);

  const s = String(value);
  // Basic ISO date handling
  if (/^\d{4}-\d{2}-\d{2}(t\d{2}:\d{2}:\d{2}(\.\d+)?z?)?$/i.test(s)) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d.toLocaleString();
  }
  return s;
}

function Pill({ text, tone = "neutral" }) {
  const bg =
    tone === "good"
      ? "rgba(46, 204, 113, 0.16)"
      : tone === "bad"
      ? "rgba(231, 76, 60, 0.16)"
      : tone === "warn"
      ? "rgba(241, 196, 15, 0.18)"
      : "rgba(0, 0, 0, 0.06)";
  const fg =
    tone === "good"
      ? "#1e7f46"
      : tone === "bad"
      ? "#a8231a"
      : tone === "warn"
      ? "#7a5d00"
      : "rgba(0,0,0,0.75)";
  return (
    <span style={{ background: bg, color: fg, padding: "2px 8px", borderRadius: 999, fontSize: 12, whiteSpace: "nowrap" }}>
      {text}
    </span>
  );
}

function Card({ title, subtitle, right, children }) {
  return (
    <section
      style={{
        background: "#fff",
        border: "1px solid rgba(0,0,0,0.08)",
        borderRadius: 12,
        padding: 16,
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 800 }}>{title}</div>
          {subtitle ? <div style={{ fontSize: 12, color: "rgba(0,0,0,0.65)" }}>{subtitle}</div> : null}
        </div>
        {right ? <div>{right}</div> : null}
      </div>
      <div style={{ marginTop: 12 }}>{children}</div>
    </section>
  );
}

function Table({ columns, rows, onRowClick }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                style={{
                  textAlign: "left",
                  fontSize: 12,
                  padding: "10px 8px",
                  borderBottom: "1px solid rgba(0,0,0,0.08)",
                  color: "rgba(0,0,0,0.7)",
                  whiteSpace: "nowrap",
                  position: "sticky",
                  top: 0,
                  background: "#fff",
                }}
              >
                {c.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr
              key={row.id || idx}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              style={{ cursor: onRowClick ? "pointer" : "default" }}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  style={{
                    padding: "10px 8px",
                    borderBottom: "1px solid rgba(0,0,0,0.06)",
                    verticalAlign: "top",
                    fontSize: 13,
                    whiteSpace: c.nowrap ? "nowrap" : "normal",
                    maxWidth: c.maxWidth || undefined,
                  }}
                >
                  {c.render ? c.render(row) : formatValue(row[c.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DetailPanel({ row, onClose }) {
  if (!row) return null;
  return (
    <div
      style={{
        position: "fixed",
        right: 16,
        top: 16,
        bottom: 16,
        width: "min(520px, calc(100vw - 32px))",
        background: "#fff",
        border: "1px solid rgba(0,0,0,0.12)",
        borderRadius: 12,
        boxShadow: "0 12px 24px rgba(0,0,0,0.18)",
        padding: 16,
        overflow: "auto",
        zIndex: 10,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>{row.Title || "Detail"}</div>
          <div style={{ fontSize: 12, color: "rgba(0,0,0,0.65)" }}>ID: {row.id || "-"}</div>
        </div>
        <button onClick={onClose}>Tutup</button>
      </div>

      <div style={{ marginTop: 12 }}>
        <Table
          columns={[
            { key: "field", title: "Kolom", nowrap: true, maxWidth: 180 },
            { key: "value", title: "Nilai" },
          ]}
          rows={AUDIT_FIELDS.map((f) => ({ id: f, field: f, value: formatValue(row[f]) }))}
        />
      </div>
    </div>
  );
}

export default function AuditDashboard({ source = "sample", listItems }) {
  // `listItems` can be:
  // - already mapped rows: [{ id, Title, Area, ... }]
  // - Graph list items: [{ id, fields: {...} }]
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [area, setArea] = useState("");
  const [status, setStatus] = useState("");

  const baseRows = useMemo(() => {
    const hasExternal = listItems !== undefined;
    const base = hasExternal
      ? (listItems || []).map((item) => {
          if (item?.fields && typeof item.fields === "object") {
            const mapped = { id: item.id };
            for (const f of AUDIT_FIELDS) mapped[f] = getAnyFieldValue(item.fields, f);
            mapped.Title = getAnyFieldValue(item.fields, "Title");
            return mapped;
          }
          return item;
        })
      : AUDIT_SAMPLE_ROWS;

    return base;
  }, [listItems]);

  const rows = useMemo(() => {
    const base = baseRows;

    const s = search.trim().toLowerCase();
    return base.filter((r) => {
      const areaOk = !area || String(r.Area || "").toLowerCase() === area.toLowerCase();
      const statusOk = !status || String(r["Audit Status"] || "").toLowerCase() === status.toLowerCase();
      if (!areaOk || !statusOk) return false;
      if (!s) return true;

      const hay = [r.Title, r.Area, r["Sub Area"], r["5S"], r["5S Category"], r["5S Item"], r.Auditor, r.Auditee, r.Approvers]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(s);
    });
  }, [area, baseRows, search, status]);

  const distinctAreas = useMemo(() => {
    const set = new Set();
    for (const r of baseRows) {
      if (r.Area) set.add(String(r.Area));
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [baseRows]);

  const distinctStatuses = useMemo(() => {
    const set = new Set();
    for (const r of baseRows) {
      if (r["Audit Status"]) set.add(String(r["Audit Status"]));
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [baseRows]);

  const columns = useMemo(
    () => [
      { key: "Title", title: "Title", maxWidth: 280 },
      { key: "Area", title: "Area", nowrap: true },
      { key: "Sub Area", title: "Sub Area", nowrap: true },
      { key: "5S", title: "5S", nowrap: true },
      { key: "5S Category", title: "5S Category", maxWidth: 200 },
      { key: "5S Item", title: "5S Item", maxWidth: 320 },
      {
        key: "Audit Score",
        title: "Audit Score",
        nowrap: true,
        render: (r) => {
          const v = r["Audit Score"];
          const n = typeof v === "number" ? v : Number(v);
          if (Number.isFinite(n)) {
            const tone = n >= 4 ? "good" : n >= 3 ? "warn" : "bad";
            return <Pill text={String(n)} tone={tone} />;
          }
          return formatValue(v);
        },
      },
      {
        key: "Audit Status",
        title: "Audit Status",
        nowrap: true,
        render: (r) => {
          const s = String(r["Audit Status"] || "");
          const tone = /closed|done/i.test(s) ? "good" : /open/i.test(s) ? "bad" : "warn";
          return s ? <Pill text={s} tone={tone} /> : "-";
        },
      },
      { key: "Follow Up Plan Date", title: "Follow Up Plan Date", nowrap: true, render: (r) => formatValue(r["Follow Up Plan Date"]) },
      { key: "Follow Up Status", title: "Follow Up Status", nowrap: true, render: (r) => formatValue(r["Follow Up Status"]) },
      { key: "Auditor", title: "Auditor", nowrap: true },
      { key: "Audit Date", title: "Audit Date", nowrap: true, render: (r) => formatValue(r["Audit Date"]) },
    ],
    []
  );

  const stats = useMemo(() => {
    let total = 0;
    let open = 0;
    let closed = 0;
    let avgScore = 0;
    let scoreCount = 0;

    for (const r of rows) {
      total += 1;
      const s = String(r["Audit Status"] || "");
      if (/closed|done/i.test(s)) closed += 1;
      else if (s) open += 1;

      const v = r["Audit Score"];
      const n = typeof v === "number" ? v : Number(v);
      if (Number.isFinite(n)) {
        avgScore += n;
        scoreCount += 1;
      }
    }

    return {
      total,
      open,
      closed,
      avgScore: scoreCount ? avgScore / scoreCount : null,
    };
  }, [rows]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900 }}>5S Audit Dashboard</div>
          <div style={{ fontSize: 12, color: "rgba(0,0,0,0.65)" }}>
            Data source: {source === "sample" && listItems === undefined ? "sample (placeholder)" : source}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <Pill text={`Total: ${stats.total}`} />
          <Pill text={`Open: ${stats.open}`} tone={stats.open ? "bad" : "neutral"} />
          <Pill text={`Closed: ${stats.closed}`} tone={stats.closed ? "good" : "neutral"} />
          <Pill text={`Avg Score: ${stats.avgScore === null ? "-" : stats.avgScore.toFixed(2)}`} tone="neutral" />
        </div>
      </div>

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
        <Card
          title="Filter"
          subtitle="Search + Area + Audit Status"
          right={
            <button
              onClick={() => {
                setSearch("");
                setArea("");
                setStatus("");
              }}
            >
              Reset
            </button>
          }
        >
          <div style={{ display: "grid", gap: 10 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12, color: "rgba(0,0,0,0.7)" }}>Search</div>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari Title/Area/Sub Area/Item/Auditor..."
                style={{
                  border: "1px solid rgba(0,0,0,0.12)",
                  borderRadius: 10,
                  padding: "10px 12px",
                  fontSize: 14,
                  outline: "none",
                }}
              />
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, color: "rgba(0,0,0,0.7)" }}>Area</div>
                <select
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  style={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: 10, padding: "10px 12px" }}
                >
                  <option value="">All</option>
                  {distinctAreas.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, color: "rgba(0,0,0,0.7)" }}>Audit Status</div>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  style={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: 10, padding: "10px 12px" }}
                >
                  <option value="">All</option>
                  {distinctStatuses.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div style={{ fontSize: 12, color: "rgba(0,0,0,0.65)" }}>
              Klik baris tabel untuk lihat semua kolom (detail).
            </div>
          </div>
        </Card>

        <Card title="Tabel Audit" subtitle={`Menampilkan ${rows.length} baris`} right={<Pill text="Click row → Detail" />}>
          <Table columns={columns} rows={rows} onRowClick={(r) => setSelected(r)} />
        </Card>
      </div>

      <DetailPanel row={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
