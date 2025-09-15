import React, { useEffect, useMemo, useState, Fragment } from "react";
import "./index.css";

/** -----------------------------
 *  THEME (Light / Dark / Auto)
 *  ----------------------------- */
function getInitialTheme() {
  const saved = localStorage.getItem("theme");
  return saved || "system"; // 'light' | 'dark' | 'system'
}
function applyTheme(theme) {
  if (theme === "system") {
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
  } else {
    document.documentElement.setAttribute("data-theme", theme);
  }
}

/** -----------------------------
 *  FIREBASE INIT (Inline for 1-file drop-in)
 *  ----------------------------- */
import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  getDocs,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyC7j8NDqql1k88x3YSIm4X-L74CsNAU16c",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "power-dialer-ece33.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "power-dialer-ece33",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:328642191235:web:d6b558e16630b5924060b6",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "power-dialer-ece33.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "328642191235",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-V1P1DCEPKP",
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/** -----------------------------
 *  ICONS (inline SVG)
 *  ----------------------------- */
const PhoneIcon = (props) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
);
const SearchIcon = (props) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </svg>
);
const PlusIcon = (props) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
const ClockIcon = (props) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);
const XIcon = (props) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

/** -----------------------------
 *  UTILITIES
 *  ----------------------------- */
const STATE_TO_TZ = {
  AL: "America/Chicago", AK: "America/Anchorage", AZ: "America/Phoenix", AR: "America/Chicago",
  CA: "America/Los_Angeles", CO: "America/Denver", CT: "America/New_York", DE: "America/New_York",
  FL: "America/New_York", GA: "America/New_York", HI: "Pacific/Honolulu", ID: "America/Denver",
  IL: "America/Chicago", IN: "America/New_York", IA: "America/Chicago", KS: "America/Chicago",
  KY: "America/New_York", LA: "America/Chicago", ME: "America/New_York", MD: "America/New_York",
  MA: "America/New_York", MI: "America/New_York", MN: "America/Chicago", MS: "America/Chicago",
  MO: "America/Chicago", MT: "America/Denver", NE: "America/Chicago", NV: "America/Los_Angeles",
  NH: "America/New_York", NJ: "America/New_York", NM: "America/Denver", NY: "America/New_York",
  NC: "America/New_York", ND: "America/Chicago", OH: "America/New_York", OK: "America/Chicago",
  OR: "America/Los_Angeles", PA: "America/New_York", RI: "America/New_York", SC: "America/New_York",
  SD: "America/Chicago", TN: "America/Chicago", TX: "America/Chicago", UT: "America/Denver",
  VT: "America/New_York", VA: "America/New_York", WA: "America/Los_Angeles", WV: "America/New_York",
  WI: "America/Chicago", WY: "America/Denver",
};
const normalizePhone = (phone) => {
  const cleaned = (phone || "").replace(/\D/g, "");
  if (cleaned.length === 10) return "+1" + cleaned;
  if (cleaned.length === 11 && cleaned[0] === "1") return "+" + cleaned;
  return cleaned ? "+" + cleaned : "";
};
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
const getLocalHour = (timezone) => {
  try {
    const hh = new Date().toLocaleTimeString("en-US", { timeZone: timezone, hour12: false, hour: "2-digit" });
    return parseInt(hh, 10);
  } catch {
    return new Date().getHours();
  }
};
const callWindowForTitle = (title) => {
  const t = (title || "").toLowerCase();
  const windows = {
    "distance ed": { start: 10, end: 16 },
    lms: { start: 10, end: 16 },
    ada: { start: 11, end: 15 },
    accessibility: { start: 11, end: 15 },
    testing: { start: 9, end: 15 },
    instructional: { start: 10, end: 16 },
  };
  for (const [key, win] of Object.entries(windows)) if (t.includes(key)) return win;
  return { start: 9, end: 16 };
};
// Buckets: Pacific, Mountain, Central, Eastern, Atlantic
function tzBucket(tz) {
  if (!tz) return "Other";
  if (tz.includes("Los_Angeles")) return "Pacific";
  if (tz.includes("Denver") || tz.includes("Phoenix")) return "Mountain";
  if (tz.includes("Chicago")) return "Central";
  if (tz.includes("New_York")) return "Eastern";
  if (tz.includes("Halifax")) return "Atlantic";
  return "Other";
}

