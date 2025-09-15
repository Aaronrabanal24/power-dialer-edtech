import React, { Fragment, useEffect, useMemo, useState } from "react";
import "./index.css";

/* Firebase (uses your existing service wrapper) */
import { auth, googleProvider } from "./services/firebase";
import { signInWithPopup } from "firebase/auth";

/* Data/context + components you already have */
import { LeadsProvider, useLeads } from "./contexts/LeadsContext";
import AddLeadModal from "./components/AddLeadModal";
import LeadList from "./components/LeadList";

/* Utils */
import { callWindowForTitle, getLocalHour, tzBucket } from "./utils/time";
import { normalizePhone } from "./utils/phone";

/* -----------------------------
 * Theme helpers
 * ----------------------------- */
const getInitialTheme = () => localStorage.getItem("theme") || "system";
const applyTheme = (theme) => {
  if (theme === "system") {
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
  } else {
    document.documentElement.setAttribute("data-theme", theme);
  }
};

/* -----------------------------
 * Tiny toast
 * ----------------------------- */
const toast = (msg, type = "info") => {
  const existing = document.querySelector(".toast");
  if (existing) existing.remove();
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
};

/* -----------------------------
 * Display-only phone formatter
 * (keeps storage in E.164 but shows (xxx) xxx - xxxx [ext])
 * ----------------------------- */
function formatPhoneDisplay(raw) {
  if (!raw) return "";
  const s = String(raw).replace(/[^\dXx]/g, "");
  // Strip leading +1
  const digits = s.replace(/^1/, "").replace(/[^\d]/g, "");
  const main = digits.slice(0, 10);
  const ext = digits.slice(10);
  if (main.length < 10) return raw; // fallback
  const area = main.slice(0, 3);
  const mid = main.slice(3, 6);
  const tail = main.slice(6, 10);
  return ext ? `(${area}) ${mid} - ${tail} ext. ${ext}` : `(${area}) ${mid} - ${tail}`;
}

/* -----------------------------
 * Local time helper (per timezone)
 * ----------------------------- */
const getLocalTime = (timezone) => {
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
};

/* -----------------------------
 * Shell: mounts provider + theme
 * ----------------------------- */
function Shell() {
  const [theme, setTheme] = useState(getInitialTheme);
  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    const m = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => theme === "system" && applyTheme("system");
    m.addEventListener?.("change", handler);
    return () => m.removeEventListener?.("change", handler);
  }, [theme]);

  return (
    <LeadsProvider>
      <MainApp theme={theme} setTheme={setTheme} />
    </LeadsProvider>
  );
}

/* -----------------------------
 * Main App
 * ----------------------------- */
