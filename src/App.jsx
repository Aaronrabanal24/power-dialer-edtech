import React, { Fragment, useEffect, useMemo, useState } from "react";
import "./index.css";
import { auth, googleProvider } from "./services/firebase";
import { LeadsProvider, useLeads } from "./contexts/LeadsContext";
import AddLeadModal from "./components/AddLeadModal";
import LeadList from "./components/LeadList";
import { callWindowForTitle, getLocalHour, tzBucket } from "./utils/time";
import { normalizePhone } from "./utils/phone";

/* Theme helpers */
const getInitialTheme = () => localStorage.getItem("theme") || "system";
const applyTheme = (theme) => {
  if (theme === "system") {
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
  } else {
    document.documentElement.setAttribute("data-theme", theme);
  }
};
const toast = (msg, type="info") => {
  const existing = document.querySelector(".toast"); if (existing) existing.remove();
  const el = document.createElement("div"); el.className = `toast ${type}`; el.textContent = msg;
  document.body.appendChild(el); setTimeout(()=>el.remove(), 3000);
};

function Shell() {
  const { user } = auth;
  const [theme, setTheme] = useState(getInitialTheme);
  useEffect(() => { applyTheme(theme); localStorage.setItem("theme", theme); }, [theme]);
  useEffect(() => {
    const m = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => theme === "system" && applyTheme("system");
    m.addEventListener?.("change", handler); return () => m.removeEventListener?.("change", handler);
  }, [theme]);

  return (
    <LeadsProvider>
      <MainApp theme={theme} setTheme={setTheme} />
    </LeadsProvider>
  );
}