// Pretty phone formatter: (xxx) xxx - xxxx [ext. n]
function formatDisplayPhone(raw = "") {
  if (!raw) return "";
  const extMatch = raw.match(/(?:ext\.?|x|xt|extension)\s*\.?:?\s*(\d{1,6})/i);
  const ext = extMatch ? extMatch[1] : "";
  let digits = (raw.match(/\d+/g) || []).join("");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  if (digits.length < 10) return raw.trim();
  const area = digits.slice(0, 3);
  const pre  = digits.slice(3, 6);
  const line = digits.slice(6, 10);
  return `(${area}) ${pre} - ${line}${ext ? ` ext. ${ext}` : ""}`;
}

/** -----------------------------
 *  TOAST (lightweight)
 *  ----------------------------- */
function toast(msg, type = "info") {
  const existing = document.querySelector(".toast");
  if (existing) existing.remove();
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

/** -----------------------------
 *  ADD LEAD FORM
 *  ----------------------------- */
function AddLeadForm({ onSubmit, onCancel }) {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    college: "",
    title: "",
    state: "",
    email: "",
    notes: "",
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (form.name && form.phone && form.college && form.title) {
          onSubmit(form);
        } else {
          toast("Please fill required fields", "error");
        }
      }}
    >
      <div className="form-group">
        <label className="form-label">Name *</label>
        <input
          className="form-input"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
          autoFocus
        />
      </div>
      <div className="form-group">
        <label className="form-label">Phone *</label>
        <input
          className="form-input"
          type="tel"
          placeholder="(555) 123-4567"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          required
        />
      </div>
      <div className="form-group">
        <label className="form-label">College/University *</label>
        <input
          className="form-input"
          value={form.college}
          onChange={(e) => setForm({ ...form, college: e.target.value })}
          required
        />
      </div>
      <div className="form-group">
        <label className="form-label">Title *</label>
        <input
          className="form-input"
          placeholder="e.g., Distance Ed Director"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          required
        />
      </div>
      <div className="form-group">
        <label className="form-label">State</label>
        <select
          className="form-select"
          value={form.state}
          onChange={(e) => setForm({ ...form, state: e.target.value })}
        >
          <option value="">Select State</option>
          {Object.keys(STATE_TO_TZ).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Email</label>
        <input
          className="form-input"
          type="email"
          placeholder="email@university.edu"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
      </div>
      <div className="form-group">
        <label className="form-label">Notes</label>
        <textarea
          className="form-textarea"
          placeholder="Any additional info…"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
      </div>
      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn">
          Add Lead
        </button>
      </div>
    </form>
  );
}

/** -----------------------------
 *  MAIN APP
 *  ----------------------------- */