function MainApp({ theme, setTheme }) {
  const {
    leads,
    logs,
    loading,
    addLead,
    toggleDnc,
    updateNotes,
    deleteLead,
    logCall,
    updateOrder,
  } = useLeads();

  // Header scroll collapse
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // UI state
  const [view, setView] = useState("queue"); // queue | leads | stats
  const [searchQuery, setSearchQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [onlyInWindow, setOnlyInWindow] = useState(false);
  const [hideDNC, setHideDNC] = useState(true);
  const [groupByCollege, setGroupByCollege] = useState(false);
  const [groupByTz, setGroupByTz] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);

  // Call block timer
  const [blockTimer, setBlockTimer] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [blockCalls, setBlockCalls] = useState(0);
  useEffect(() => {
    let id;
    if (blockTimer) id = setInterval(() => setElapsed(Date.now() - blockTimer), 1000);
    return () => clearInterval(id);
  }, [blockTimer]);
  const fmt = (ms) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    return `${String(h).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}:${String(
      s % 60
    ).padStart(2, "0")}`;
  };

  // Auth actions
  const doSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      toast("Signed in", "success");
    } catch (e) {
      console.error(e);
      toast("Sign-in failed", "error");
    }
  };
  const doSignOut = async () => {
    try {
      await auth.signOut();
      toast("Signed out", "success");
    } catch (e) {
      console.error(e);
    }
  };

  // Memoized avatar URL
  const currentUser = auth.currentUser;
  const avatarUrl = useMemo(() => {
    if (!currentUser) return null;
    const name = currentUser.displayName || currentUser.email || "User";
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=667eea&color=fff`;
  }, [currentUser]);

  // Actions
  const callLead = (lead) => {
    // Use normalized number for tel: link
    window.location.href = `tel:${normalizePhone(lead.phone)}`;
    toast(`Calling ${lead.name}…`, "info");
  };
  const startBlock = () => {
    setBlockTimer(Date.now());
    setBlockCalls(0);
    toast("Call block started", "success");
  };
  const endBlock = () => {
    const hrs = (Date.now() - blockTimer) / 3600000;
    const cph = hrs > 0 ? Math.round(blockCalls / hrs) : 0;
    setBlockTimer(null);
    setElapsed(0);
    setBlockCalls(0);
    toast(`Block ended: ${cph} calls/hour`);
  };

  // Queue
  const queue = useMemo(() => {
    let filtered = leads.filter((l) => (hideDNC ? !l.dnc : true));
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          (l.college || "").toLowerCase().includes(q) ||
          (l.title || "").toLowerCase().includes(q) ||
          (l.phone || "").includes(q)
      );
    }
    if (stateFilter) filtered = filtered.filter((l) => l.state === stateFilter);
    if (onlyInWindow) {
      filtered = filtered.filter((l) => {
        const hour = getLocalHour(l.timezone);
        const win = callWindowForTitle(l.title);
        return hour >= win.start && hour <= win.end;
      });
    }
    // Priority by proximity to call-window midpoint
    filtered.sort((a, b) => {
      const ah = getLocalHour(a.timezone);
      const bh = getLocalHour(b.timezone);
      const aw = callWindowForTitle(a.title);
      const bw = callWindowForTitle(b.title);
      const as = Math.abs(ah - (aw.start + aw.end) / 2);
      const bs = Math.abs(bh - (bw.start + bw.end) / 2);
      return as - bs;
    });
    return filtered;
  }, [leads, logs, searchQuery, stateFilter, onlyInWindow, hideDNC]);

  // Grouped for display
  const groupedLeads = useMemo(() => {
    if (!groupByCollege && !groupByTz) return { All: queue };
    const buckets = {};
    queue.forEach((l) => {
      const groups = [];
      if (groupByCollege) groups.push(l.college || "Unknown College");
      if (groupByTz) groups.push(tzBucket(l.timezone));
      const key = groups.join(" • ") || "All";
      (buckets[key] ||= []).push(l);
    });
    return buckets;
  }, [queue, groupByCollege, groupByTz]);

  // Shortcuts (deps updated per your note)
  useEffect(() => {
    const h = (e) => {
      if (["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;
      const top = queue[0];
      if (!top) return;
      if (e.key === "c") {
        callLead(top);
      } else if (e.key === "1") {
        logCall(top, "No answer");
      } else if (e.key === "2") {
        logCall(top, "Left VM");
      } else if (e.key === "3") {
        logCall(top, "Conversation");
      } else if (e.key === "4") {
        logCall(top, "DNC");
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowAdd(true);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [queue, logCall]);

  return (
    <Fragment>
      {/* ===== Enhanced Header (fixed) ===== */}
      <div className={`header-container ${scrolled ? "scrolled" : ""}`}>
        <div className="top-bar">
          <span>🎯 Supercharge your sales with AI-powered insights</span>
          <span className="promo-badge">New</span>
        </div>

        <div className="nav-bar">
          {/* Brand / Logo */}
          <div className="nav-brand">
            <div className="logo-container" title="Power Dialer">
              <div className="logo-pulse" />
              <svg
                className="logo-svg"
                viewBox="0 0 48 48"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
                focusable="false"
              >
                <defs>
                  <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#667eea" />
                    <stop offset="100%" stopColor="#764ba2" />
                  </linearGradient>
                  <linearGradient id="logoAccent" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f59e0b" />
                    <stop offset="100%" stopColor="#ef4444" />
                  </linearGradient>
                </defs>
                <rect x="14" y="8" width="20" height="32" rx="4" fill="url(#logoGradient)" opacity="0.15" />
                <rect x="14" y="8" width="20" height="32" rx="4" stroke="url(#logoGradient)" strokeWidth="2" />
                <rect x="17" y="12" width="14" height="24" rx="2" fill="url(#logoGradient)" opacity="0.1" />
                <path
                  d="M8 18 C6 18, 4 20, 4 24 C4 28, 6 30, 8 30"
                  stroke="url(#logoAccent)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  fill="none"
                  opacity="0.8"
                />
                <path
                  d="M11 21 C10 21, 9 22.5, 9 24 C9 25.5, 10 27, 11 27"
                  stroke="url(#logoAccent)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  fill="none"
                />
                <circle cx="24" cy="24" r="8" fill="url(#logoGradient)" />
                <path
                  d="M27.5 26.5 L26 25 C26 25 27 23 25 21 L26.5 19.5 C29 22 27.5 26.5 27.5 26.5Z"
                  fill="white"
                />
                <path
                  d="M20.5 21.5 L22 23 C22 23 21 25 23 27 L21.5 28.5 C19 26 20.5 21.5 20.5 21.5Z"
                  fill="white"
                />
              </svg>
            </div>

            <div className="brand-text">
              <h1 className="brand-name">Power Dialer</h1>
              <span className="brand-tagline">Smart calling made simple</span>
            </div>

            <span className="pro-badge" aria-label="Pro plan">
              <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              Pro
            </span>
          </div>

          {/* Center tabs */}
          <div className="nav-center">
            <div className="segmented-control">
              <div
                className="indicator"
                style={{
                  width: "33.33%",
                  left: view === "queue" ? "0%" : view === "leads" ? "33.33%" : "66.66%",
                }}
              />
              <button className={view === "queue" ? "active" : ""} onClick={() => setView("queue")}>
                <svg className="nav-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path d="M2 6a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                  <path d="M2 14a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H4a2 2 0 01-2-2v-2z" />
                </svg>
                Queue
              </button>
              <button className={view === "leads" ? "active" : ""} onClick={() => setView("leads")}>
                <svg className="nav-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                </svg>
                Leads
              </button>
              <button className={view === "stats" ? "active" : ""} onClick={() => setView("stats")}>
                <svg className="nav-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                </svg>
                Stats
              </button>
            </div>
          </div>

          {/* Right actions */}
          <div className="nav-actions">
            <div className="status-indicator">
              <span className={`status-dot ${loading ? "loading" : "ready"}`} />
              <span className="status-text">
                {loading ? "Loading..." : currentUser ? "Ready" : "Signed out"}
              </span>
            </div>

            <div className="theme-switcher" role="tablist" aria-label="Theme">
              {["light", "dark", "system"].map((opt) => (
                <button
                  key={opt}
                  onClick={() => setTheme(opt)}
                  className={theme === opt ? "active" : ""}
                  aria-label={`${opt} theme`}
                >
                  {opt === "light" && "☀️"}
                  {opt === "dark" && "🌙"}
                  {opt === "system" && "💻"}
                </button>
              ))}
            </div>

            <div className="user-menu">
              {currentUser ? (
                <Fragment>
                  <button className="user-avatar" title={currentUser.displayName || currentUser.email || "User"}>
                    {avatarUrl && <img src={avatarUrl} alt="User avatar" />}
                    <span className="user-status" />
                  </button>
                  <button className="btn btn-ghost" onClick={doSignOut} title="Sign out">
                    <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 16, height: 16 }} aria-hidden="true">
                      <path
                        fillRule="evenodd"
                        d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z"
                      />
                    </svg>
                    Sign out
                  </button>
                </Fragment>
              ) : (
                <button className="btn" onClick={doSignIn}>Sign in with Google</button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ===== Main content (pushed down by fixed header) ===== */}
      <div className="app-container">
        {!currentUser ? (
          <div className="card" style={{ textAlign: "center", padding: 40 }}>
            <div className="empty-icon">📞</div>
            <div className="empty-title">Welcome to Power Dialer</div>
            <div className="empty-message">Sign in to load your personal leads and start calling.</div>
          </div>
        ) : (
          <Fragment>
            {view === "queue" && (
              <Fragment>
                <div className="card timer-card">
                  <div className="timer-display">{blockTimer ? fmt(elapsed) : "00:00:00"}</div>
                  <div className="timer-metrics">
                    <div className="metric">
                      <div className="metric-value">{blockCalls}</div>
                      <div className="metric-label">Calls This Block</div>
                    </div>
                    <div className="metric">
                      <div className="metric-value">
                        {blockTimer ? Math.round(blockCalls / ((Date.now() - blockTimer) / 3600000)) : 0}
                      </div>
                      <div className="metric-label">Calls/Hour</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
                    {!blockTimer ? (
                      <button className="btn" onClick={startBlock}>
                        Start Call Block
                      </button>
                    ) : (
                      <button className="btn btn-danger" onClick={endBlock}>
                        End Block
                      </button>
                    )}
                  </div>
                </div>

                <div className="search-bar">
                  <span className="search-icon">🔎</span>
                  <input
                    className="search-input"
                    placeholder="Search leads..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <div className="filter-pills">
                  <div
                    className={`pill ${onlyInWindow ? "active" : ""}`}
                    onClick={() => setOnlyInWindow((v) => !v)}
                  >
                    ⏰ In Window
                  </div>
                  <div className={`pill ${hideDNC ? "active" : ""}`} onClick={() => setHideDNC((v) => !v)}>
                    Hide DNC
                  </div>
                  <div
                    className={`pill ${groupByCollege ? "active" : ""}`}
                    onClick={() => setGroupByCollege((v) => !v)}
                  >
                    Group by College
                  </div>
                  <div className={`pill ${groupByTz ? "active" : ""}`} onClick={() => setGroupByTz((v) => !v)}>
                    Group by Timezone
                  </div>
                  <select
                    className="form-select"
                    style={{ width: "auto", marginLeft: 8 }}
                    value={stateFilter}
                    onChange={(e) => setStateFilter(e.target.value)}
                  >
                    <option value="">All States</option>
                    {Array.from(new Set(leads.map((l) => l.state).filter(Boolean)))
                      .sort()
                      .map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                  </select>
                  <button className="btn btn-secondary" onClick={() => setShowAdd(true)}>
                    ＋ Add Lead
                  </button>
                </div>

                <div className="card">
                  <h2 style={{ marginBottom: 12 }}>Call Queue ({queue.length} leads)</h2>

                  {loading ? (
                    <div className="spinner" />
                  ) : (
                    Object.entries(groupedLeads).map(([group, items]) => (
                      <div key={group} style={{ marginBottom: 18 }}>
                        {(groupByCollege || groupByTz) && (
                          <div
                            className="ellipsis"
                            style={{ fontSize: 13, fontWeight: 700, color: "var(--text-tertiary)", margin: "6px 0" }}
                          >
                            {group}
                          </div>
                        )}

                        {/* Drag & drop reordering only when not grouped */}
                        <LeadList
                          items={items}
                          formatPhoneDisplay={formatPhoneDisplay}
                          getLocalTime={getLocalTime}
                          onReorder={
                            groupByCollege || groupByTz
                              ? () => {}
                              : (id, newOrder) => updateOrder(id, newOrder)
                          }
                          onCall={(l) => callLead(l)}
                          onOutcome={(l, o) => {
                            logCall(l, o);
                            if (blockTimer) setBlockCalls((c) => c + 1);
                          }}
                          onToggleDnc={(l) => toggleDnc(l)}
                          onDelete={(l) => deleteLead(l)}
                          onSelect={(l) => setSelectedLead(l)}
                        />
                      </div>
                    ))
                  )}
                </div>
              </Fragment>
            )}

            {view === "leads" && (
              <div className="card">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 12,
                  }}
                >
                  <h2>All Leads ({leads.length})</h2>
                  <button className="btn btn-secondary" onClick={() => setShowAdd(true)}>
                    ＋ Add Lead
                  </button>
                </div>
                <LeadList
                  items={leads}
                  formatPhoneDisplay={formatPhoneDisplay}
                  getLocalTime={getLocalTime}
                  onReorder={(id, newOrder) => updateOrder(id, newOrder)}
                  onCall={(l) => callLead(l)}
                  onOutcome={(l, o) => logCall(l, o)}
                  onToggleDnc={(l) => toggleDnc(l)}
                  onDelete={(l) => deleteLead(l)}
                  onSelect={(l) => setSelectedLead(l)}
                />
              </div>
            )}

            {view === "stats" && (
              <div className="card">
                <h2>Stats</h2>
                <p>Total calls: {logs.length}</p>
                {/* You can drop in the richer stat cards you already had */}
              </div>
            )}
          </Fragment>
        )}
      </div>

      {/* FAB */}
      {currentUser && (
        <div className="fab" onClick={() => setShowAdd(true)} title="Add lead">
          ＋
        </div>
      )}

      {/* Add Lead Modal */}
      {showAdd && (
        <div className="modal-backdrop" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Add New Lead</h2>
              <button className="btn-icon btn-ghost" onClick={() => setShowAdd(false)}>
                ✕
              </button>
            </div>
            <AddLeadModal
              onSubmit={async (data) => {
                try {
                  await addLead(data);
                  setShowAdd(false);
                  toast("Lead added", "success");
                } catch (e) {
                  console.error(e);
                  toast("Failed to add lead", "error");
                }
              }}
              onCancel={() => setShowAdd(false)}
            />
          </div>
        </div>
      )}

      {/* Lead Details Modal */}
      {selectedLead && (
        <div className="modal-backdrop" onClick={() => setSelectedLead(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{selectedLead.name}</h2>
              <button className="btn-icon btn-ghost" onClick={() => setSelectedLead(null)}>
                ✕
              </button>
            </div>

            <div className="card" style={{ boxShadow: "var(--shadow-sm)", marginBottom: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16 }}>
                <div>
                  <div style={{ marginBottom: 10 }}>
                    <span className="form-label">Title</span>
                    <div className="lead-name">{selectedLead.title || "—"}</div>
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <span className="form-label">Organization</span>
                    <div>{selectedLead.college || "—"}</div>
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <span className="form-label">Email</span>
                    <div>
                      {selectedLead.email ? (
                        <a href={`mailto:${selectedLead.email}`} className="badge badge-primary">
                          {selectedLead.email}
                        </a>
                      ) : (
                        "—"
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <div style={{ marginBottom: 10 }}>
                    <span className="form-label">Phone</span>
                    <div className="lead-name">{formatPhoneDisplay(selectedLead.phone) || "—"}</div>
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <span className="form-label">Local Time</span>
                    <div>
                      {(() => {
                        const hour = getLocalHour(selectedLead.timezone);
                        const win = callWindowForTitle(selectedLead.title);
                        const inWindow = hour >= win.start && hour <= win.end;
                        return (
                          <span className={`time-badge ${inWindow ? "in-window" : "outside"}`}>
                            {getLocalTime(selectedLead.timezone)}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button
                      className="btn"
                      onClick={() => {
                        callLead(selectedLead);
                        setSelectedLead(null);
                      }}
                    >
                      📞 Call
                    </button>
                    <button className="btn btn-secondary" onClick={() => logCall(selectedLead, "No answer")}>
                      No Answer
                    </button>
                    <button className="btn btn-secondary" onClick={() => logCall(selectedLead, "Left VM")}>
                      VM
                    </button>
                    <button className="btn btn-success" onClick={() => logCall(selectedLead, "Conversation")}>
                      Conv
                    </button>
                    <button className="btn btn-danger" onClick={() => logCall(selectedLead, "DNC")}>
                      DNC
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea
                className="form-textarea"
                placeholder="Add notes…"
                value={selectedLead.notes || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedLead({ ...selectedLead, notes: val });
                }}
                onBlur={(e) => updateNotes(selectedLead.id, e.target.value)}
              />
            </div>

            <div className="card">
              <h3 style={{ marginBottom: 12 }}>Call History</h3>
              <div style={{ maxHeight: 240, overflowY: "auto" }}>
                {logs
                  .filter((l) => l.leadId === selectedLead.id)
                  .map((log) => (
                    <div
                      key={log.id}
                      style={{
                        padding: 8,
                        borderBottom: "1px solid var(--bg-scrim)",
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span>{new Date(log.at).toLocaleString()}</span>
                      <span style={{ fontWeight: 700 }}>{log.outcome}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Shortcut hint */}
      <div
        style={{
          position: "fixed",
          bottom: 24,
          left: "50%",
          transform: "translateX(-50%)",
          background: "var(--bg-elevated)",
          padding: "8px 16px",
          borderRadius: 20,
          fontSize: 13,
          color: "var(--text-secondary)",
          boxShadow: "var(--shadow-md)",
          zIndex: 10,
          border: "1px solid var(--bg-scrim)",
        }}
      >
        Press <span className="kbd">C</span> to call • <span className="kbd">1–4</span> outcomes •{" "}
        <span className="kbd">⌘K</span> add lead • Long-press to drag
      </div>
    </Fragment>
  );
}

export default Shell;