function MainApp({ theme, setTheme }) {
  const { user } = auth;
  const { leads, logs, loading, addLead, toggleDnc, updateNotes, deleteLead, logCall, updateOrder } = useLeads();

  // UI state
  const [view, setView] = useState("queue");
  const [searchQuery, setSearchQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [onlyInWindow, setOnlyInWindow] = useState(false);
  const [hideDNC, setHideDNC] = useState(true);
  const [groupByCollege, setGroupByCollege] = useState(false);
  const [groupByTz, setGroupByTz] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);

  // Call block
  const [blockTimer, setBlockTimer] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [blockCalls, setBlockCalls] = useState(0);
  useEffect(() => {
    let id; if (blockTimer) id = setInterval(() => setElapsed(Date.now() - blockTimer), 1000);
    return () => clearInterval(id);
  }, [blockTimer]);
  const fmt = (ms) => { const s=Math.floor(ms/1000), m=Math.floor(s/60), h=Math.floor(m/60); return `${String(h).padStart(2,"0")}:${String(m%60).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`; };

  // Filtered queue
  const queue = useMemo(() => {
    let filtered = leads.filter((l) => (hideDNC ? !l.dnc : true));
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((l) =>
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
    // Client-side priority score (kept from your version)
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

  // Grouped (for display only)
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

  // Actions
  const callLead = (lead) => { window.location.href = `tel:${normalizePhone(lead.phone)}`; toast(`Calling ${lead.name}…`); };
  const startBlock = () => { setBlockTimer(Date.now()); setBlockCalls(0); toast("Call block started","success"); };
  const endBlock = () => {
    const hrs = (Date.now() - blockTimer) / 3600000; const cph = hrs > 0 ? Math.round(blockCalls / hrs) : 0;
    setBlockTimer(null); setElapsed(0); setBlockCalls(0); toast(`Block ended: ${cph} calls/hour`);
  };

  // Auth buttons
  const signIn = async () => { try { await auth.signInWithPopup ? auth.signInWithPopup(googleProvider) : await import("firebase/auth").then(({ signInWithPopup }) => signInWithPopup(auth, googleProvider)); toast("Signed in","success"); } catch(e){ console.error(e); toast("Sign-in failed","error"); } };
  const signOutNow = async () => { await auth.signOut(); toast("Signed out","success"); };

  // Keyboard shortcuts
  useEffect(() => {
    const h = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      const top = queue[0]; if (!top) return;
      if (e.key === "c") callLead(top);
      else if (e.key === "1") logCall(top, "No answer");
      else if (e.key === "2") logCall(top, "Left VM");
      else if (e.key === "3") logCall(top, "Conversation");
      else if (e.key === "4") logCall(top, "DNC");
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setShowAdd(true); }
    };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [queue]);

  // UI
  if (!auth.currentUser) {
    return (
      <div className="app-container">
        <div className="nav-bar" style={{ justifyContent: "space-between" }}>
          <div className="nav-brand"><h1>SDR Power Queue</h1><span className="pill" style={{ background:"linear-gradient(135deg, var(--system-blue), var(--system-indigo))", color:"#fff" }}>Pro</span></div>
          <div style={{ display:"inline-flex", padding:2, background:"var(--vibrancy-dark)", borderRadius:14, gap:2 }}>
            {["light","dark","system"].map((opt) => (
              <button key={opt} onClick={()=>setTheme(opt)} style={{ appearance:"none", border:"none", padding:"8px 12px", borderRadius:12, fontWeight:700, fontSize:13, cursor:"pointer", color:"var(--label)", background: theme===opt ? "var(--system-background-secondary)" : "transparent", boxShadow: theme===opt ? "var(--shadow-sm)" : "none" }}>
                {opt === "system" ? "Auto" : opt[0].toUpperCase() + opt.slice(1)}
              </button>
            ))}
          </div>
          <button className="btn" onClick={signIn}>Sign in with Google</button>
        </div>

        <div className="card" style={{ textAlign:"center", padding:40 }}>
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
          <span className="pill" style={{ background:"linear-gradient(135deg, var(--system-blue), var(--system-indigo))", color:"#fff" }}>Pro</span>
        </div>

        <div className="segmented-control">
          <div className="indicator" style={{ width:"33.33%", left: view==="queue" ? "0%" : view==="leads" ? "33.33%" : "66.66%" }} />
          <button className={view==="queue" ? "active" : ""} onClick={()=>setView("queue")}>Queue</button>
          <button className={view==="leads" ? "active" : ""} onClick={()=>setView("leads")}>Leads</button>
          <button className={view==="stats" ? "active" : ""} onClick={()=>setView("stats")}>Stats</button>
        </div>

        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
          <div style={{ display:"inline-flex", padding:2, background:"var(--vibrancy-dark)", borderRadius:14, gap:2 }}>
            {["light","dark","system"].map((opt) => (
              <button key={opt} onClick={()=>setTheme(opt)} style={{ appearance:"none", border:"none", padding:"8px 12px", borderRadius:12, fontWeight:700, fontSize:13, cursor:"pointer", color:"var(--label)", background: theme===opt ? "var(--system-background-secondary)" : "transparent", boxShadow: theme===opt ? "var(--shadow-sm)" : "none" }}>
                {opt === "system" ? "Auto" : opt[0].toUpperCase() + opt.slice(1)}
              </button>
            ))}
          </div>
          <button className="btn btn-secondary" onClick={()=>auth.signOut()}>Sign out</button>
        </div>
      </div>

      <div className="app-container">
        {view === "queue" && (
          <Fragment>
            <div className="card timer-card">
              <div className="timer-display">{blockTimer ? fmt(elapsed) : "00:00:00"}</div>
              <div className="timer-metrics">
                <div className="metric"><div className="metric-value">{blockCalls}</div><div className="metric-label">Calls This Block</div></div>
                <div className="metric"><div className="metric-value">{blockTimer ? Math.round(blockCalls / ((Date.now()-blockTimer)/3600000)) : 0}</div><div className="metric-label">Calls/Hour</div></div>
              </div>
              <div style={{ display:"flex", gap:12, marginTop:20 }}>
                {!blockTimer ? (<button className="btn" onClick={startBlock}>Start Call Block</button>) : (<button className="btn btn-danger" onClick={endBlock}>End Block</button>)}
              </div>
            </div>

            <div className="search-bar">
              <span className="search-icon">🔎</span>
              <input className="search-input" placeholder="Search leads..." value={searchQuery} onChange={(e)=>setSearchQuery(e.target.value)} />
            </div>

            <div className="filter-pills">
              <div className={`pill ${onlyInWindow ? "active" : ""}`} onClick={()=>setOnlyInWindow(v=>!v)}>⏰ In Window</div>
              <div className={`pill ${hideDNC ? "active" : ""}`} onClick={()=>setHideDNC(v=>!v)}>Hide DNC</div>
              <div className={`pill ${groupByCollege ? "active" : ""}`} onClick={()=>setGroupByCollege(v=>!v)}>Group by College</div>
              <div className={`pill ${groupByTz ? "active" : ""}`} onClick={()=>setGroupByTz(v=>!v)}>Group by Timezone</div>
              <select className="form-select" style={{ width:"auto", marginLeft:8 }} value={stateFilter} onChange={(e)=>setStateFilter(e.target.value)}>
                <option value="">All States</option>
                {Array.from(new Set(leads.map(l => l.state).filter(Boolean))).sort().map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button className="btn btn-secondary" onClick={()=>setShowAdd(true)}>＋ Add Lead</button>
            </div>

            <div className="card">
              <h2 style={{ marginBottom:12 }}>Call Queue ({queue.length} leads)</h2>

              {loading ? (
                <div className="spinner" />
              ) : (
                Object.entries(groupedLeads).map(([group, items]) => (
                  <div key={group} style={{ marginBottom: 18 }}>
                    {(groupByCollege || groupByTz) && (
                      <div className="ellipsis" style={{ fontSize:13, fontWeight:700, color:"var(--label-secondary)", margin:"6px 0" }}>{group}</div>
                    )}

                    {/* Drag is enabled only when not grouped to avoid ambiguity */}
                    {groupByCollege || groupByTz ? (
                      <LeadList
                        items={items}
                        onReorder={() => { /* noop when grouped */ }}
                        onCall={(l)=>callLead(l)}
                        onOutcome={(l,o)=>{ logCall(l,o); if (blockTimer) setBlockCalls(c=>c+1); }}
                        onToggleDnc={(l)=>toggleDnc(l)}
                        onDelete={(l)=>deleteLead(l)}
                        onSelect={(l)=>setSelectedLead(l)}
                      />
                    ) : (
                      <LeadList
                        items={items}
                        onReorder={(id, newOrder) => updateOrder(id, newOrder)}
                        onCall={(l)=>callLead(l)}
                        onOutcome={(l,o)=>{ logCall(l,o); if (blockTimer) setBlockCalls(c=>c+1); }}
                        onToggleDnc={(l)=>toggleDnc(l)}
                        onDelete={(l)=>deleteLead(l)}
                        onSelect={(l)=>setSelectedLead(l)}
                      />
                    )}
                  </div>
                ))
              )}
            </div>
          </Fragment>
        )}

        {view === "leads" && (
          <div className="card">
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <h2>All Leads ({leads.length})</h2>
              <button className="btn btn-secondary" onClick={()=>setShowAdd(true)}>＋ Add Lead</button>
            </div>
            <LeadList
              items={leads}
              onReorder={(id,newOrder)=>updateOrder(id,newOrder)}
              onCall={(l)=>callLead(l)}
              onOutcome={(l,o)=>logCall(l,o)}
              onToggleDnc={(l)=>toggleDnc(l)}
              onDelete={(l)=>deleteLead(l)}
              onSelect={(l)=>setSelectedLead(l)}
            />
          </div>
        )}

        {view === "stats" && (
          <div className="card">
            <h2>Stats</h2>
            {/* keep your existing stats UI if you like; omitted for brevity */}
            <p>Total calls: {logs.length}</p>
          </div>
        )}
      </div>

      {showAdd && (
        <AddLeadModal
          onSubmit={async (data) => { try { await addLead(data); setShowAdd(false); toast("Lead added","success"); } catch(e){ console.error(e); toast("Failed to add lead","error"); } }}
          onCancel={() => setShowAdd(false)}
        />
      )}

      {selectedLead && (
        <div className="modal-backdrop" onClick={()=>setSelectedLead(null)}>
          <div className="modal" onClick={(e)=>e.stopPropagation()}>
            <div className="modal-header"><h2 className="modal-title">{selectedLead.name}</h2><button className="btn-icon btn-ghost" onClick={()=>setSelectedLead(null)}>✕</button></div>
            {/* keep your details UI from previous version */}
            <div className="form-group"><label className="form-label">Notes</label>
              <textarea className="form-textarea" value={selectedLead.notes || ""} onChange={(e)=>setSelectedLead({...selectedLead, notes: e.target.value})} onBlur={(e)=>updateNotes(selectedLead.id, e.target.value)} />
            </div>
          </div>
        </div>
      )}

      <div style={{ position:"fixed", bottom:24, left:"50%", transform:"translateX(-50%)", background:"var(--material-thick)", backdropFilter:"blur(20px)", padding:"8px 16px", borderRadius:20, fontSize:13, color:"var(--label-tertiary)", boxShadow:"var(--shadow-md)", zIndex:10 }}>
        Press <span className="kbd">C</span> to call • <span className="kbd">1–4</span> for outcomes • <span className="kbd">⌘K</span> to add lead • Long-press a row to drag
      </div>
    </Fragment>
  );
}

export default Shell;
