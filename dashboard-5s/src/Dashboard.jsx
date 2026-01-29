import React, { useEffect, useMemo, useState } from "react";
import {
  acquireAccessToken,
  graphGetBlob,
  graphGetJson,
  graphMePhotoUrl,
  graphMeUrl,
  graphMyDriveChildrenUrl,
  graphMyEventsUrl,
  graphMyMessagesUrl,
  graphScopes,
} from "./graph.js";

function Card({ title, subtitle, actions, children }) {
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
          <div style={{ fontWeight: 700 }}>{title}</div>
          {subtitle ? <div style={{ fontSize: 12, color: "rgba(0,0,0,0.65)" }}>{subtitle}</div> : null}
        </div>
        {actions ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{actions}</div> : null}
      </div>
      <div style={{ marginTop: 12 }}>{children}</div>
    </section>
  );
}

function ErrorBox({ message }) {
  if (!message) return null;
  return (
    <pre
      style={{
        whiteSpace: "pre-wrap",
        margin: 0,
        background: "#ffecec",
        color: "#a40000",
        padding: 10,
        borderRadius: 8,
      }}
    >
      {message}
    </pre>
  );
}

function SmallList({ items, renderItem }) {
  if (!items?.length) return <div style={{ color: "rgba(0,0,0,0.65)" }}>Tidak ada data.</div>;
  return (
    <ul style={{ margin: 0, paddingLeft: 18 }}>
      {items.map((item) => (
        <li key={item.id || JSON.stringify(item)} style={{ marginBottom: 6 }}>
          {renderItem(item)}
        </li>
      ))}
    </ul>
  );
}

