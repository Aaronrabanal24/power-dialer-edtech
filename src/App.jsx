import React, {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
  memo,
} from "react";
import "./index.css";
import { auth, googleProvider } from "./services/firebase";
import { LeadsProvider, useLeads } from "./contexts/LeadsContext";
import AddLeadModal from "./components/AddLeadModal";
import LeadList from "./components/LeadList";
import { callWindowForTitle, getLocalHour, tzBucket } from "./utils/time";
import { normalizePhone } from "./utils/phone";

/* ---------------------------------------
   Utilities
--------------------------------------- */

// tiny toast
const toast = (msg, type = "info") => {
  const existing = document.querySelector(".toast");
  if (existing) existing.remove();
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
};

// theme helpers
const getInitialTheme = () => localStorage.getItem("theme") || "system";
const applyTheme = (theme) => {
  if (theme === "system") {
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.setAttribute(
      "data-theme",
      isDark ? "dark" : "light"
    );
  } else {
    document.documentElement.setAttribute("data-theme", theme);
  }
};

// debounce hook
function useDebouncedValue(value, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

// format phone for display: (xxx) xxx - xxxx [ext. yyyy]
const formatPhoneDisplay = (raw = "") => {
  if (!raw) return "";
  // preserve extension if present
  const extMatch = (raw + "").match(
    /(?:ext\.?|x|extension)\s*[:.]?\s*(\d{1,6})/i
  );
  const ext = extMatch ? extMatch[1] : "";
  const digits = (raw + "").replace(/[^\d]/g, "");
  const last10 = digits.slice(-10);
  if (last10.length !== 10) return raw;
  const area = last10.slice(0, 3);
  const mid = last10.slice(3, 6);
  const tail = last10.slice(6);
  return ext
    ? `(${area}) ${mid} - ${tail} ext. ${ext}`
    : `(${area}) ${mid} - ${tail}`;
};

// local time helper for a timezone
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

/* ---------------------------------------
   Shell (Theme + Context)
--------------------------------------- */
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

/* ---------------------------------------
   Header (memoized)
--------------------------------------- */
const Header = memo(function Header({
  theme,
  setTheme,
  view,
  setView,
  loading,
  currentUser,
  doSignIn,
  doSignOut,
  scrolled,
  avatarUrl,
}) {
  return (
    <div className={`header-container ${scrolled ? "scrolled" : ""}`}>
      <div className="top-bar">
        <span>🎯 Supercharge your sales with AI-powered insights</span>
        <span className="promo-badge">New</span>
      </div>

      <div className="nav-bar">
        <div className="nav-brand">
          <div className="logo-container">
            <div className="logo-pulse" />
            <svg
              className="logo-svg"
              viewBox="0 0 48 48"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
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
              <rect
                x="14"
                y="8"
                width="20"
                height="32"
                rx="4"
                fill="url(#logoGradient)"
                opacity="0.15"
              />
              <rect
                x="14"
                y="8"
                width="20"
                height="32"
                rx="4"
                stroke="url(#logoGradient)"
                strokeWidth="2"
              />
              <rect
                x="17"
                y="12"
                width="14"
                height="24"
                rx="2"
                fill="url(#logoGradient)"
                opacity="0.1"
              />
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

          <span className="pro-badge">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            Pro
          </span>
        </div>

        <div className="nav-center">
          {currentUser && (
            <div className="segmented-control">
              <div
                className="indicator"
                style={{
                  width: "33.33%",
                  left: view === "queue" ? "0%" : view === "leads" ? "33.33%" : "66.66%",
                }}
              />
              <button
                className={view === "queue" ? "active" : ""}
                onClick={() => setView("queue")}
              >
                <svg className="nav-icon" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M2 6a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                  <path d="M2 14a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H4a2 2 0 01-2-2v-2z" />
                </svg>
                Queue
              </button>
              <button
                className={view === "leads" ? "active" : ""}
                onClick={() => setView("leads")}
              >
                <svg className="nav-icon" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                </svg>
                Leads
              </button>
              <button
                className={view === "stats" ? "active" : ""}
                onClick={() => setView("stats")}
              >
                <svg className="nav-icon" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                </svg>
                Stats
              </button>
            </div>
          )}
        </div>

        <div className="nav-actions">
          {currentUser ? (
            <div className="status-indicator">
              <span className={`status-dot ${loading ? "loading" : "ready"}`}></span>
              <span className="status-text">{loading ? "Loading..." : "Ready"}</span>
            </div>
          ) : null}

          <div className="theme-switcher">
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

          {currentUser ? (
            <div className="user-menu">
              <button
                className="user-avatar"
                title={currentUser?.displayName || currentUser?.email || "User"}
              >
                <img src={avatarUrl} alt="User" />
                <span className="user-status"></span>
              </button>
              <button className="btn btn-ghost" onClick={doSignOut}>
                <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 16, height: 16 }}>
                  <path
                    fillRule="evenodd"
                    d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z"
                  />
                </svg>
                Sign out
              </button>
            </div>
          ) : (
            <button className="btn" onClick={doSignIn}>
              Sign in with Google
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

/* ---------------------------------------
   Views (split for isolation)
--------------------------------------- */
const QueueView = memo(function QueueView({
  loading,
  leads,
  queue,
  groupedLeads,
  groupByCollege,
  groupByTz,
  stateFilter,
  setStateFilter,
  onlyInWindow,
  setOnlyInWindow,
  hideDNC,
  setHideDNC,
  groupByCollegeToggle,
  groupByTzToggle,
  searchInput,
  setSearchInput,
  setShowAdd,
  blockTimer,
  elapsed,
  blockCalls,
  startBlock,
  endBlock,
  callLead,
  logCall,
  toggleDnc,
  deleteLead,
  setSelectedLead,
  updateOrder,
}) {
  // Debounce search for smoother typing
  const debouncedSearch = useDebouncedValue(searchInput, 250);

  // Cap visible items initially (virtualization-lite)
  const INITIAL_COUNT = 75;
  const [visibleCount, setVisibleCount] = useState(INITIAL_COUNT);

  // Expand count whenever filters/search change
  useEffect(() => setVisibleCount(INITIAL_COUNT), [
    debouncedSearch,
    groupByCollege,
    groupByTz,
    stateFilter,
    onlyInWindow,
    hideDNC,
  ]);

  // Re-run parent filter by updating the bound input into MainApp's state
  // (We only pass down the controlled input here; MainApp uses the debounced value)
  // NOTE: the actual filtering happens in MainApp via its memoized `queue`.

  const fmt = (ms) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    return `${String(h).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}:${String(
      s % 60
    ).padStart(2, "0")}`;
  };

  return (
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
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
      </div>

      <div className="filter-pills">
        <div className={`pill ${onlyInWindow ? "active" : ""}`} onClick={() => setOnlyInWindow((v) => !v)}>
          ⏰ In Window
        </div>
        <div className={`pill ${hideDNC ? "active" : ""}`} onClick={() => setHideDNC((v) => !v)}>
          Hide DNC
        </div>
        <div className={`pill ${groupByCollege ? "active" : ""}`} onClick={groupByCollegeToggle}>
          Group by College
        </div>
        <div className={`pill ${groupByTz ? "active" : ""}`} onClick={groupByTzToggle}>
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
          Object.entries(groupedLeads).map(([group, items]) => {
            const itemsCapped =
              groupByCollege || groupByTz ? items.slice(0, visibleCount) : items.slice(0, visibleCount);
            const canLoadMore = items.length > itemsCapped.length;

            return (
              <div key={group} style={{ marginBottom: 18 }}>
                {(groupByCollege || groupByTz) && (
                  <div
                    className="ellipsis"
                    style={{ fontSize: 13, fontWeight: 700, color: "var(--text-tertiary)", margin: "6px 0" }}
                  >
                    {group}
                  </div>
                )}

                <LeadList
                  items={itemsCapped}
                  onReorder={
                    groupByCollege || groupByTz ? () => {} : (id, newOrder) => updateOrder(id, newOrder)
                  }
                  onCall={callLead}
                  onOutcome={(l, o) => logCall(l, o)}
                  onToggleDnc={toggleDnc}
                  onDelete={deleteLead}
                  onSelect={setSelectedLead}
                  formatPhoneDisplay={formatPhoneDisplay}
                  getLocalTime={getLocalTime}
                />

                {canLoadMore && (
                  <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
                    <button
                      className="btn btn-secondary"
                      onClick={() => setVisibleCount((c) => c + 75)}
                    >
                      Load 75 more
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </Fragment>
  );
});

const LeadsView = memo(function LeadsView({
  leads,
  loading,
  setShowAdd,
  callLead,
  logCall,
  toggleDnc,
  deleteLead,
  setSelectedLead,
  updateOrder,
}) {
  // Cap initial render
  const INITIAL_COUNT = 100;
  const [visibleCount, setVisibleCount] = useState(INITIAL_COUNT);
  useEffect(() => setVisibleCount(INITIAL_COUNT), [leads]);

  const canLoadMore = leads.length > visibleCount;

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2>All Leads ({leads.length})</h2>
        <button className="btn btn-secondary" onClick={() => setShowAdd(true)}>
          ＋ Add Lead
        </button>
      </div>

      {loading ? (
        <div className="spinner" />
      ) : (
        <Fragment>
          <LeadList
            items={leads.slice(0, visibleCount)}
            onReorder={(id, newOrder) => updateOrder(id, newOrder)}
            onCall={callLead}
            onOutcome={(l, o) => logCall(l, o)}
            onToggleDnc={toggleDnc}
            onDelete={deleteLead}
            onSelect={setSelectedLead}
            formatPhoneDisplay={formatPhoneDisplay}
            getLocalTime={getLocalTime}
          />
          {canLoadMore && (
            <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
              <button className="btn btn-secondary" onClick={() => setVisibleCount((c) => c + 100)}>
                Load 100 more
              </button>
            </div>
          )}
        </Fragment>
      )}
    </div>
  );
});

const StatsView = memo(function StatsView({ logs }) {
  return (
    <div className="card">
      <h2>Stats</h2>
      <p>Total calls: {logs.length}</p>
      {/* Extend with richer stats UI if desired */}
    </div>
  );
});

/* ---------------------------------------
   MainApp
--------------------------------------- */
function MainApp({ theme, setTheme }) {
  const { leads, logs, loading, addLead, toggleDnc, updateNotes, deleteLead, logCall, updateOrder } =
    useLeads();

  const currentUser = auth.currentUser;

  // view state
  const [view, setView] = useState("queue");

  // search & filters (debounce the raw input)
  const [searchInput, setSearchInput] = useState("");
  const debouncedQuery = useDebouncedValue(searchInput, 250);

  const [stateFilter, setStateFilter] = useState("");
  const [onlyInWindow, setOnlyInWindow] = useState(false);
  const [hideDNC, setHideDNC] = useState(true);
  const [groupByCollege, setGroupByCollege] = useState(false);
  const [groupByTz, setGroupByTz] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);

  // throttled scroll (via rAF)
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setScrolled(window.scrollY > 10);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // lock background when a modal is open
  useEffect(() => {
    const hasModal = !!showAdd || !!selectedLead;
    document.body.classList.toggle("modal-open", hasModal);
    return () => document.body.classList.remove("modal-open");
  }, [showAdd, selectedLead]);

  // call block
  const [blockTimer, setBlockTimer] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [blockCalls, setBlockCalls] = useState(0);
  useEffect(() => {
    let id;
    if (blockTimer) id = setInterval(() => setElapsed(Date.now() - blockTimer), 1000);
    return () => clearInterval(id);
  }, [blockTimer]);

  const startBlock = useCallback(() => {
    setBlockTimer(Date.now());
    setBlockCalls(0);
    toast("Call block started", "success");
  }, []);
  const endBlock = useCallback(() => {
    const hrs = (Date.now() - blockTimer) / 3600000;
    const cph = hrs > 0 ? Math.round(blockCalls / hrs) : 0;
    setBlockTimer(null);
    setElapsed(0);
    setBlockCalls(0);
    toast(`Block ended: ${cph} calls/hour`);
  }, [blockTimer, blockCalls]);

  // derived queue (uses debouncedQuery)
  const queue = useMemo(() => {
    let filtered = leads.filter((l) => (hideDNC ? !l.dnc : true));
    if (debouncedQuery) {
      const q = debouncedQuery.toLowerCase();
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
  }, [leads, logs, debouncedQuery, stateFilter, onlyInWindow, hideDNC]);

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

  // memoized callbacks passed to children (prevents re-renders)
  const callLead = useCallback((lead) => {
    window.location.href = `tel:${normalizePhone(lead.phone)}`;
    toast(`Calling ${lead.name}…`);
  }, []);
  const onOutcome = useCallback(
    (lead, outcome) => {
      logCall(lead, outcome);
      if (blockTimer) setBlockCalls((c) => c + 1);
    },
    [logCall, blockTimer]
  );
  const onToggleDnc = useCallback((lead) => toggleDnc(lead), [toggleDnc]);
  const onDelete = useCallback((lead) => deleteLead(lead), [deleteLead]);
  const onSelect = useCallback((lead) => setSelectedLead(lead), []);
  const onReorder = useCallback((id, newOrder) => updateOrder(id, newOrder), [updateOrder]);

  // auth
  const doSignIn = useCallback(async () => {
    try {
      const { signInWithPopup } = await import("firebase/auth");
      await signInWithPopup(auth, googleProvider);
      toast("Signed in", "success");
    } catch (e) {
      console.error(e);
      toast("Sign-in failed", "error");
    }
  }, []);
  const doSignOut = useCallback(async () => {
    try {
      await auth.signOut();
      toast("Signed out", "success");
    } catch (e) {
      console.error(e);
      toast("Sign-out failed", "error");
    }
  }, []);

  // avatar
  const avatarUrl = useMemo(() => {
    if (!currentUser) return "";
    const name = currentUser.displayName || currentUser.email || "User";
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(
      name
    )}&background=667eea&color=fff`;
  }, [currentUser]);

  // keyboard shortcuts (depends on queue + logCall)
  useEffect(() => {
    const h = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      const top = queue[0];
      if (!top) return;
      if (e.key === "c") callLead(top);
      else if (e.key === "1") logCall(top, "No answer");
      else if (e.key === "2") logCall(top, "Left VM");
      else if (e.key === "3") logCall(top, "Conversation");
      else if (e.key === "4") logCall(top, "DNC");
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowAdd(true);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [queue, logCall, callLead]);

  /* ---------- Signed-out ---------- */
  if (!currentUser) {
    return (
      <Fragment>
        <Header
          theme={theme}
          setTheme={setTheme}
          view={view}
          setView={setView}
          loading={loading}
          currentUser={currentUser}
          doSignIn={doSignIn}
          doSignOut={doSignOut}
          scrolled={scrolled}
          avatarUrl={""}
        />
        <div className="app-container">
          <div className="card" style={{ textAlign: "center", padding: 40 }}>
            <div className="empty-icon">📞</div>
            <div className="empty-title">Welcome to Power Dialer</div>
            <div className="empty-message">Sign in to load your personal leads and start calling.</div>
          </div>
        </div>
      </Fragment>
    );
  }

  /* ---------- Signed-in ---------- */
  return (
    <Fragment>
      <Header
        theme={theme}
        setTheme={setTheme}
        view={view}
        setView={setView}
        loading={loading}
        currentUser={currentUser}
        doSignIn={doSignIn}
        doSignOut={doSignOut}
        scrolled={scrolled}
        avatarUrl={avatarUrl}
      />

      <div className="app-container">
        {view === "queue" && (
          <QueueView
            loading={loading}
            leads={leads}
            queue={queue}
            groupedLeads={groupedLeads}
            groupByCollege={groupByCollege}
            groupByTz={groupByTz}
            stateFilter={stateFilter}
            setStateFilter={setStateFilter}
            onlyInWindow={onlyInWindow}
            setOnlyInWindow={setOnlyInWindow}
            hideDNC={hideDNC}
            setHideDNC={setHideDNC}
            groupByCollegeToggle={() => setGroupByCollege((v) => !v)}
            groupByTzToggle={() => setGroupByTz((v) => !v)}
            searchInput={searchInput}
            setSearchInput={setSearchInput}
            setShowAdd={setShowAdd}
            blockTimer={blockTimer}
            elapsed={elapsed}
            blockCalls={blockCalls}
            startBlock={startBlock}
            endBlock={endBlock}
            callLead={callLead}
            logCall={onOutcome}
            toggleDnc={onToggleDnc}
            deleteLead={onDelete}
            setSelectedLead={onSelect}
            updateOrder={onReorder}
          />
        )}

        {view === "leads" && (
          <LeadsView
            leads={leads}
            loading={loading}
            setShowAdd={setShowAdd}
            callLead={callLead}
            logCall={onOutcome}
            toggleDnc={onToggleDnc}
            deleteLead={onDelete}
            setSelectedLead={onSelect}
            updateOrder={onReorder}
          />
        )}

        {view === "stats" && <StatsView logs={logs} />}
      </div>

      {/* FAB */}
      <div className="fab" onClick={() => setShowAdd(true)}>
        ＋
      </div>

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

            <div style={{ marginBottom: 20 }}>
              <div style={{ marginBottom: 10 }}>
                <span className="form-label">Title</span>
                <div>{selectedLead.title || "—"}</div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <span className="form-label">Organization</span>
                <div>{selectedLead.college || "—"}</div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <span className="form-label">Phone</span>
                <div>{formatPhoneDisplay(selectedLead.phone) || "—"}</div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <span className="form-label">Local Time</span>
                <div>
                  <span className="time-badge">{getLocalTime(selectedLead.timezone)}</span>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              <button
                className="btn"
                onClick={() => {
                  window.location.href = `tel:${normalizePhone(selectedLead.phone)}`;
                  toast(`Calling ${selectedLead.name}…`);
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
          </div>
        </div>
      )}

      {/* Keyboard hint */}
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
        }}
      >
        Press <span className="kbd">C</span> to call • <span className="kbd">1–4</span> outcomes •{" "}
        <span className="kbd">⌘K</span> add lead • Long-press a row to drag
      </div>
    </Fragment>
  );
}

export default Shell;