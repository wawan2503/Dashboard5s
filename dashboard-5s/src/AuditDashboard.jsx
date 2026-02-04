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
  let bestSuffixDigitsKey = null;
  let bestSuffixDigitsLen = Infinity;
  for (const k of Object.keys(fieldsObj)) {
    const nk = normalizeKey(k);
    if (nk === desired) return fieldsObj[k];

    // Fallback: SharePoint internal names can get suffixed when duplicated (e.g. "Audit_x0020_Score0").
    // If the suffix is digits-only, treat it as a match candidate.
    if (nk.startsWith(desired)) {
      const suffix = nk.slice(desired.length);
      if (suffix && /^\d+$/.test(suffix) && suffix.length < bestSuffixDigitsLen) {
        bestSuffixDigitsKey = k;
        bestSuffixDigitsLen = suffix.length;
      }
    }
  }

  if (bestSuffixDigitsKey) return fieldsObj[bestSuffixDigitsKey];

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

function Card({ id, title, subtitle, right, children }) {
  return (
    <section
      id={id}
      style={{
        background: "#fff",
        border: "1px solid rgba(15, 23, 42, 0.08)",
        borderRadius: 12,
        padding: 16,
        boxShadow: "0 10px 24px rgba(15, 23, 42, 0.06)",
        overflow: "hidden",
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

const CHART_COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#ef4444", "#9333ea", "#14b8a6", "#f97316", "#64748b"];

function colorFromLabel(label) {
  const s = String(label || "");
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return CHART_COLORS[h % CHART_COLORS.length];
}

function toNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) return value.length ? toNumber(value[0]) : null;
  if (typeof value === "object") {
    // Some SharePoint field types can come back as objects (e.g., lookup/calculated-like shapes).
    if ("value" in value) return toNumber(value.value);
    return null;
  }
  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return null;

    // Fast path: plain number string.
    const direct = Number(s);
    if (Number.isFinite(direct)) return direct;

    // Locale-ish handling: "4,5" or "1.234,56"
    if (s.includes(",") && !s.includes(".")) {
      const n = Number(s.replace(",", "."));
      if (Number.isFinite(n)) return n;
    } else if (s.includes(",") && s.includes(".")) {
      // Assume dot thousand separator + comma decimal.
      const n = Number(s.replace(/\./g, "").replace(",", "."));
      if (Number.isFinite(n)) return n;
    }

    // Tolerant: extract first number from strings like "4 - Good", "Score: 3", etc.
    const m = s.match(/-?\d+(?:[.,]\d+)?/);
    if (m) {
      let token = m[0];
      if (token.includes(",") && !token.includes(".")) token = token.replace(",", ".");
      else if (token.includes(",") && token.includes(".")) token = token.replace(/\./g, "").replace(",", ".");
      const n = Number(token);
      if (Number.isFinite(n)) return n;
    }

    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

function localDateKey(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function dateKeyForTrend(value) {
  if (!value) return "";

  if (typeof value === "string") {
    const s = value.trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
    if (m && !s.includes("T")) {
      // Treat date-only strings as local calendar dates (avoid JS parsing as UTC).
      return `${m[1]}-${m[2]}-${m[3]}`;
    }
  }

  const d = toDate(value);
  return d ? localDateKey(d) : "";
}

function parseLocalDateOnly(value) {
  if (!value) return null;
  if (value instanceof Date) {
    const d = new Date(value);
    d.setHours(0, 0, 0, 0);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const s = String(value).trim();
  if (!s) return null;

  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const yyyy = Number(m[1]);
    const mm = Number(m[2]);
    const dd = Number(m[3]);
    const d = new Date(yyyy, mm - 1, dd);
    d.setHours(0, 0, 0, 0);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

function diffDaysLocal(a, b) {
  if (!a || !b) return null;
  const ms = a.getTime() - b.getTime();
  return Math.round(ms / 86400000);
}

function normalizeAuditStatus(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  if (/closed|done/i.test(s)) return "Closed";
  if (/open/i.test(s)) return "Open";
  if (/progress/i.test(s)) return "In Progress";
  return s;
}

function normalizeValidation(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  if (/^(ok|yes|y)$/i.test(s)) return "OK";
  if (/^(ng|no|n)$/i.test(s)) return "NG";
  return s;
}

function normalizeFollowUpStage({ planDate, doneDate }) {
  if (doneDate) return "Completed";
  if (!planDate) return "No Plan";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (planDate.getTime() < today.getTime()) return "Overdue";
  return "On Track";
}

function buildStackedCountsBy(rows, getGroupLabel, getSegmentLabel, options = {}) {
  const maxGroups = typeof options.maxGroups === "number" ? options.maxGroups : 8;
  const segmentOrder = Array.isArray(options.segmentOrder) ? options.segmentOrder : null;

  const groupMap = new Map(); // group -> Map(segment -> count)
  for (const r of rows) {
    const group = String(getGroupLabel(r) || "").trim();
    if (!group) continue;
    const seg = String(getSegmentLabel(r) || "").trim();
    if (!seg) continue;

    const segMap = groupMap.get(group) || new Map();
    segMap.set(seg, (segMap.get(seg) || 0) + 1);
    groupMap.set(group, segMap);
  }

  const groups = Array.from(groupMap.entries()).map(([label, segMap]) => {
    const segments = Array.from(segMap.entries()).map(([sLabel, value]) => ({ label: sLabel, value }));
    const total = segments.reduce((sum, it) => sum + it.value, 0);

    let orderedSegments = segments;
    if (segmentOrder) {
      const orderIndex = new Map(segmentOrder.map((s, idx) => [String(s), idx]));
      orderedSegments = segments.slice().sort((a, b) => {
        const ai = orderIndex.has(a.label) ? orderIndex.get(a.label) : 999;
        const bi = orderIndex.has(b.label) ? orderIndex.get(b.label) : 999;
        return ai - bi || b.value - a.value || a.label.localeCompare(b.label);
      });
    } else {
      orderedSegments = segments.slice().sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
    }

    return { label, total, segments: orderedSegments };
  });

  return groups
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label))
    .slice(0, maxGroups);
}

function StackedBarList({ items, colorForSegment, maxItems = 8 }) {
  const top = (items || []).slice(0, maxItems);

  if (!top.length) return <div style={{ color: "rgba(0,0,0,0.65)" }}>Tidak ada data.</div>;

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {top.map((it) => {
        const total = typeof it.total === "number" ? it.total : (it.segments || []).reduce((s, x) => s + (x.value || 0), 0);
        return (
          <div key={it.label} style={{ display: "grid", gap: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
              <div style={{ fontWeight: 700, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={it.label}>
                {it.label}
              </div>
              <div style={{ fontSize: 12, color: "rgba(0,0,0,0.65)" }}>Total: {total}</div>
            </div>

            <div
              style={{
                height: 12,
                borderRadius: 999,
                overflow: "hidden",
                background: "rgba(0,0,0,0.06)",
                display: "flex",
              }}
              aria-label={`stacked-${it.label}`}
            >
              {(it.segments || []).map((s) => {
                const w = total > 0 ? (s.value / total) * 100 : 0;
                const color = typeof colorForSegment === "function" ? colorForSegment(s.label) : colorFromLabel(s.label);
                return (
                  <div
                    key={s.label}
                    title={`${s.label}: ${s.value}`}
                    style={{
                      width: `${w}%`,
                      background: color,
                    }}
                  />
                );
              })}
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 11, color: "rgba(0,0,0,0.65)" }}>
              {(it.segments || []).slice(0, 6).map((s) => {
                const color = typeof colorForSegment === "function" ? colorForSegment(s.label) : colorFromLabel(s.label);
                return (
                  <div key={s.label} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: color, display: "inline-block" }} />
                    <span>
                      {s.label}: {s.value}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function buildCounts(rows, key, normalize) {
  const map = new Map();
  for (const r of rows) {
    const raw = r?.[key];
    const label = normalize ? normalize(raw) : raw;
    const s = String(label || "").trim();
    if (!s) continue;
    map.set(s, (map.get(s) || 0) + 1);
  }
  return Array.from(map.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

function buildAverages(rows, groupKey, valueKey) {
  const acc = new Map(); // label -> { sum, count }
  for (const r of rows) {
    const label = String(r?.[groupKey] || "").trim();
    if (!label) continue;
    const n = toNumber(r?.[valueKey]);
    if (n === null) continue;
    const cur = acc.get(label) || { sum: 0, count: 0 };
    cur.sum += n;
    cur.count += 1;
    acc.set(label, cur);
  }
  return Array.from(acc.entries())
    .map(([label, v]) => ({ label, value: v.count ? v.sum / v.count : 0, count: v.count }))
    .sort((a, b) => b.value - a.value || b.count - a.count || a.label.localeCompare(b.label));
}

function BarList({ items, maxItems = 8, valueFormat }) {
  const top = (items || []).slice(0, maxItems);
  const max = top.reduce((m, it) => Math.max(m, typeof it.value === "number" ? it.value : 0), 0);
  if (top.length === 0) return <div style={{ color: "rgba(0,0,0,0.65)", fontSize: 13 }}>Tidak ada data.</div>;

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {top.map((it, idx) => {
        const pct = max ? Math.max(0, Math.min(1, it.value / max)) : 0;
        const color = CHART_COLORS[idx % CHART_COLORS.length];
        return (
          <div key={it.label} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 84px", gap: 10, alignItems: "center" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12, color: "rgba(0,0,0,0.75)" }}>
                <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.label}</div>
                <div style={{ whiteSpace: "nowrap" }}>{valueFormat ? valueFormat(it) : String(it.value)}</div>
              </div>
              <div style={{ height: 8, background: "rgba(0,0,0,0.06)", borderRadius: 999, overflow: "hidden", marginTop: 6 }}>
                <div style={{ height: 8, width: `${pct * 100}%`, background: color }} />
              </div>
            </div>
            <div style={{ fontSize: 11, color: "rgba(0,0,0,0.55)", textAlign: "right" }}>{it.count ? `${it.count} data` : ""}</div>
          </div>
        );
      })}
    </div>
  );
}

function DonutChart({ items, titleTotal = "Total", colorForLabel }) {
  const safeItems = (items || []).filter((it) => it && typeof it.value === "number" && it.value > 0);
  const total = safeItems.reduce((s, it) => s + it.value, 0);
  if (!total) return <div style={{ color: "rgba(0,0,0,0.65)", fontSize: 13 }}>Tidak ada data.</div>;

  const stops = safeItems.reduce(
    (state, it, idx) => {
      const start = (state.acc / total) * 360;
      const nextAcc = state.acc + it.value;
      const end = (nextAcc / total) * 360;
      const color = typeof colorForLabel === "function" ? colorForLabel(it.label, it, idx) : CHART_COLORS[idx % CHART_COLORS.length];
      return {
        acc: nextAcc,
        list: [...state.list, { ...it, color, stop: `${color} ${start}deg ${end}deg` }],
      };
    },
    { acc: 0, list: [] }
  ).list;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, alignItems: "center" }}>
      <div style={{ display: "grid", placeItems: "center" }}>
        <div
          style={{
            width: 148,
            height: 148,
            borderRadius: "50%",
            background: `conic-gradient(${stops.map((s) => s.stop).join(", ")})`,
            position: "relative",
            border: "1px solid rgba(15, 23, 42, 0.10)",
            boxShadow: "0 12px 28px rgba(15, 23, 42, 0.10)",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 22,
              borderRadius: "50%",
              background: "#fff",
              border: "1px solid rgba(15, 23, 42, 0.08)",
              display: "grid",
              placeItems: "center",
              textAlign: "center",
              padding: 8,
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1 }}>{total}</div>
            <div style={{ fontSize: 11, color: "rgba(0,0,0,0.6)" }}>{titleTotal}</div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 10, alignContent: "start" }}>
        {stops.map((it) => {
          const pct = total ? (it.value / total) * 100 : 0;
          return (
            <div key={it.label} style={{ display: "grid", gap: 6 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: it.color, flex: "0 0 auto" }} />
                  <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(0,0,0,0.82)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {it.label}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "rgba(0,0,0,0.7)", whiteSpace: "nowrap" }}>
                  {it.value} ({pct.toFixed(0)}%)
                </div>
              </div>
              <div style={{ height: 8, background: "rgba(15, 23, 42, 0.06)", borderRadius: 999, overflow: "hidden" }}>
                <div style={{ height: 8, width: `${Math.max(0, Math.min(100, pct))}%`, background: it.color }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Sparkline({ values }) {
  const v = Array.isArray(values) ? values : [];
  const n = v.length;
  const max = v.reduce((m, x) => Math.max(m, x), 0);
  if (n < 2 || max <= 0) {
    return (
      <div style={{ height: 48, display: "grid", placeItems: "center", color: "rgba(0,0,0,0.65)", fontSize: 13 }}>
        Tidak ada trend.
      </div>
    );
  }

  const points = v
    .map((x, i) => {
      const px = (i / (n - 1)) * 100;
      const py = 30 - (x / max) * 26 - 2;
      return `${px.toFixed(2)},${py.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg viewBox="0 0 100 30" width="100%" height="48" aria-hidden="true">
      <polyline fill="none" stroke="rgba(37,99,235,0.18)" strokeWidth="10" points={points} strokeLinejoin="round" strokeLinecap="round" />
      <polyline fill="none" stroke="rgba(37,99,235,1)" strokeWidth="2" points={points} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function buildPageItems(currentPage, totalPages) {
  const total = Math.max(1, Number(totalPages) || 1);
  const current = Math.min(Math.max(1, Number(currentPage) || 1), total);

  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const siblings = 2;
  const left = Math.max(2, current - siblings);
  const right = Math.min(total - 1, current + siblings);

  const items = [1];
  if (left > 2) items.push("...");
  for (let i = left; i <= right; i += 1) items.push(i);
  if (right < total - 1) items.push("...");
  items.push(total);
  return items;
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

export default function AuditDashboard({ source = "sample", listItems, onLogout }) {
  // `listItems` can be:
  // - already mapped rows: [{ id, Title, Area, ... }]
  // - Graph list items: [{ id, fields: {...} }]
  const [selected, setSelected] = useState(null);
  const [showTable, setShowTable] = useState(false);
  const [view, setView] = useState("audit");
  const [search, setSearch] = useState("");
  const [area, setArea] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const openTable = () => {
    setShowTable(true);
    setPage(1);
  };

  const closeTable = () => {
    setShowTable(false);
    setSearch("");
    setArea("");
    setCategory("");
    setStatus("");
    setPage(1);
  };

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
      const categoryOk = !category || String(r["5S Category"] || "").toLowerCase() === category.toLowerCase();
      const statusOk = !status || String(r["Audit Status"] || "").toLowerCase() === status.toLowerCase();
      if (!areaOk || !categoryOk || !statusOk) return false;
      if (!s) return true;

      const hay = [r.Title, r.Area, r["Sub Area"], r["5S"], r["5S Category"], r["5S Item"], r.Auditor, r.Auditee, r.Approvers]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(s);
    });
  }, [area, baseRows, category, search, status]);

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

  const distinctCategories = useMemo(() => {
    const set = new Set();
    for (const r of baseRows) {
      if (r["5S Category"]) set.add(String(r["5S Category"]));
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
          const n = toNumber(v);
          if (n !== null) {
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

      const n = toNumber(r["Audit Score"]);
      if (n !== null) {
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

  const chartAuditStatus = useMemo(() => buildCounts(rows, "Audit Status", normalizeAuditStatus).slice(0, 8), [rows]);
  const chartAreaCounts = useMemo(() => buildCounts(rows, "Area").slice(0, 8), [rows]);
  const chartSubAreaCounts = useMemo(() => buildCounts(rows, "Sub Area").slice(0, 8), [rows]);
  const chartAuditorCounts = useMemo(() => buildCounts(rows, "Auditor").slice(0, 8), [rows]);
  const chart5SCounts = useMemo(() => buildCounts(rows, "5S").slice(0, 8), [rows]);
  const chartValidationCounts = useMemo(() => buildCounts(rows, "5S Validation", normalizeValidation).slice(0, 8), [rows]);
  const chartAvgScoreByArea = useMemo(() => buildAverages(rows, "Area", "Audit Score").slice(0, 8), [rows]);
  const chartAvgScoreBy5S = useMemo(() => buildAverages(rows, "5S", "Audit Score").slice(0, 8), [rows]);
  const chartFollowUpStatus = useMemo(() => buildCounts(rows, "Follow Up Status").slice(0, 8), [rows]);

  const chartAuditStatusByCategory = useMemo(
    () =>
      buildStackedCountsBy(
        rows,
        (r) => r?.["5S Category"],
        (r) => normalizeAuditStatus(r?.["Audit Status"]),
        { maxGroups: 8, segmentOrder: ["Open", "In Progress", "Closed"] }
      ),
    [rows]
  );

  const chartValidationByCategory = useMemo(
    () =>
      buildStackedCountsBy(
        rows,
        (r) => r?.["5S Category"],
        (r) => normalizeValidation(r?.["5S Validation"]),
        { maxGroups: 8, segmentOrder: ["OK", "NG"] }
      ),
    [rows]
  );

  const chartFollowUpStageByCategory = useMemo(
    () =>
      buildStackedCountsBy(
        rows,
        (r) => r?.["5S Category"],
        (r) => {
          const planDate = parseLocalDateOnly(r?.["Follow Up Plan Date"]);
          const doneDate = parseLocalDateOnly(r?.["Follow Up Date"]);
          return normalizeFollowUpStage({ planDate, doneDate });
        },
        { maxGroups: 8, segmentOrder: ["Overdue", "On Track", "Completed", "No Plan"] }
      ),
    [rows]
  );

  const followUpStageCounts = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      const planDate = parseLocalDateOnly(r?.["Follow Up Plan Date"]);
      const doneDate = parseLocalDateOnly(r?.["Follow Up Date"]);
      const stage = normalizeFollowUpStage({ planDate, doneDate });
      map.set(stage, (map.get(stage) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
  }, [rows]);

  const followUpOverdueByArea = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const map = new Map();
    for (const r of rows) {
      const doneDate = parseLocalDateOnly(r?.["Follow Up Date"]);
      if (doneDate) continue;
      const planDate = parseLocalDateOnly(r?.["Follow Up Plan Date"]);
      if (!planDate || planDate.getTime() >= today.getTime()) continue;
      const area = String(r?.Area || "").trim();
      if (!area) continue;
      map.set(area, (map.get(area) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
      .slice(0, 8);
  }, [rows]);

  const followUpAvgDelayByArea = useMemo(() => {
    const acc = new Map(); // area -> { sumDays, count }
    for (const r of rows) {
      const doneDate = parseLocalDateOnly(r?.["Follow Up Date"]);
      if (!doneDate) continue;

      const baseDate = parseLocalDateOnly(r?.["Audit Date"]) || parseLocalDateOnly(r?.Created) || parseLocalDateOnly(r?.Modified);
      if (!baseDate) continue;

      const days = diffDaysLocal(doneDate, baseDate);
      if (days === null) continue;

      const area = String(r?.Area || "").trim();
      if (!area) continue;

      const cur = acc.get(area) || { sum: 0, count: 0 };
      cur.sum += days;
      cur.count += 1;
      acc.set(area, cur);
    }

    return Array.from(acc.entries())
      .map(([label, v]) => ({ label, value: v.count ? v.sum / v.count : 0 }))
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
      .slice(0, 8);
  }, [rows]);

  const followUpCompletedTrend14d = useMemo(() => {
    const byDay = new Map();
    for (const r of rows) {
      const k = dateKeyForTrend(r?.["Follow Up Date"]);
      if (!k) continue;
      byDay.set(k, (byDay.get(k) || 0) + 1);
    }

    const end = new Date();
    end.setHours(0, 0, 0, 0);

    const days = 14;
    const labels = [];
    const values = [];
    for (let i = days - 1; i >= 0; i -= 1) {
      const d = new Date(end);
      d.setDate(end.getDate() - i);
      const k = localDateKey(d);
      labels.push(k);
      values.push(byDay.get(k) || 0);
    }

    const total = values.reduce((s, x) => s + x, 0);
    const max = values.reduce((m, x) => Math.max(m, x), 0);
    const rangeLabel = labels.length ? `${labels[0]} -> ${labels[labels.length - 1]}` : "";

    return { labels, values, total, max, rangeLabel };
  }, [rows]);

  const followUpDueNext14d = useMemo(() => {
    const byDay = new Map();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const r of rows) {
      const doneDate = parseLocalDateOnly(r?.["Follow Up Date"]);
      if (doneDate) continue;

      const planDate = parseLocalDateOnly(r?.["Follow Up Plan Date"]);
      if (!planDate) continue;

      const delta = diffDaysLocal(planDate, today);
      if (delta === null || delta < 0 || delta > 13) continue;

      const k = localDateKey(planDate);
      byDay.set(k, (byDay.get(k) || 0) + 1);
    }

    const days = 14;
    const labels = [];
    const values = [];
    for (let i = 0; i < days; i += 1) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const k = localDateKey(d);
      labels.push(k);
      values.push(byDay.get(k) || 0);
    }

    const total = values.reduce((s, x) => s + x, 0);
    const max = values.reduce((m, x) => Math.max(m, x), 0);
    const rangeLabel = labels.length ? `${labels[0]} -> ${labels[labels.length - 1]}` : "";

    return { labels, values, total, max, rangeLabel };
  }, [rows]);

  const chartTrend14d = useMemo(() => {
    const byDay = new Map();

    for (const r of rows) {
      const k =
        dateKeyForTrend(r?.["Audit Date"]) ||
        dateKeyForTrend(r?.Created) ||
        dateKeyForTrend(r?.Modified);
      if (!k) continue;
      byDay.set(k, (byDay.get(k) || 0) + 1);
    }

    // Always show last 14 days relative to today (not relative to last data date).
    const end = new Date();
    end.setHours(0, 0, 0, 0);

    const days = 14;
    const labels = [];
    const values = [];
    for (let i = days - 1; i >= 0; i -= 1) {
      const d = new Date(end);
      d.setDate(end.getDate() - i);
      const k = localDateKey(d);
      labels.push(k);
      values.push(byDay.get(k) || 0);
    }

    const total = values.reduce((s, x) => s + x, 0);
    const max = values.reduce((m, x) => Math.max(m, x), 0);
    const rangeLabel = labels.length ? `${labels[0]} -> ${labels[labels.length - 1]}` : "";

    return { labels, values, total, max, rangeLabel };
  }, [rows]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(rows.length / pageSize)), [rows.length, pageSize]);
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [currentPage, pageSize, rows]);
  const pageItems = useMemo(() => buildPageItems(currentPage, totalPages), [currentPage, totalPages]);

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

      <div className="audit-layout" style={{ marginTop: 12 }}>
        <aside className="audit-side">
          <div style={{ fontWeight: 800 }}>Kategori</div>
          <div style={{ display: "grid", gap: 8 }}>
            <button className={`nav-btn ${view === "audit" ? "nav-btn--active" : ""}`} type="button" onClick={() => setView("audit")}>
              Audit
            </button>
            <button className={`nav-btn ${view === "score" ? "nav-btn--active" : ""}`} type="button" onClick={() => setView("score")}>
              Skor
            </button>
            <button className={`nav-btn ${view === "followup" ? "nav-btn--active" : ""}`} type="button" onClick={() => setView("followup")}>
              Follow Up
            </button>
            <button className={`nav-btn ${view === "perCategory" ? "nav-btn--active" : ""}`} type="button" onClick={() => setView("perCategory")}>
              Per Kategori
            </button>
            <button className={`nav-btn ${view === "trend" ? "nav-btn--active" : ""}`} type="button" onClick={() => setView("trend")}>
              Trend
            </button>
            <button className={`nav-btn ${view === "table" ? "nav-btn--active" : ""}`} type="button" onClick={() => setView("table")}>
              Tabel
            </button>
          </div>

          {typeof onLogout === "function" ? (
            <div style={{ marginTop: "auto", paddingTop: 10, borderTop: "1px solid rgba(0,0,0,0.06)" }}>
              <button type="button" onClick={onLogout} style={{ width: "100%" }}>
                Logout Microsoft
              </button>
            </div>
          ) : null}
        </aside>

        <div className="audit-content">
          <div style={{ display: view === "table" ? "none" : "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
            <div style={{ display: view === "audit" ? "contents" : "none" }}>
	        <Card id="sec-audit" title="Grafik: Audit Status" subtitle="Distribusi status (sesuai filter)">
	          <DonutChart
	            items={chartAuditStatus}
	            titleTotal="audit"
	            colorForLabel={(label) => {
	              const s = String(label || "").trim().toLowerCase();
	              if (s === "open") return "#ef4444";
	              if (s === "in progress" || s === "inprogress") return "#f59e0b";
	              if (s === "closed") return "#16a34a";
	              return "#2563eb";
	            }}
	          />
	        </Card>

        <Card title="Grafik: Top Area" subtitle="Jumlah audit per area (sesuai filter)">
          <BarList items={chartAreaCounts} valueFormat={(it) => String(it.value)} />
        </Card>

        <Card title="Grafik: Top Sub Area" subtitle="Jumlah audit per sub area (sesuai filter)">
          <BarList items={chartSubAreaCounts} valueFormat={(it) => String(it.value)} />
        </Card>

        <Card title="Grafik: Top Auditor" subtitle="Jumlah audit per auditor (sesuai filter)">
          <BarList items={chartAuditorCounts} valueFormat={(it) => String(it.value)} />
        </Card>

        <Card title="Grafik: Distribusi 5S" subtitle="Jumlah audit per 5S (sesuai filter)">
          <DonutChart items={chart5SCounts} titleTotal="audit" colorForLabel={colorFromLabel} />
        </Card>

        <Card title="Grafik: Validasi 5S" subtitle="Distribusi OK vs NG (sesuai filter)">
          <DonutChart
            items={chartValidationCounts}
            titleTotal="validasi"
            colorForLabel={(label) => {
              const s = String(label || "").trim().toLowerCase();
              if (s === "ok") return "#16a34a";
              if (s === "ng") return "#ef4444";
              return colorFromLabel(label);
            }}
          />
        </Card>
            </div>

            <div style={{ display: view === "score" ? "contents" : "none" }}>
        <Card id="sec-score" title="Grafik: Avg Score per Area" subtitle="Rata-rata Audit Score (yang punya angka)">
          <BarList items={chartAvgScoreByArea} valueFormat={(it) => it.value.toFixed(2)} />
        </Card>

        <Card title="Grafik: Avg Score per 5S" subtitle="Rata-rata Audit Score per 5S (yang punya angka)">
          <BarList items={chartAvgScoreBy5S} valueFormat={(it) => it.value.toFixed(2)} />
        </Card>
            </div>

            <div style={{ display: view === "followup" ? "contents" : "none" }}>
        <Card id="sec-followup" title="Grafik Follow Up: Status" subtitle="Distribusi Follow Up Status (sesuai filter)">
          <DonutChart items={chartFollowUpStatus} titleTotal="follow up" colorForLabel={colorFromLabel} />
        </Card>

        <Card title="Grafik Follow Up: Tahap" subtitle="Completed / Overdue / On Track / No Plan">
          <DonutChart
            items={followUpStageCounts}
            titleTotal="item"
            colorForLabel={(label) => {
              const s = String(label || "").toLowerCase();
              if (s === "completed") return "#16a34a";
              if (s === "overdue") return "#ef4444";
              if (s === "on track" || s === "ontrack") return "#2563eb";
              if (s === "no plan" || s === "noplan") return "#64748b";
              return colorFromLabel(label);
            }}
          />
        </Card>

        <Card title="Grafik Follow Up: Overdue per Area" subtitle="Jumlah follow up overdue (belum selesai)">
          <BarList items={followUpOverdueByArea} valueFormat={(it) => String(it.value)} />
        </Card>

        <Card title="Grafik Follow Up: Avg Durasi per Area" subtitle="Rata-rata hari dari Audit Date -> Follow Up Date">
          <BarList items={followUpAvgDelayByArea} valueFormat={(it) => `${it.value.toFixed(1)} hari`} />
        </Card>

        <Card
          title="Grafik Follow Up: Selesai (Trend)"
          subtitle={followUpCompletedTrend14d.rangeLabel ? `14 hari: ${followUpCompletedTrend14d.rangeLabel}` : "14 hari terakhir"}
          right={<Pill text={`Total 14d: ${followUpCompletedTrend14d.total}`} />}
        >
          <Sparkline values={followUpCompletedTrend14d.values} />
          <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12, color: "rgba(0,0,0,0.65)" }}>
            <div>Max/day: {followUpCompletedTrend14d.max}</div>
            <div>Last day: {followUpCompletedTrend14d.values?.[followUpCompletedTrend14d.values.length - 1] ?? 0}</div>
          </div>
        </Card>

        <Card
          title="Grafik Follow Up: Jatuh Tempo (Next)"
          subtitle={followUpDueNext14d.rangeLabel ? `14 hari: ${followUpDueNext14d.rangeLabel}` : "14 hari ke depan"}
          right={<Pill text={`Total: ${followUpDueNext14d.total}`} />}
        >
          <Sparkline values={followUpDueNext14d.values} />
          <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12, color: "rgba(0,0,0,0.65)" }}>
            <div>Max/day: {followUpDueNext14d.max}</div>
            <div>Today: {followUpDueNext14d.values?.[0] ?? 0}</div>
          </div>
        </Card>
            </div>

            <div style={{ display: view === "perCategory" ? "contents" : "none" }}>
        <Card id="sec-percategory" title="Grafik per Kategori: Audit Status" subtitle="Breakdown status per 5S Category (Top 8)">
          <StackedBarList
            items={chartAuditStatusByCategory}
            colorForSegment={(label) => {
              const s = String(label || "").trim().toLowerCase();
              if (s === "open") return "#ef4444";
              if (s === "in progress" || s === "inprogress") return "#f59e0b";
              if (s === "closed") return "#16a34a";
              return "#2563eb";
            }}
          />
        </Card>

        <Card title="Grafik per Kategori: Validasi 5S" subtitle="Breakdown OK/NG per 5S Category (Top 8)">
          <StackedBarList
            items={chartValidationByCategory}
            colorForSegment={(label) => {
              const s = String(label || "").trim().toLowerCase();
              if (s === "ok") return "#16a34a";
              if (s === "ng") return "#ef4444";
              return colorFromLabel(label);
            }}
          />
        </Card>

        <Card title="Grafik per Kategori: Follow Up Tahap" subtitle="Overdue/On Track/Completed/No Plan per 5S Category (Top 8)">
          <StackedBarList
            items={chartFollowUpStageByCategory}
            colorForSegment={(label) => {
              const s = String(label || "").toLowerCase();
              if (s === "completed") return "#16a34a";
              if (s === "overdue") return "#ef4444";
              if (s === "on track" || s === "ontrack") return "#2563eb";
              if (s === "no plan" || s === "noplan") return "#64748b";
              return colorFromLabel(label);
            }}
          />
        </Card>
            </div>

            <div style={{ display: view === "trend" ? "contents" : "none" }}>
        <Card id="sec-trend"
          title="Grafik: Trend Audit"
          subtitle={chartTrend14d.rangeLabel ? `14 hari: ${chartTrend14d.rangeLabel}` : "14 hari terakhir"}
          right={<Pill text={`Total 14d: ${chartTrend14d.total}`} />}
        >
          <Sparkline values={chartTrend14d.values} />
          <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12, color: "rgba(0,0,0,0.65)" }}>
            <div>Max/day: {chartTrend14d.max}</div>
            <div>Last day: {chartTrend14d.values?.[chartTrend14d.values.length - 1] ?? 0}</div>
          </div>
        </Card>
            </div>
      </div>

      <div style={{ marginTop: 12, display: view === "table" ? "block" : "none" }}>
        <Card id="sec-table"
          title="Tabel Audit"
          subtitle={showTable ? `Menampilkan ${rows.length} baris • 50 baris/halaman` : "Klik tombol untuk tampilkan tabel"}
          right={
            showTable ? <button onClick={closeTable}>Sembunyikan</button> : <button onClick={openTable}>Tampilkan</button>
          }
        >
          {showTable ? (
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
                <label style={{ display: "grid", gap: 6, flex: "1 1 280px" }}>
                  <div style={{ fontSize: 12, color: "rgba(0,0,0,0.7)" }}>Search</div>
                  <input
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Cari Title/Area/Sub Area/Item/Auditor..."
                    style={{
                      border: "1px solid rgba(0,0,0,0.12)",
                      borderRadius: 10,
                      padding: "10px 12px",
                      fontSize: 14,
                      outline: "none",
                      width: "100%",
                    }}
                  />
                </label>

                <label style={{ display: "grid", gap: 6, flex: "0 1 220px" }}>
                  <div style={{ fontSize: 12, color: "rgba(0,0,0,0.7)" }}>Area</div>
                  <select
                    value={area}
                    onChange={(e) => {
                      setArea(e.target.value);
                      setPage(1);
                    }}
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

                <label style={{ display: "grid", gap: 6, flex: "0 1 220px" }}>
                  <div style={{ fontSize: 12, color: "rgba(0,0,0,0.7)" }}>5S Category</div>
                  <select
                    value={category}
                    onChange={(e) => {
                      setCategory(e.target.value);
                      setPage(1);
                    }}
                    style={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: 10, padding: "10px 12px" }}
                  >
                    <option value="">All</option>
                    {distinctCategories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={{ display: "grid", gap: 6, flex: "0 1 220px" }}>
                  <div style={{ fontSize: 12, color: "rgba(0,0,0,0.7)" }}>Audit Status</div>
                  <select
                    value={status}
                    onChange={(e) => {
                      setStatus(e.target.value);
                      setPage(1);
                    }}
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

                <button
                  onClick={() => {
                    setSearch("");
                    setArea("");
                    setStatus("");
                    setPage(1);
                  }}
                >
                  Reset
                </button>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ fontSize: 12, color: "rgba(0,0,0,0.65)" }}>
                  Halaman {currentPage}/{totalPages} - Total {rows.length} baris
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1}>
                    Prev
                  </button>
                  {pageItems.map((it, idx) =>
                    it === "..." ? (
                      <span key={`dots-${idx}`} style={{ fontSize: 12, color: "rgba(0,0,0,0.55)", padding: "0 4px" }}>
                        ...
                      </span>
                    ) : (
                      <button
                        key={it}
                        onClick={() => setPage(it)}
                        style={
                          it === currentPage
                            ? { background: "rgba(37, 99, 235, 0.12)", borderColor: "rgba(37, 99, 235, 0.35)" }
                            : undefined
                        }
                        aria-current={it === currentPage ? "page" : undefined}
                      >
                        {it}
                      </button>
                    )
                  )}
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>
                    Next
                  </button>
                </div>
              </div>

              <Table columns={columns} rows={pagedRows} onRowClick={(r) => setSelected(r)} />
            </div>
          ) : (
            <div style={{ fontSize: 13, color: "rgba(0,0,0,0.65)" }}>
              Tabel disembunyikan agar dashboard lebih ringkas.
            </div>
          )}
        </Card>
      </div>
        </div>
      </div>

      <DetailPanel row={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
