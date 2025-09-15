// src/App.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
} from "firebase/auth";
import { auth } from "./firebase";
import {
  subscribeLeads,
  createLead,
  updateLead,
  deleteLead,
  STATE_TO_TZ,
} from "./services/leads";

/* ---------------- UI Helpers (light iOS/Mac look) ---------------- */

const Pill = ({ active = false, onClick, children, style }) => (
  <button
    onClick={onClick}
    style={{
      padding: "8px 14px",
      borderRadius: 20,
      fontWeight: 600,
      border: `1px solid ${active ? "var(--system-blue)" : "var(--separator)"}`,
      background: active ? "var(--system-blue)" : "var(--material-thin)",
      color: active ? "#fff" : "var(--label)",
      cursor: "pointer",
      transition: "all .2s",
      ...style,
    }}
  >
    {children}
  </button>
);

const SectionCard = ({ title, right, children, style }) => (
  <div
    className="card"
    style={{
      background: "var(--system-grouped-background-secondary)",
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      boxShadow: "var(--shadow-md)",
      ...style,
    }}
  >
    {(title || right) && (
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        {title ? (
          <h2 style={{ fontSize: 18, margin: 0, color: "var(--label)" }}>
            {title}
          </h2>
        ) : (
          <div />
        )}
        {right}
      </div>
    )}
    {children}
  </div>
);

const TimeBadge = ({ inWindow, text }) => (
  <span
    className={`time-badge ${inWindow ? "in-window" : "outside"}`}
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "6px 12px",
      borderRadius: 20,
      fontSize: 14,
      fontWeight: 600,
      background: inWindow ? "rgba(52,199,89,.15)" : "rgba(255,59,48,.15)",
      color: inWindow ? "var(--system-green)" : "var(--system-red)",
    }}
  >
    {text}
  </span>
);

/* ---------------- Domain helpers (queue logic & tz) ---------------- */

const TZ_BUCKETS = {
  "Pacific/Honolulu": "HST",
  "America/Anchorage": "AKT",
  "America/Los_Angeles": "PST",
  "America/Phoenix": "MT",
  "America/Denver": "MT",
  "America/Chicago": "CT",
  "America/New_York": "ET",
  "America/Halifax": "AT",
};

function tzBucket(tz) {
  return TZ_BUCKETS[tz] || "Other";
}

function getLocalHour(timezone) {
  try {
    const hh = new Date().toLocaleTimeString("en-US", {
      timeZone: timezone,
      hour12: false,
      hour: "2-digit",
    });
    return parseInt(hh, 10);
  } catch {
    return new Date().getHours();
  }
}