export default function App() {
  // THEME
  const [theme, setTheme] = useState(getInitialTheme);
  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem("theme", theme);
  }, [theme]);
  useEffect(() => {
    const m = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (theme === "system") applyTheme("system");
    };
    m.addEventListener?.("change", handler);
    return () => m.removeEventListener?.("change", handler);
  }, [theme]);

  // AUTH
  const [user, setUser] = useState(null);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u || null);
    });
    return () => unsub();
  }, []);
  const signIn = async () => {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      toast("Signed in", "success");
    } catch (e) {
      console.error(e);
      toast("Sign-in failed", "error");
    }
  };
  const signOutNow = async () => {
    await signOut(auth);
    toast("Signed out", "success");
  };

  // DATA
  const [leads, setLeads] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // UI STATE
  const [view, setView] = useState("queue"); // queue | leads | stats
  const [searchQuery, setSearchQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [onlyInWindow, setOnlyInWindow] = useState(false);
  const [hideDNC, setHideDNC] = useState(true);
  const [groupByCollege, setGroupByCollege] = useState(false);
  const [groupByTz, setGroupByTz] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);

  // BLOCK TIMER
  const [blockTimer, setBlockTimer] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [blockCalls, setBlockCalls] = useState(0);
  useEffect(() => {
    let id;
    if (blockTimer) {
      id = setInterval(() => setElapsed(Date.now() - blockTimer), 1000);
    }
    return () => clearInterval(id);
  }, [blockTimer]);

  // SUBSCRIPTIONS (Firestore)
  useEffect(() => {
    if (!user) {
      setLeads([]);
      setLogs([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    const leadsQ = query(
      collection(db, "leads"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );
    const unsubLeads = onSnapshot(leadsQ, (snap) => {
      const arr = [];
      snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
      setLeads(arr);
      setLoading(false);
    });

    const logsQ = query(
      collection(db, "callLogs"),
      where("userId", "==", user.uid),
      orderBy("at", "desc")
    );
    const unsubLogs = onSnapshot(logsQ, (snap) => {
      const arr = [];
      snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
      setLogs(arr);
    });

    return () => {
      unsubLeads();
      unsubLogs();
    };
  }, [user]);

  // ACTIONS (Firestore)
  const addLead = async (data) => {
    if (!user) return toast("Sign in first", "error");
    const tz =
      STATE_TO_TZ[data.state] ||
      data.timezone ||
      "America/New_York";
    const payload = {
      userId: user.uid,
      name: data.name,
      phone: normalizePhone(data.phone),
      email: data.email || "",
      college: data.college,
      title: data.title,
      state: data.state || "",
      timezone: tz,
      notes: data.notes || "",
      dnc: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    try {
      await addDoc(collection(db, "leads"), payload);
      setShowAdd(false);
      toast("Lead added", "success");
    } catch (e) {
      console.error(e);
      toast("Failed to add lead", "error");
    }
  };

  const toggleDnc = async (lead) => {
    try {
      await updateDoc(doc(db, "leads", lead.id), {
        dnc: !lead.dnc,
        updatedAt: Date.now(),
      });
    } catch (e) {
      console.error(e);
      toast("Failed to update DNC", "error");
    }
  };

  const updateNotes = async (leadId, notes) => {
    try {
      await updateDoc(doc(db, "leads", leadId), { notes, updatedAt: Date.now() });
    } catch (e) {
      console.error(e);
      toast("Failed to update notes", "error");
    }
  };

  const deleteLead = async (lead) => {
    if (!confirm(`Delete ${lead.name} (${lead.college})?`)) return;
    try {
      // delete logs for this lead (optional cleanup)
      const qLogs = query(
        collection(db, "callLogs"),
        where("userId", "==", user.uid),
        where("leadId", "==", lead.id)
      );
      const snap = await getDocs(qLogs);
      await Promise.all(snap.docs.map((d) => deleteDoc(doc(db, "callLogs", d.id))));
      await deleteDoc(doc(db, "leads", lead.id));
      toast("Lead deleted", "success");
    } catch (e) {
      console.error(e);
      toast("Failed to delete lead", "error");
    }
  };

  const logCall = async (lead, outcome) => {
    try {
      await addDoc(collection(db, "callLogs"), {
        userId: user.uid,
        leadId: lead.id,
        at: Date.now(),
        outcome,
      });
      if (outcome === "DNC") {
        await updateDoc(doc(db, "leads", lead.id), { dnc: true, updatedAt: Date.now() });
      }
      if (blockTimer) setBlockCalls((c) => c + 1);
      toast(`Logged: ${outcome}`, "success");
    } catch (e) {
      console.error(e);
      toast("Failed to log call", "error");
    }
  };

  // QUEUE
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
    // Score by proximity to window midpoint
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

  const groupedLeads = useMemo(() => {
    if (!groupByCollege && !groupByTz) return { All: queue };
    const buckets = {};
    queue.forEach((l) => {
      const groups = [];
      if (groupByCollege) groups.push(l.college || "Unknown College");
      if (groupByTz) groups.push(tzBucket(l.timezone));
      const key = groups.join(" • ") || "All";
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push(l);
    });
    return buckets;
  }, [queue, groupByCollege, groupByTz]);

  // STATS
  const stats = useMemo(() => {
    const total = logs.length;
    const conversations = logs.filter((l) => l.outcome === "Conversation").length;
    const voicemails = logs.filter((l) => l.outcome === "Left VM").length;
    const noAnswers = logs.filter((l) => l.outcome === "No answer").length;
    const dnc = logs.filter((l) => l.outcome === "DNC").length;
    return {
      total,
      convRate: total ? Math.round((conversations / total) * 100) : 0,
      conversations,
      voicemails,
      noAnswers,
      dnc,
    };
  }, [logs]);

  // SHORTCUTS
  useEffect(() => {
    const h = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
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
  }, [queue, user]);

  // ACTIONS
  const callLead = (lead) => {
    // always dial normalized E.164 (extensions typically not supported by tel:)
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
    toast(`Block ended: ${cph} calls/hour`, "info");
  };
  const fmt = (ms) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    return `${String(h).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  };

  // RENDER
  if (!user) {
    return (
      <div className="app-container">
        <div className="nav-bar" style={{ justifyContent: "space-between" }}>
          <div className="nav-brand">
            <h1>SDR Power Queue</h1>
            <span className="pill" style={{ background: "linear-gradient(135deg, var(--system-blue), var(--system-indigo))", color: "white" }}>Pro</span>
          </div>

          {/* Theme switch */}
          <div style={{ display: "inline-flex", padding: 2, background: "var(--vibrancy-dark)", borderRadius: 14, gap: 2 }}>
            {["light","dark","system"].map((opt) => (
              <button
                key={opt}
                onClick={() => setTheme(opt)}
                style={{
                  appearance: "none",
                  border: "none",
                  padding: "8px 12px",
                  borderRadius: 12,
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                  color: "var(--label)",
                  background: theme === opt ? "var(--system-background-secondary)" : "transparent",
                  boxShadow: theme === opt ? "var(--shadow-sm)" : "none",
                }}
                aria-pressed={theme === opt}
              >
                {opt === "system" ? "Auto" : opt[0].toUpperCase() + opt.slice(1)}
              </button>
            ))}
          </div>

          <button className="btn" onClick={signIn}>Sign in with Google</button>
        </div>

        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <div className="empty-icon">📞</div>
          <div className="empty-title">Welcome to SDR Power Queue</div>
          <div className="empty-message">Sign in to load your personal leads and start calling.</div>
        </div>
      </div>
    );
  }

  return (
    <Fragment>
      <div className="nav-bar">
        <div className="nav-brand" style={{ gap: 8 }}>
          <h1>SDR Power Queue</h1>
          <span className="pill" style={{ background: "linear-gradient(135deg, var(--system-blue), var(--system-indigo))", color: "white" }}>Pro</span>
        </div>

        <div className="segmented-control">
          <div
            className="indicator"
            style={{
              width: "33.33%",
              left: view === "queue" ? "0%" : view === "leads" ? "33.33%" : "66.66%",
            }}
          />
          <button className={view === "queue" ? "active" : ""} onClick={() => setView("queue")}>Queue</button>
          <button className={view === "leads" ? "active" : ""} onClick={() => setView("leads")}>Leads</button>
          <button className={view === "stats" ? "active" : ""} onClick={() => setView("stats")}>Stats</button>
        </div>

        {/* Right side controls: Theme + User */}
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ display: "inline-flex", padding: 2, background: "var(--vibrancy-dark)", borderRadius: 14, gap: 2 }}>
            {["light","dark","system"].map((opt) => (
              <button
                key={opt}
                onClick={() => setTheme(opt)}
                style={{
                  appearance: "none",
                  border: "none",
                  padding: "8px 12px",
                  borderRadius: 12,
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                  color: "var(--label)",
                  background: theme === opt ? "var(--system-background-secondary)" : "transparent",
                  boxShadow: theme === opt ? "var(--shadow-sm)" : "none",
                }}
                aria-pressed={theme === opt}
              >
                {opt === "system" ? "Auto" : opt[0].toUpperCase() + opt.slice(1)}
              </button>
            ))}
          </div>
          <button className="btn btn-secondary" onClick={signOutNow}>Sign out</button>
        </div>
      </div>

      <div className="app-container">
        {/* QUEUE VIEW */}
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
                  <button className="btn" onClick={startBlock}>Start Call Block</button>
                ) : (
                  <button className="btn btn-danger" onClick={endBlock}>End Block</button>
                )}
              </div>
            </div>

            <div className="search-bar">
              <span className="search-icon"><SearchIcon /></span>
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
                <ClockIcon /> In Window
              </div>
              <div
                className={`pill ${hideDNC ? "active" : ""}`}
                onClick={() => setHideDNC((v) => !v)}
              >
                Hide DNC
              </div>
              <div
                className={`pill ${groupByCollege ? "active" : ""}`}
                onClick={() => setGroupByCollege((v) => !v)}
              >
                Group by College
              </div>
              <div
                className={`pill ${groupByTz ? "active" : ""}`}
                onClick={() => setGroupByTz((v) => !v)}
              >
                Group by Timezone
              </div>
              <select
                className="form-select"
                style={{ width: "auto", marginLeft: 8 }}
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
              >
                <option value="">All States</option>
                {Object.keys(STATE_TO_TZ).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <button className="btn btn-secondary" onClick={() => setShowAdd(true)}>
                <PlusIcon /> Add Lead
              </button>
            </div>

            {/* Grouped queue render */}
            <div className="card">
              <h2 style={{ marginBottom: 12 }}>
                Call Queue ({queue.length} leads)
              </h2>

              {loading ? (
                <div className="spinner" />
              ) : (
                Object.entries(groupedLeads).map(([group, items]) => (
                  <div key={group} style={{ marginBottom: 18 }}>
                    {(groupByCollege || groupByTz) && (
                      <div className="ellipsis" style={{ fontSize: 13, fontWeight: 700, color: "var(--label-secondary)", margin: "6px 0" }}>
                        {group}
                      </div>
                    )}
                    <div className="ios-table">
                      <div className="ios-table-header">
                        <div>Lead</div>
                        <div>Local Time</div>
                        <div>Phone</div>
                        <div>Actions</div>
                      </div>
                      {items.length === 0 ? (
                        <div className="ios-table-row">No leads</div>
                      ) : (
                        items.slice(0, 50).map((lead, idx) => {
                          const hour = getLocalHour(lead.timezone);
                          const win = callWindowForTitle(lead.title);
                          const inWindow = hour >= win.start && hour <= win.end;
                          return (
                            <div
                              key={lead.id}
                              className={`ios-table-row ${idx === 0 ? "priority" : ""}`}
                              onClick={() => setSelectedLead(lead)}
                            >
                              <div className="lead-info">
                                <div className="lead-name ellipsis">{lead.name}</div>
                                <div className="lead-meta ellipsis">
                                  {(lead.title || "—") + " • " + (lead.college || "—")}
                                </div>
                              </div>
                              <div>
                                <div className={`time-badge ${inWindow ? "in-window" : "outside"}`}>
                                  {getLocalTime(lead.timezone)}
                                </div>
                              </div>
                              <div className="mono">{formatDisplayPhone(lead.phone)}</div>
                              <div className="action-buttons" onClick={(e) => e.stopPropagation()}>
                                {idx === 0 ? (
                                  <button className="action-btn primary" onClick={() => callLead(lead)}>
                                    <PhoneIcon /> Call
                                  </button>
                                ) : (
                                  <Fragment>
                                    <button className="action-btn" onClick={() => logCall(lead, "No answer")}>NA</button>
                                    <button className="action-btn" onClick={() => logCall(lead, "Left VM")}>VM</button>
                                    <button className="action-btn" onClick={() => logCall(lead, "Conversation")}>Conv</button>
                                  </Fragment>
                                )}
                                <button className="action-btn" onClick={() => toggleDnc(lead)}>{lead.dnc ? "Undnc" : "DNC"}</button>
                                <button className="action-btn" onClick={() => deleteLead(lead)}>Delete</button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Fragment>
        )}

        {/* LEADS VIEW */}
        {view === "leads" && (
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h2>All Leads ({leads.length})</h2>
              <button className="btn btn-secondary" onClick={() => setShowAdd(true)}><PlusIcon /> Add Lead</button>
            </div>
            {loading ? (
              <div className="spinner" />
            ) : (
              <div className="ios-table">
                <div className="ios-table-header">
                  <div>Name</div>
                  <div>Contact</div>
                  <div>Organization</div>
                  <div>Status</div>
                </div>
                {leads.map((lead) => (
                  <div key={lead.id} className="ios-table-row" onClick={() => setSelectedLead(lead)}>
                    <div className="ellipsis">{lead.name}</div>
                    <div className="mono">{formatDisplayPhone(lead.phone)}</div>
                    <div className="ellipsis">{lead.college}</div>
                    <div className="action-buttons" onClick={(e) => e.stopPropagation()}>
                      <div
                        className={`pill ${lead.dnc ? "" : "active"}`}
                        onClick={() => toggleDnc(lead)}
                      >
                        {lead.dnc ? "DNC" : "Active"}
                      </div>
                      <button className="action-btn" onClick={() => deleteLead(lead)}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* STATS VIEW */}
        {view === "stats" && (
          <Fragment>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value">{stats.total}</div>
                <div className="stat-label">Total Calls</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.convRate}%</div>
                <div className="stat-label">Conversation Rate</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.conversations}</div>
                <div className="stat-label">Conversations</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.voicemails}</div>
                <div className="stat-label">Voicemails</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.noAnswers}</div>
                <div className="stat-label">No Answers</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.dnc}</div>
                <div className="stat-label">DNC</div>
              </div>
            </div>

            <div className="card">
              <h2 style={{ marginBottom: 12 }}>Call Outcomes</h2>
              {["No answer", "Left VM", "Conversation", "DNC"].map((o) => {
                const count = logs.filter((l) => l.outcome === o).length;
                const pct = stats.total ? Math.round((count / stats.total) * 100) : 0;
                return (
                  <div
                    key={o}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: 12,
                      background: "var(--material-thin)",
                      borderRadius: 12,
                      marginBottom: 8,
                    }}
                  >
                    <span>{o}</span>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <span style={{ fontWeight: 600 }}>{count}</span>
                      <span style={{ color: "var(--label-tertiary)" }}>{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Fragment>
        )}
      </div>

      {/* FAB */}
      <div className="fab" onClick={() => setShowAdd(true)}><PlusIcon /></div>

      {/* ADD MODAL */}
      {showAdd && (
        <div className="modal-backdrop" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Add New Lead</h2>
              <button className="btn-icon btn-ghost" onClick={() => setShowAdd(false)}><XIcon /></button>
            </div>
            <AddLeadForm onSubmit={addLead} onCancel={() => setShowAdd(false)} />
          </div>
        </div>
      )}

      {/* LEAD DETAILS MODAL */}
      {selectedLead && (
        <div className="modal-backdrop" onClick={() => setSelectedLead(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{selectedLead.name}</h2>
              <button className="btn-icon btn-ghost" onClick={() => setSelectedLead(null)}><XIcon /></button>
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
                <div className="mono">{formatDisplayPhone(selectedLead.phone) || "—"}</div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <span className="form-label">Local Time</span>
                <div>
                  <span
                    className={`time-badge ${
                      (() => {
                        const h = getLocalHour(selectedLead.timezone);
                        const w = callWindowForTitle(selectedLead.title);
                        return h >= w.start && h <= w.end;
                      })()
                        ? "in-window"
                        : "outside"
                    }`}
                  >
                    {getLocalTime(selectedLead.timezone)}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              <button
                className="btn"
                onClick={() => {
                  callLead(selectedLead);
                  setSelectedLead(null);
                }}
              >
                <PhoneIcon /> Call
              </button>
              <button className="btn btn-secondary" onClick={() => logCall(selectedLead, "No answer")}>No Answer</button>
              <button className="btn btn-secondary" onClick={() => logCall(selectedLead, "Left VM")}>VM</button>
              <button className="btn btn-success" onClick={() => logCall(selectedLead, "Conversation")}>Conv</button>
              <button className="btn btn-danger" onClick={() => logCall(selectedLead, "DNC")}>DNC</button>
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

            <div>
              <h3 style={{ marginBottom: 12 }}>Call History</h3>
              <div style={{ maxHeight: 220, overflowY: "auto" }}>
                {logs
                  .filter((l) => l.leadId === selectedLead.id)
                  .map((log) => (
                    <div
                      key={log.id}
                      style={{
                        padding: 8,
                        borderBottom: "1px solid var(--separator)",
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
          background: "var(--material-thick)",
          backdropFilter: "blur(20px)",
          padding: "8px 16px",
          borderRadius: 20,
          fontSize: 13,
          color: "var(--label-tertiary)",
          boxShadow: "var(--shadow-md)",
          zIndex: 10,
        }}
      >
        Press <span className="kbd">C</span> to call • <span className="kbd">1–4</span> for outcomes •{" "}
        <span className="kbd">⌘K</span> to add lead
      </div>
    </Fragment>
  );
}