function Table({ columns, rows }) {
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
                }}
              >
                {c.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={row.id || idx}>
              {columns.map((c) => (
                <td
                  key={c.key}
                  style={{
                    padding: "10px 8px",
                    borderBottom: "1px solid rgba(0,0,0,0.06)",
                    verticalAlign: "top",
                    fontSize: 13,
                  }}
                >
                  {c.render ? c.render(row) : row?.[c.key] ?? ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FieldsTable({ title, fields, data }) {
  const rows = fields.map((f) => {
    const raw = typeof f.get === "function" ? f.get(data) : data?.[f.key];
    const value = raw === undefined || raw === null || raw === "" ? "-" : String(raw);
    return { id: f.key, field: f.label || f.key, value };
  });

  return (
    <div>
      {title ? <div style={{ fontWeight: 700, marginBottom: 8 }}>{title}</div> : null}
      <Table
        columns={[
          { key: "field", title: "Kolom" },
          { key: "value", title: "Nilai" },
        ]}
        rows={rows}
      />
    </div>
  );
}

export default function Dashboard({ instance, account }) {
  const [profile, setProfile] = useState({ loading: false, error: "", data: null });
  const [photo, setPhoto] = useState({ loading: false, error: "", url: "" });
  const [messages, setMessages] = useState({ loading: false, error: "", data: null });
  const [events, setEvents] = useState({ loading: false, error: "", data: null });
  const [files, setFiles] = useState({ loading: false, error: "", data: null });

  const userLabel = useMemo(() => {
    const name = account?.name || "";
    const username = account?.username || "";
    return name && username ? `${name} (${username})` : name || username || "User";
  }, [account]);

  useEffect(() => {
    // Load profile by default so dashboard doesn't look empty.
    void loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.homeAccountId]);

  useEffect(() => {
    return () => {
      if (photo.url) URL.revokeObjectURL(photo.url);
    };
  }, [photo.url]);

  const loadProfile = async () => {
    try {
      setProfile({ loading: true, error: "", data: null });
      const accessToken = await acquireAccessToken({
        instance,
        account,
        scopes: graphScopes.profile,
      });
      const data = await graphGetJson({ accessToken, url: graphMeUrl() });
      setProfile({ loading: false, error: "", data });
    } catch (e) {
      setProfile({ loading: false, error: e?.message || String(e), data: null });
    }
  };

  const loadPhoto = async () => {
    try {
      setPhoto((s) => ({ ...s, loading: true, error: "" }));
      const accessToken = await acquireAccessToken({
        instance,
        account,
        scopes: graphScopes.photo,
      });
      const blob = await graphGetBlob({
        accessToken,
        url: graphMePhotoUrl(),
        accept: "image/*",
      });
      if (photo.url) URL.revokeObjectURL(photo.url);
      const url = URL.createObjectURL(blob);
      setPhoto({ loading: false, error: "", url });
    } catch (e) {
      setPhoto((s) => ({ ...s, loading: false, error: e?.message || String(e) }));
    }
  };

  const loadMessages = async () => {
    try {
      setMessages({ loading: true, error: "", data: null });
      const accessToken = await acquireAccessToken({
        instance,
        account,
        scopes: graphScopes.mail,
      });
      const data = await graphGetJson({ accessToken, url: graphMyMessagesUrl() });
      setMessages({ loading: false, error: "", data });
    } catch (e) {
      setMessages({ loading: false, error: e?.message || String(e), data: null });
    }
  };

  const loadEvents = async () => {
    try {
      setEvents({ loading: true, error: "", data: null });
      const accessToken = await acquireAccessToken({
        instance,
        account,
        scopes: graphScopes.calendar,
      });
      const data = await graphGetJson({ accessToken, url: graphMyEventsUrl() });
      setEvents({ loading: false, error: "", data });
    } catch (e) {
      setEvents({ loading: false, error: e?.message || String(e), data: null });
    }
  };

  const loadFiles = async () => {
    try {
      setFiles({ loading: true, error: "", data: null });
      const accessToken = await acquireAccessToken({
        instance,
        account,
        scopes: graphScopes.files,
      });
      const data = await graphGetJson({ accessToken, url: graphMyDriveChildrenUrl() });
      setFiles({ loading: false, error: "", data });
    } catch (e) {
      setFiles({ loading: false, error: e?.message || String(e), data: null });
    }
  };

  const loadAll = async () => {
    await loadProfile();
    // Optional cards may require extra consent; keep them user-triggered.
  };

  return (
    <div>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>Dashboard</div>
          <div style={{ color: "rgba(0,0,0,0.65)", fontSize: 13 }}>
            Login berhasil sebagai {userLabel}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={loadAll} disabled={profile.loading}>
            Refresh
          </button>
        </div>
      </header>

      <div
        style={{
          marginTop: 16,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 12,
        }}
      >
        <Card
          title="Profil"
          subtitle="Microsoft Graph: /me (scope: User.Read)"
          actions={
            <button onClick={loadProfile} disabled={profile.loading}>
              {profile.loading ? "Loading..." : "Load"}
            </button>
          }
        >
          <ErrorBox message={profile.error} />
          <FieldsTable
            title="Kolom profil yang ditampilkan"
            fields={[
              { key: "displayName", label: "displayName" },
              { key: "mail", label: "mail" },
              { key: "userPrincipalName", label: "userPrincipalName" },
              { key: "jobTitle", label: "jobTitle" },
              { key: "officeLocation", label: "officeLocation" },
              { key: "preferredLanguage", label: "preferredLanguage" },
              { key: "id", label: "id" },
            ]}
            data={profile.data || {}}
          />
        </Card>

        <Card
          title="Foto"
          subtitle="Microsoft Graph: /me/photo/$value (scope: User.Read)"
          actions={
            <button onClick={loadPhoto} disabled={photo.loading}>
              {photo.loading ? "Loading..." : "Load"}
            </button>
          }
        >
          <ErrorBox message={photo.error} />
          {photo.url ? (
            <img
              src={photo.url}
              alt="Profile"
              style={{ width: 112, height: 112, objectFit: "cover", borderRadius: 12, border: "1px solid rgba(0,0,0,0.12)" }}
            />
          ) : (
            <div style={{ color: "rgba(0,0,0,0.65)" }}>Klik Load untuk ambil foto (kalau ada).</div>
          )}
        </Card>

        <Card
          title="Email Terbaru"
          subtitle="Microsoft Graph: /me/messages (scope: Mail.Read)"
          actions={
            <button onClick={loadMessages} disabled={messages.loading}>
              {messages.loading ? "Loading..." : "Load"}
            </button>
          }
        >
          <ErrorBox message={messages.error} />
          <div style={{ color: "rgba(0,0,0,0.65)", fontSize: 12, marginBottom: 8 }}>
            Kolom: subject, from, receivedDateTime
          </div>
          {messages.data ? (
            <Table
              columns={[
                { key: "subject", title: "Subject", render: (m) => m.subject || "(No subject)" },
                {
                  key: "from",
                  title: "From",
                  render: (m) => m.from?.emailAddress?.name || m.from?.emailAddress?.address || "-",
                },
                {
                  key: "receivedDateTime",
                  title: "Received",
                  render: (m) => (m.receivedDateTime ? new Date(m.receivedDateTime).toLocaleString() : "-"),
                },
              ]}
              rows={messages.data.value || []}
            />
          ) : (
            <div style={{ color: "rgba(0,0,0,0.65)" }}>Klik Load (akan minta consent Mail.Read).</div>
          )}
        </Card>

        <Card
          title="Kalender"
          subtitle="Microsoft Graph: /me/events (scope: Calendars.Read)"
          actions={
            <button onClick={loadEvents} disabled={events.loading}>
              {events.loading ? "Loading..." : "Load"}
            </button>
          }
        >
          <ErrorBox message={events.error} />
          <div style={{ color: "rgba(0,0,0,0.65)", fontSize: 12, marginBottom: 8 }}>
            Kolom: subject, start, end
          </div>
          {events.data ? (
            <Table
              columns={[
                { key: "subject", title: "Subject", render: (ev) => ev.subject || "(No subject)" },
                {
                  key: "start",
                  title: "Start",
                  render: (ev) => (ev.start?.dateTime ? new Date(ev.start.dateTime).toLocaleString() : "-"),
                },
                {
                  key: "end",
                  title: "End",
                  render: (ev) => (ev.end?.dateTime ? new Date(ev.end.dateTime).toLocaleString() : "-"),
                },
              ]}
              rows={events.data.value || []}
            />
          ) : (
            <div style={{ color: "rgba(0,0,0,0.65)" }}>Klik Load (akan minta consent Calendars.Read).</div>
          )}
        </Card>

        <Card
          title="OneDrive (Root)"
          subtitle="Microsoft Graph: /me/drive/root/children (scope: Files.Read)"
          actions={
            <button onClick={loadFiles} disabled={files.loading}>
              {files.loading ? "Loading..." : "Load"}
            </button>
          }
        >
          <ErrorBox message={files.error} />
          <div style={{ color: "rgba(0,0,0,0.65)", fontSize: 12, marginBottom: 8 }}>
            Kolom: name, size, lastModifiedDateTime, webUrl
          </div>
          {files.data ? (
            <Table
              columns={[
                { key: "name", title: "Name", render: (f) => f.name || "(No name)" },
                {
                  key: "size",
                  title: "Size",
                  render: (f) => (typeof f.size === "number" ? `${(f.size / 1024).toFixed(0)} KB` : "-"),
                },
                {
                  key: "lastModifiedDateTime",
                  title: "Modified",
                  render: (f) => (f.lastModifiedDateTime ? new Date(f.lastModifiedDateTime).toLocaleString() : "-"),
                },
                {
                  key: "webUrl",
                  title: "Link",
                  render: (f) =>
                    f.webUrl ? (
                      <a href={f.webUrl} target="_blank" rel="noreferrer">
                        Open
                      </a>
                    ) : (
                      "-"
                    ),
                },
              ]}
              rows={files.data.value || []}
            />
          ) : (
            <div style={{ color: "rgba(0,0,0,0.65)" }}>Klik Load (akan minta consent Files.Read).</div>
          )}
        </Card>
      </div>
    </div>
  );
}