function getLocalTime(timezone) {
  try {
    return new Date().toLocaleTimeString("en-US", {
      timeZone: timezone,
      hour12: true,
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return new Date().toLocaleTimeString("en-US", {
      hour12: true,
      hour: "numeric",
      minute: "2-digit",
    });
  }
}

function callWindowForTitle(title) {
  const t = (title || "").toLowerCase();
  const windows = {
    "distance ed": { start: 10, end: 16 },
    lms: { start: 10, end: 16 },
    ada: { start: 11, end: 15 },
    accessibility: { start: 11, end: 15 },
    testing: { start: 9, end: 15 },
    instructional: { start: 10, end: 16 },
  };
  for (const [k, w] of Object.entries(windows)) {
    if (t.includes(k)) return w;
  }
  return { start: 9, end: 16 };
}

/* ---------------- Add Lead Modal ---------------- */

function AddLeadModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    college: "",
    title: "",
    state: "",
    email: "",
    notes: "",
  });

  const onSubmit = (e) => {
    e.preventDefault();
    if (!form.name || !form.phone || !form.college || !form.title) return;
    onSave(form);
  };

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.5)",
        backdropFilter: "blur(10px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 200,
      }}
    >
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--system-grouped-background-secondary)",
          borderRadius: 20,
          padding: 24,
          width: "min(520px,92vw)",
          boxShadow: "var(--shadow-xl)",
        }}
      >
        <div
          className="modal-header"
          style={{ display: "flex", justifyContent: "space-between" }}
        >
          <h3 style={{ margin: 0 }}>Add New Lead</h3>
          <button
            className="btn-ghost"
            onClick={onClose}
            aria-label="Close add lead modal"
            style={{
              background: "transparent",
              border: "none",
              fontSize: 18,
              cursor: "pointer",
              color: "var(--label-tertiary)",
            }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={onSubmit}>
          {[
            ["Name *", "name", "text", true],
            ["Phone *", "phone", "tel", true],
            ["College/University *", "college", "text", true],
            ["Title *", "title", "text", true],
          ].map(([label, key, type]) => (
            <div className="form-group" key={key} style={{ marginBottom: 14 }}>
              <label className="form-label" style={{ fontWeight: 600 }}>
                {label}
              </label>
              <input
                className="form-input"
                type={type}
                required
                value={form[key]}
                onChange={(e) => setForm((s) => ({ ...s, [key]: e.target.value }))}
                style={inputStyle}
              />
            </div>
          ))}

          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label" style={{ fontWeight: 600 }}>
              State
            </label>
            <select
              className="form-select"
              value={form.state}
              onChange={(e) =>
                setForm((s) => ({ ...s, state: e.target.value }))
              }
              style={inputStyle}
            >
              <option value="">Select State</option>
              {Object.keys(STATE_TO_TZ).map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label" style={{ fontWeight: 600 }}>
              Email
            </label>
            <input
              className="form-input"
              type="email"
              value={form.email}
              onChange={(e) =>
                setForm((s) => ({ ...s, email: e.target.value }))
              }
              style={inputStyle}
              placeholder="name@university.edu"
            />
          </div>

          <div className="form-group" style={{ marginBottom: 18 }}>
            <label className="form-label" style={{ fontWeight: 600 }}>
              Notes
            </label>
            <textarea
              className="form-textarea"
              value={form.notes}
              onChange={(e) =>
                setForm((s) => ({ ...s, notes: e.target.value }))
              }
              style={{ ...inputStyle, minHeight: 100, resize: "vertical" }}
              placeholder="Anything useful for your next call…"
            />
          </div>

          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              style={btnSecondary}
            >
              Cancel
            </button>
            <button type="submit" className="btn" style={btnPrimary}>
              Add Lead
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---------------- Main App ---------------- */

export default function App() {
  const [user, setUser] = useState(null);

  const [view, setView] = useState("queue"); // queue | leads | stats
  const [leads, setLeads] = useState([]);
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [hideDNC, setHideDNC] = useState(true);
  const [onlyInWindow, setOnlyInWindow] = useState(false);
  const [groupBy, setGroupBy] = useState("none"); // none | college | tz
  const [showAdd, setShowAdd] = useState(false);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return unsub;
  }, []);

  // Subscribe to leads
  useEffect(() => {
    if (!user) return;
    return subscribeLeads(user.uid, setLeads, {
      hideDNC,
      state: stateFilter || undefined,
    });
  }, [user, hideDNC, stateFilter]);

  // Filters & queue sorting
  const filteredLeads = useMemo(() => {
    const q = search.trim().toLowerCase();
    let arr = leads;

    if (q) {
      arr = arr.filter(
        (l) =>
          l.name?.toLowerCase().includes(q) ||
          l.college?.toLowerCase().includes(q) ||
          l.title?.toLowerCase().includes(q) ||
          l.phone?.includes(q) ||
          l.email?.toLowerCase().includes(q)
      );
    }

    if (onlyInWindow) {
      arr = arr.filter((l) => {
        const h = getLocalHour(l.timezone || "America/New_York");
        const win = callWindowForTitle(l.title);
        return h >= win.start && h <= win.end;
      });
    }

    // queue order by midpoint closeness
    if (view === "queue") {
      arr = [...arr].sort((a, b) => {
        const ha = getLocalHour(a.timezone || "America/New_York");
        const hb = getLocalHour(b.timezone || "America/New_York");
        const wa = callWindowForTitle(a.title);
        const wb = callWindowForTitle(b.title);
        const sa = Math.abs(ha - (wa.start + wa.end) / 2);
        const sb = Math.abs(hb - (wb.start + wb.end) / 2);
        return sa - sb;
      });
    } else if (view === "leads") {
      arr = [...arr].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    }

    return arr;
  }, [leads, search, onlyInWindow, view]);

  // Groups
  const grouped = useMemo(() => {
    if (groupBy === "none") return { All: filteredLeads };
    const map = {};
    for (const l of filteredLeads) {
      const key =
        groupBy === "college"
          ? l.college || "Unknown"
          : tzBucket(l.timezone || "");
      if (!map[key]) map[key] = [];
      map[key].push(l);
    }
    return map;
  }, [filteredLeads, groupBy]);

  // Actions
  const signInGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const signOutUser = async () => {
    await signOut(auth);
  };

  const handleAddLead = async (payload) => {
    if (!user) return;
    await createLead(user.uid, payload);
    setShowAdd(false);
  };

  const toggleDNC = async (lead) => {
    if (!user) return;
    await updateLead(user.uid, lead.id, { dnc: !lead.dnc });
  };

  const handleDelete = async (lead) => {
    if (!user) return;
    if (!confirm(`Delete ${lead.name}? This cannot be undone.`)) return;
    await deleteLead(user.uid, lead.id);
  };

  const handleCall = (lead) => {
    window.location.href = `tel:${lead.phone}`;
  };

  /* ---------------- RENDER ---------------- */

  if (!user) {
    return (
      <div style={{ padding: 24 }}>
        <header
          className="nav-bar"
          style={navBarStyle}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h1 style={brandStyle}>SDR Power Queue</h1>
            <span style={proBadgeStyle}>Pro</span>
          </div>
          <div>
            <button onClick={signInGoogle} style={btnPrimary}>
              Sign in with Google
            </button>
          </div>
        </header>

        <SectionCard title="Welcome">
          <p style={{ marginBottom: 8 }}>
            Sign in to start adding leads, calling from your prioritized queue,
            and syncing your work securely to Firestore.
          </p>
          <ul style={{ margin: "8px 0 0 18px" }}>
            <li>Each user sees only their own leads (per-user security rules)</li>
            <li>Works offline; syncs when back online</li>
            <li>Fast queue and iOS/Mac-style UI</li>
          </ul>
        </SectionCard>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      {/* Top bar */}
      <header className="nav-bar" style={navBarStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h1 style={brandStyle}>SDR Power Queue</h1>
          <span style={proBadgeStyle}>Pro</span>
        </div>

        <div className="segmented-control" style={segmentedStyle}>
          {["queue", "leads", "stats"].map((tab) => (
            <button
              key={tab}
              onClick={() => setView(tab)}
              className={view === tab ? "active" : ""}
              style={{
                ...segBtnStyle,
                ...(view === tab ? segBtnActive : {}),
              }}
            >
              {tab[0].toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ color: "var(--label-tertiary)", fontSize: 14 }}>
            {user.email}
          </span>
          <button onClick={() => setShowAdd(true)} style={btnSecondary}>
            + Add Lead
          </button>
          <button onClick={signOutUser} style={btnGhost}>
            Sign out
          </button>
        </div>
      </header>

      {/* Filters */}
      <SectionCard
        title="Filters"
        right={
          <div style={{ display: "flex", gap: 8 }}>
            <Pill
              active={onlyInWindow}
              onClick={() => setOnlyInWindow((s) => !s)}
            >
              In Window
            </Pill>
            <Pill active={hideDNC} onClick={() => setHideDNC((s) => !s)}>
              Hide DNC
            </Pill>
          </div>
        }
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto auto auto",
            gap: 12,
          }}
        >
          <input
            placeholder="Search name, college, title, phone, email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={inputStyle}
          />
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            style={inputStyle}
          >
            <option value="">All States</option>
            {Object.keys(STATE_TO_TZ).map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value)}
            style={inputStyle}
          >
            <option value="none">No Group</option>
            <option value="college">Group by College</option>
            <option value="tz">Group by Timezone</option>
          </select>
          <button onClick={() => setShowAdd(true)} style={btnPrimary}>
            + New Lead
          </button>
        </div>
      </SectionCard>

      {/* Content */}
      {view === "queue" && (
        <QueueView
          groups={grouped}
          onCall={handleCall}
          onToggleDNC={toggleDNC}
          onDelete={handleDelete}
        />
      )}

      {view === "leads" && (
        <LeadsView
          groups={grouped}
          onCall={handleCall}
          onToggleDNC={toggleDNC}
          onDelete={handleDelete}
        />
      )}

      {view === "stats" && <StatsView leads={leads} />}

      {showAdd && (
        <AddLeadModal onClose={() => setShowAdd(false)} onSave={handleAddLead} />
      )}
    </div>
  );
}

/* ---------------- Views ---------------- */

function QueueView({ groups, onCall, onToggleDNC, onDelete }) {
  const groupKeys = Object.keys(groups);

  return (
    <>
      {groupKeys.map((group) => (
        <SectionCard
          key={group}
          title={`${group} (${groups[group].length})`}
        >
          <div className="ios-table">
            <HeaderRow columns={["Lead", "Local Time", "Phone", "Actions"]} />
            <div>
              {groups[group].map((l, idx) => {
                const hour = getLocalHour(l.timezone || "America/New_York");
                const win = callWindowForTitle(l.title);
                const inWindow = hour >= win.start && hour <= win.end;

                return (
                  <div
                    key={l.id}
                    className={`ios-table-row ${idx === 0 ? "priority" : ""}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "2fr 1fr 1fr 1.5fr",
                      gap: 12,
                      alignItems: "center",
                      padding: "12px 16px",
                      borderBottom: "1px solid var(--separator)",
                      position: "relative",
                      background:
                        idx === 0
                          ? "linear-gradient(90deg, rgba(0,122,255,0.08), transparent)"
                          : "transparent",
                    }}
                  >
                    <div className="lead-info">
                      <div className="lead-name" style={{ fontWeight: 600 }}>
                        {l.name} {l.dnc && <small>(DNC)</small>}
                      </div>
                      <div
                        className="lead-meta"
                        style={{ color: "var(--label-tertiary)", fontSize: 13 }}
                      >
                        {l.title} • {l.college}
                      </div>
                    </div>
                    <div>
                      <TimeBadge
                        inWindow={inWindow}
                        text={getLocalTime(l.timezone || "America/New_York")}
                      />
                    </div>
                    <div style={{ fontVariantNumeric: "tabular-nums" }}>
                      {l.phone}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button style={btnPrimarySm} onClick={() => onCall(l)}>
                        Call
                      </button>
                      <button style={btnSecondarySm} onClick={() => onToggleDNC(l)}>
                        {l.dnc ? "Undnc" : "DNC"}
                      </button>
                      <button style={btnDangerSm} onClick={() => onDelete(l)}>
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </SectionCard>
      ))}
    </>
  );
}

function LeadsView({ groups, onCall, onToggleDNC, onDelete }) {
  const groupKeys = Object.keys(groups);

  return (
    <>
      {groupKeys.map((group) => (
        <SectionCard key={group} title={`${group} (${groups[group].length})`}>
          <div className="ios-table">
            <HeaderRow columns={["Name", "Contact", "Organization", "Status"]} />
            <div>
              {groups[group].map((l) => (
                <div
                  key={l.id}
                  className="ios-table-row"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1.5fr 1.5fr 1.5fr",
                    gap: 12,
                    alignItems: "center",
                    padding: "12px 16px",
                    borderBottom: "1px solid var(--separator)",
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{l.name}</div>
                  <div>
                    <div style={{ fontVariantNumeric: "tabular-nums" }}>
                      {l.phone}
                    </div>
                    <div style={{ color: "var(--label-tertiary)", fontSize: 13 }}>
                      {l.email}
                    </div>
                  </div>
                  <div>{l.college}</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button style={btnPrimarySm} onClick={() => onCall(l)}>
                      Call
                    </button>
                    <button style={btnSecondarySm} onClick={() => onToggleDNC(l)}>
                      {l.dnc ? "Undnc" : "DNC"}
                    </button>
                    <button style={btnDangerSm} onClick={() => onDelete(l)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      ))}
    </>
  );
}

function StatsView({ leads }) {
  const counts = useMemo(() => {
    const total = leads.length;
    const dnc = leads.filter((l) => l.dnc).length;
    const byTZ = leads.reduce((acc, l) => {
      const k = tzBucket(l.timezone || "");
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});
    const byCollege = leads.reduce((acc, l) => {
      const k = l.college || "Unknown";
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});
    return { total, dnc, byTZ, byCollege };
  }, [leads]);

  return (
    <>
      <SectionCard title="Summary">
        <div
          className="stats-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px,1fr))",
            gap: 16,
          }}
        >
          <StatTile label="Total Leads" value={counts.total} />
          <StatTile label="DNC" value={counts.dnc} />
          <StatTile
            label="Active"
            value={counts.total - counts.dnc}
            accent="green"
          />
        </div>
      </SectionCard>

      <SectionCard title="By Timezone">
        <SimpleTable rows={Object.entries(counts.byTZ)} />
      </SectionCard>

      <SectionCard title="Top Colleges">
        <SimpleTable
          rows={Object.entries(counts.byCollege)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20)}
        />
      </SectionCard>
    </>
  );
}

/* ---------------- Small UI bits ---------------- */

function HeaderRow({ columns }) {
  return (
    <div
      className="ios-table-header"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns.length}, 1fr)`,
        gap: 12,
        padding: "12px 16px",
        borderBottom: "1px solid var(--separator)",
        background: "var(--material-thin)",
        fontSize: 12,
        color: "var(--label-secondary)",
        textTransform: "uppercase",
        letterSpacing: 0.5,
        fontWeight: 700,
      }}
    >
      {columns.map((c) => (
        <div key={c}>{c}</div>
      ))}
    </div>
  );
}

function StatTile({ label, value, accent }) {
  const gradient =
    accent === "green"
      ? "linear-gradient(135deg, var(--system-green), #5ee390)"
      : "linear-gradient(135deg, var(--system-blue), var(--system-indigo))";
  return (
    <div
      className="stat-card"
      style={{
        background: "var(--system-grouped-background-secondary)",
        borderRadius: 16,
        padding: 20,
        boxShadow: "var(--shadow-md)",
      }}
    >
      <div
        className="stat-value"
        style={{
          fontSize: 32,
          fontWeight: 800,
          marginBottom: 6,
          background: gradient,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        {value}
      </div>
      <div
        className="stat-label"
        style={{ color: "var(--label-tertiary)", textTransform: "uppercase" }}
      >
        {label}
      </div>
    </div>
  );
}

function SimpleTable({ rows }) {
  return (
    <div className="ios-table">
      <div
        className="ios-table-header"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 12,
          padding: "12px 16px",
          borderBottom: "1px solid var(--separator)",
          background: "var(--material-thin)",
          fontSize: 12,
          color: "var(--label-secondary)",
          textTransform: "uppercase",
          letterSpacing: 0.5,
          fontWeight: 700,
        }}
      >
        <div>Key</div>
        <div>Count</div>
      </div>
      <div>
        {rows.map(([k, v]) => (
          <div
            key={k}
            className="ios-table-row"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: 12,
              padding: "12px 16px",
              borderBottom: "1px solid var(--separator)",
            }}
          >
            <div>{k}</div>
            <div style={{ fontWeight: 600 }}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Inline styles (light iOS / macOS) ---------------- */

const navBarStyle = {
  position: "sticky",
  top: 0,
  zIndex: 10,
  background: "var(--material-thick)",
  backdropFilter: "saturate(180%) blur(20px)",
  borderRadius: 20,
  padding: 12,
  marginBottom: 20,
  boxShadow: "var(--shadow-lg)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const brandStyle = {
  margin: 0,
  fontSize: 20,
  fontWeight: 800,
  background: "linear-gradient(135deg, var(--system-blue), var(--system-indigo))",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
};

const proBadgeStyle = {
  padding: "4px 8px",
  borderRadius: 12,
  background: "linear-gradient(135deg, var(--system-blue), var(--system-indigo))",
  color: "#fff",
  fontSize: 12,
  fontWeight: 700,
};

const segmentedStyle = {
  display: "inline-flex",
  padding: 2,
  background: "var(--vibrancy-dark)",
  borderRadius: 14,
};

const segBtnStyle = {
  appearance: "none",
  border: "none",
  background: "transparent",
  color: "var(--label)",
  padding: "8px 16px",
  borderRadius: 12,
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
};
const segBtnActive = {
  background: "var(--system-background-secondary)",
  boxShadow: "var(--shadow-sm)",
};

const inputStyle = {
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid var(--separator)",
  background: "var(--material-thin)",
  color: "var(--label)",
  fontSize: 15,
  outline: "none",
};

const btnPrimary = {
  background: "var(--system-blue)",
  color: "#fff",
  border: "none",
  padding: "10px 16px",
  borderRadius: 12,
  fontWeight: 700,
  cursor: "pointer",
};

const btnSecondary = {
  background: "var(--vibrancy-dark)",
  color: "var(--label)",
  border: "1px solid var(--separator)",
  padding: "10px 16px",
  borderRadius: 12,
  fontWeight: 700,
  cursor: "pointer",
};

const btnGhost = {
  background: "transparent",
  color: "var(--system-blue)",
  border: "none",
  padding: "8px 12px",
  borderRadius: 12,
  fontWeight: 700,
  cursor: "pointer",
};

const btnPrimarySm = {
  ...btnPrimary,
  padding: "8px 12px",
  borderRadius: 10,
  fontSize: 13,
};

const btnSecondarySm = {
  ...btnSecondary,
  padding: "8px 12px",
  borderRadius: 10,
  fontSize: 13,
};

const btnDangerSm = {
  background: "var(--system-red)",
  color: "#fff",
  border: "none",
  padding: "8px 12px",
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};