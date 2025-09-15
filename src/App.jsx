// src/App.jsx
import React, { useEffect, useMemo, useState } from "react";

/* ========= Icons (inline SVG) ========= */
const PhoneIcon = (props) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
);
const SearchIcon = (props) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
  </svg>
);
const PlusIcon = (props) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const XIcon = (props) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const ClockIcon = (props) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);

/* ========= Utils ========= */
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
  WI: "America/Chicago", WY: "America/Denver"
};

const normalizePhone = (phone) => {
  const cleaned = (phone || "").replace(/\D/g, "");
  if (cleaned.length === 10) return "+1" + cleaned;
  if (cleaned.length === 11 && cleaned[0] === "1") return "+" + cleaned;
  return cleaned ? "+" + cleaned : "";
};

const getLocalTime = (timezone) => {
  try {
    return new Date().toLocaleTimeString("en-US", { timeZone: timezone, hour12: true, hour: "numeric", minute: "2-digit" });
  } catch {
    return new Date().toLocaleTimeString("en-US", { hour12: true, hour: "numeric", minute: "2-digit" });
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
    instructional: { start: 10, end: 16 }
  };
  for (const [key, window] of Object.entries(windows)) if (t.includes(key)) return window;
  return { start: 9, end: 16 };
};
const tzBucket = (iana) => {
  if (!iana) return "Other";
  if (iana.includes("Los_Angeles") || iana.includes("Anchorage") || iana.includes("Honolulu")) return "PT";
  if (iana.includes("Denver") || iana.includes("Phoenix")) return "MT";
  if (iana.includes("Chicago")) return "CT";
  if (iana.includes("New_York")) return "ET";
  // Include Atlantic (e.g., Puerto Rico) if you ever store it
  if (iana.includes("Puerto_Rico") || iana.includes("Halifax")) return "AT";
  return "Other";
};

/* ========= Toast (simple) ========= */
const toast = (msg, type = "info") => {
  const old = document.querySelector(".toast");
  if (old) old.remove();
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2500);
};

/* ========= Add Lead Modal ========= */
function AddLeadModal({ onClose, onAdd }) {
  const [form, setForm] = useState({ name: "", phone: "", college: "", title: "", state: "", email: "", notes: "" });
  const submit = (e) => {
    e.preventDefault();
    if (!form.name || !form.phone || !form.college || !form.title) return;
    onAdd({
      id: Date.now().toString(),
      ...form,
      phone: normalizePhone(form.phone),
      timezone: STATE_TO_TZ[form.state] || "America/New_York",
      dnc: false
    });
    onClose();
    toast("Lead added", "success");
  };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Add New Lead</h2>
          <button className="btn-icon btn-ghost" onClick={onClose} title="Close"><XIcon/></button>
        </div>
        <form onSubmit={submit}>
          <div className="form-group">
            <label className="form-label">Name *</label>
            <input className="form-input" value={form.name} onChange={(e)=>setForm({...form, name:e.target.value})} required autoFocus/>
          </div>
          <div className="form-group">
            <label className="form-label">Phone *</label>
            <input className="form-input" value={form.phone} onChange={(e)=>setForm({...form, phone:e.target.value})} required placeholder="(555) 123-4567"/>
          </div>
          <div className="form-group">
            <label className="form-label">College/University *</label>
            <input className="form-input" value={form.college} onChange={(e)=>setForm({...form, college:e.target.value})} required/>
          </div>
          <div className="form-group">
            <label className="form-label">Title *</label>
            <input className="form-input" value={form.title} onChange={(e)=>setForm({...form, title:e.target.value})} required placeholder="e.g., Distance Ed Director"/>
          </div>
          <div className="form-group">
            <label className="form-label">State</label>
            <select className="form-select" value={form.state} onChange={(e)=>setForm({...form, state:e.target.value})}>
              <option value="">Select State</option>
              {Object.keys(STATE_TO_TZ).map((s)=>(<option key={s} value={s}>{s}</option>))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" value={form.email} onChange={(e)=>setForm({...form, email:e.target.value})} placeholder="email@university.edu"/>
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" value={form.notes} onChange={(e)=>setForm({...form, notes:e.target.value})} placeholder="Any additional information..."/>
          </div>
          <div style={{ display:"flex", gap:12, justifyContent:"flex-end" }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn">Add Lead</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ========= App ========= */
export default function App() {
  // Views
  const [view, setView] = useState("queue");

  // Data
  const [leads, setLeads] = useState([]);
  const [logs, setLogs] = useState([]);

  // Filters/controls
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [onlyInWindow, setOnlyInWindow] = useState(false);
  const [hideDNC, setHideDNC] = useState(true);
  const [sortBy, setSortBy] = useState("score");
  const [groupBy, setGroupBy] = useState("none"); // none | college | timezone

  // Modals/selection
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState(null);

  // Call block
  const [blockStart, setBlockStart] = useState(null);
  const [blockCalls, setBlockCalls] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  // Theme
  const [theme, setTheme] = useState(localStorage.getItem("ui_theme") || "system");
  useEffect(() => {
    if (theme === "system") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", theme);
    }
    localStorage.setItem("ui_theme", theme);
  }, [theme]);

  // Load & persist
  useEffect(() => {
    const L = localStorage.getItem("sdr_leads");
    const G = localStorage.getItem("sdr_logs");
    if (L) setLeads(JSON.parse(L));
    if (G) setLogs(JSON.parse(G));
    if (!L) {
      const samples = [
        { id: "1", name: "John Smith", phone: "+14155550101", college: "UC Berkeley", title: "Distance Ed Director", state: "CA", timezone: "America/Los_Angeles", dnc: false },
        { id: "2", name: "Sarah Johnson", phone: "+12125550102", college: "NYU", title: "LMS Administrator", state: "NY", timezone: "America/New_York", dnc: false },
        { id: "3", name: "Mike Chen", phone: "+13125550103", college: "Northwestern", title: "ADA Coordinator", state: "IL", timezone: "America/Chicago", dnc: false },
        { id: "4", name: "Emily Davis", phone: "+17135550104", college: "Rice University", title: "Testing Manager", state: "TX", timezone: "America/Chicago", dnc: false },
        { id: "5", name: "Robert Wilson", phone: "+13035550105", college: "CU Boulder", title: "Instructional Designer", state: "CO", timezone: "America/Denver", dnc: false }
      ];
      setLeads(samples);
      localStorage.setItem("sdr_leads", JSON.stringify(samples));
    }
  }, []);
  useEffect(() => { localStorage.setItem("sdr_leads", JSON.stringify(leads)); }, [leads]);
  useEffect(() => { localStorage.setItem("sdr_logs", JSON.stringify(logs)); }, [logs]);

  // Timer
  useEffect(() => {
    if (!blockStart) return;
    const id = setInterval(()=> setElapsed(Date.now() - blockStart), 1000);
    return () => clearInterval(id);
  }, [blockStart]);

  // Derived queue
  const queue = useMemo(() => {
    let arr = leads.filter(l => !l.dnc || !hideDNC);
    if (search) {
      const q = search.toLowerCase();
      arr = arr.filter(l =>
        l.name.toLowerCase().includes(q) ||
        l.college.toLowerCase().includes(q) ||
        l.title.toLowerCase().includes(q) ||
        (l.phone || "").includes(q)
      );
    }
    if (stateFilter) arr = arr.filter(l => l.state === stateFilter);
    if (onlyInWindow) {
      arr = arr.filter(l => {
        const hour = getLocalHour(l.timezone);
        const win = callWindowForTitle(l.title);
        return hour >= win.start && hour <= win.end;
      });
    }
    arr.sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "lastCall") {
        const aLast = logs.filter(x=>x.leadId===a.id).sort((x,y)=> new Date(y.at)-new Date(x.at))[0];
        const bLast = logs.filter(x=>x.leadId===b.id).sort((x,y)=> new Date(y.at)-new Date(x.at))[0];
        return (aLast?.at ? new Date(aLast.at).getTime():0) - (bLast?.at ? new Date(bLast.at).getTime():0);
      }
      // score
      const ah = getLocalHour(a.timezone), bh = getLocalHour(b.timezone);
      const aw = callWindowForTitle(a.title), bw = callWindowForTitle(b.title);
      const as = Math.abs(ah - (aw.start + aw.end)/2);
      const bs = Math.abs(bh - (bw.start + bw.end)/2);
      return as - bs;
    });
    return arr;
  }, [leads, logs, search, stateFilter, onlyInWindow, hideDNC, sortBy]);

  // Stats
  const stats = useMemo(() => {
    const total = logs.length;
    const count = (k) => logs.filter(l => l.outcome === k).length;
    return {
      total,
      conversations: count("Conversation"),
      voicemails: count("Left VM"),
      noAnswers: count("No answer"),
      dnc: count("DNC"),
      convRate: total ? Math.round((count("Conversation")/total)*100) : 0
    };
  }, [logs]);

  // Actions
  const startBlock = () => { setBlockStart(Date.now()); setBlockCalls(0); toast("Call block started","success"); };
  const endBlock = () => {
    const ms = Date.now() - blockStart;
    const hours = ms/3600000;
    const cph = hours ? Math.round(blockCalls/hours) : 0;
    toast(`Block ended: ${blockCalls} calls, ${cph} calls/hour`);
    setBlockStart(null); setBlockCalls(0); setElapsed(0);
  };
  const callLead = (lead) => {
    window.location.href = `tel:${lead.phone}`;
    toast(`Calling ${lead.name}…`);
  };
  const logCall = (leadId, outcome) => {
    setLogs(prev => [...prev, { id: Date.now().toString(), leadId, at: new Date().toISOString(), outcome }]);
    if (blockStart) setBlockCalls(c => c+1);
    if (outcome === "DNC") setLeads(prev => prev.map(l => l.id === leadId ? { ...l, dnc:true } : l));
  };
  const addLead = (lead) => setLeads(prev => [...prev, lead]);
  const toggleDNC = (leadId) => setLeads(prev => prev.map(l => l.id===leadId ? ({...l, dnc:!l.dnc}) : l));
  const deleteLead = (leadId) => {
    if (!confirm("Delete this contact? This also keeps historical logs (for stats).")) return;
    setLeads(prev => prev.filter(l => l.id !== leadId));
    toast("Contact deleted","success");
  };

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      const typing = ["INPUT","TEXTAREA","SELECT"].includes(e.target.tagName);
      if (typing) return;
      if (e.key === "c" && queue.length) callLead(queue[0]);
      if (e.key === "1" && queue.length) logCall(queue[0].id, "No answer");
      if (e.key === "2" && queue.length) logCall(queue[0].id, "Left VM");
      if (e.key === "3" && queue.length) logCall(queue[0].id, "Conversation");
      if (e.key === "4" && queue.length) logCall(queue[0].id, "DNC");
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setShowAdd(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [queue]);

  const formatElapsed = (ms) => {
    const s = Math.floor(ms/1000), m = Math.floor(s/60), h = Math.floor(m/60);
    return `${String(h).padStart(2,"0")}:${String(m%60).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
  };

  // Grouping (Leads view)
  const groupedLeads = useMemo(() => {
    if (groupBy === "none") return { All: leads };
    const groups = {};
    if (groupBy === "college") {
      for (const l of leads) {
        const key = l.college || "—";
        (groups[key] ||= []).push(l);
      }
    } else if (groupBy === "timezone") {
      for (const l of leads) {
        const key = tzBucket(l.timezone);
        (groups[key] ||= []).push(l);
      }
    }
    return groups;
  }, [leads, groupBy]);

  return (
    <>
      {/* Nav Bar */}
      <div className="nav-bar">
        <div className="nav-brand">
          <h1>SDR Power Queue</h1>
          <span className="pill" style={{ background: "linear-gradient(135deg, var(--blue), var(--indigo))", color:"#fff" }}>Pro</span>
        </div>

        <div className="segmented-control">
          <div
            className="indicator"
            style={{
              width: "33.33%",
              left: view === "queue" ? "0%" : view === "leads" ? "33.33%" : "66.66%"
            }}
          />
          <button className={view==="queue" ? "active":""} onClick={()=>setView("queue")}>Queue</button>
          <button className={view==="leads" ? "active":""} onClick={()=>setView("leads")}>Leads</button>
          <button className={view==="stats" ? "active":""} onClick={()=>setView("stats")}>Stats</button>
        </div>

        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <button className="btn-icon btn-secondary" onClick={()=>setShowAdd(true)} title="Add lead"><PlusIcon/></button>
          <select className="form-select" style={{ height:40, padding:"8px 10px" }} value={theme} onChange={(e)=>setTheme(e.target.value)} title="Theme">
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
      </div>

      <div className="app-container">
        {/* ===== Queue View ===== */}
        {view === "queue" && (
          <>
            {/* Timer Card */}
            <div className="card timer-card">
              <div className="timer-display">{formatElapsed(elapsed)}</div>
              <div className="timer-metrics">
                <div className="metric">
                  <div className="metric-value">{blockCalls}</div>
                  <div className="metric-label">Calls This Block</div>
                </div>
                <div className="metric">
                  <div className="metric-value">{blockStart ? Math.round(blockCalls / ((Date.now() - blockStart)/3600000)) : 0}</div>
                  <div className="metric-label">Calls/Hour</div>
                </div>
              </div>
              <div style={{ display:"flex", gap:12, marginTop:20 }}>
                {!blockStart ? (
                  <button className="btn" onClick={startBlock}>Start Call Block</button>
                ) : (
                  <button className="btn btn-danger" onClick={endBlock}>End Block</button>
                )}
              </div>
            </div>

            {/* Search / filters */}
            <div className="search-bar">
              <span className="search-icon"><SearchIcon/></span>
              <input className="search-input" placeholder="Search leads..." value={search} onChange={(e)=>setSearch(e.target.value)} />
            </div>
            <div className="filter-pills">
              <div className={`pill ${onlyInWindow ? "active":""}`} onClick={()=>setOnlyInWindow(v=>!v)}><ClockIcon/> In Window</div>
              <div className={`pill ${hideDNC ? "active":""}`} onClick={()=>setHideDNC(v=>!v)}>Hide DNC</div>
              <select className="form-select" style={{ width:"auto" }} value={stateFilter} onChange={(e)=>setStateFilter(e.target.value)}>
                <option value="">All States</option>
                {Object.keys(STATE_TO_TZ).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select className="form-select" style={{ width:"auto" }} value={sortBy} onChange={(e)=>setSortBy(e.target.value)}>
                <option value="score">Best Time</option>
                <option value="name">Name</option>
                <option value="lastCall">Oldest Last Call</option>
              </select>
            </div>

            {/* Queue table */}
            <div className="card">
              <h2 style={{ marginBottom: 20 }}>Call Queue ({queue.length} leads)</h2>
              {queue.length ? (
                <div className="ios-table">
                  <div className="ios-table-header">
                    <div>Lead</div><div>Local Time</div><div>Phone</div><div>Actions</div>
                  </div>
                  {queue.slice(0, 30).map((lead, idx) => {
                    const hour = getLocalHour(lead.timezone);
                    const win = callWindowForTitle(lead.title);
                    const inWindow = hour >= win.start && hour <= win.end;
                    return (
                      <div key={lead.id} className={`ios-table-row ${idx===0 ? "priority":""}`} onClick={()=>setSelected(lead)}>
                        <div className="lead-info">
                          <div className="lead-name">{lead.name}</div>
                          <div className="lead-meta">{lead.title} • {lead.college}</div>
                        </div>
                        <div>
                          <div className={`time-badge ${inWindow ? "in-window":"outside"}`}>{getLocalTime(lead.timezone)}</div>
                        </div>
                        <div>{lead.phone}</div>
                        <div className="action-buttons" onClick={(e)=>e.stopPropagation()}>
                          {idx===0 ? (
                            <button className="action-btn primary" onClick={()=>callLead(lead)}><PhoneIcon/> Call</button>
                          ) : (
                            <>
                              <button className="action-btn" onClick={()=>logCall(lead.id,"No answer")}>NA</button>
                              <button className="action-btn" onClick={()=>logCall(lead.id,"Left VM")}>VM</button>
                              <button className="action-btn" onClick={()=>logCall(lead.id,"Conversation")}>Conv</button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">📞</div>
                  <div className="empty-title">No leads in queue</div>
                  <div className="empty-message">Adjust your filters or add new leads</div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ===== Leads View ===== */}
        {view === "leads" && (
          <div className="card">
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
              <h2>All Leads ({leads.length})</h2>
              <div style={{ display:"flex", gap:8 }}>
                <select className="form-select" value={groupBy} onChange={(e)=>setGroupBy(e.target.value)}>
                  <option value="none">No Grouping</option>
                  <option value="college">Group by College</option>
                  <option value="timezone">Group by Timezone (PT/MT/CT/ET/AT)</option>
                </select>
                <button className="btn" onClick={()=>setShowAdd(true)}><PlusIcon/> Add</button>
              </div>
            </div>

            {/* Render groups */}
            {Object.entries(groupedLeads).map(([header, items]) => (
              <div key={header} style={{ marginBottom: 20 }}>
                {groupBy !== "none" && <div style={{ fontWeight:700, margin:"6px 0 10px" }}>{header} · {items.length}</div>}
                <div className="ios-table">
                  <div className="ios-table-header">
                    <div>Name</div><div>Contact</div><div>Organization</div><div>Status</div>
                  </div>
                  {items.map((lead) => (
                    <div key={lead.id} className="ios-table-row" onClick={()=>setSelected(lead)}>
                      <div>{lead.name}</div>
                      <div>{lead.phone}</div>
                      <div>{lead.college}</div>
                      <div style={{ display:"flex", gap:8 }}>
                        <div
                          className={`pill ${lead.dnc ? "" : "active"}`}
                          onClick={(e)=>{ e.stopPropagation(); toggleDNC(lead.id); }}
                        >{lead.dnc ? "DNC" : "Active"}</div>
                        <button className="action-btn" onClick={(e)=>{ e.stopPropagation(); deleteLead(lead.id); }}>Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ===== Stats View ===== */}
        {view === "stats" && (
          <>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value">{stats.total}</div>
                <div className="stat-label">Total Calls</div>
                <div className="stat-change positive">↑ trending</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.convRate}%</div>
                <div className="stat-label">Conversation Rate</div>
                <div className="stat-change positive">↑ week over week</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.conversations}</div>
                <div className="stat-label">Conversations</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.voicemails}</div>
                <div className="stat-label">Voicemails</div>
              </div>
            </div>

            <div className="card">
              <h2 style={{ marginBottom: 20 }}>Call Outcomes</h2>
              <div style={{ display:"grid", gap:12 }}>
                {["No answer","Left VM","Conversation","DNC"].map((outcome) => {
                  const count = logs.filter(l => l.outcome === outcome).length;
                  const percent = stats.total ? Math.round((count / stats.total) * 100) : 0;
                  return (
                    <div key={outcome}
                         style={{ display:"flex", justifyContent:"space-between", padding:12, background:"var(--material-thin)", borderRadius:12 }}>
                      <span>{outcome}</span>
                      <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                        <span style={{ fontWeight:600 }}>{count}</span>
                        <span style={{ color:"var(--label-tertiary)" }}>{percent}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* FAB */}
      <div className="fab" onClick={()=>setShowAdd(true)} title="Add lead"><PlusIcon/></div>

      {/* Quick actions (backup/export) */}
      <div className="quick-actions">
        <div className="quick-action" title="Download backup" onClick={()=>{
          const data = { leads, logs };
          const blob = new Blob([JSON.stringify(data,null,2)], { type:"application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url; a.download = `sdr-backup-${new Date().toISOString().slice(0,10)}.json`; a.click();
          URL.revokeObjectURL(url); toast("Backup downloaded","success");
        }}>💾</div>
        <div className="quick-action" title="Export CSV" onClick={()=>{
          const csv = [
            ["Name","Phone","College","Title","State","Timezone","DNC"],
            ...leads.map(l => [l.name,l.phone,l.college,l.title,l.state,l.timezone,l.dnc])
          ].map(r => r.map(v => `"${String(v??"").replaceAll('"','""')}"`).join(",")).join("\n");
          const blob = new Blob([csv], { type:"text/csv" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url; a.download = `leads-${new Date().toISOString().slice(0,10)}.csv`; a.click();
          URL.revokeObjectURL(url); toast("CSV exported","success");
        }}>📊</div>
      </div>

      {/* Add Lead Modal */}
      {showAdd && <AddLeadModal onClose={()=>setShowAdd(false)} onAdd={addLead} />}

      {/* Lead Details Modal */}
      {selected && (
        <div className="modal-backdrop" onClick={()=>setSelected(null)}>
          <div className="modal" onClick={(e)=>e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{selected.name}</h2>
              <button className="btn-icon btn-ghost" onClick={()=>setSelected(null)} title="Close"><XIcon/></button>
            </div>

            <div style={{ marginBottom:20 }}>
              <div style={{ marginBottom:12 }}>
                <span className="form-label">Title</span>
                <div>{selected.title}</div>
              </div>
              <div style={{ marginBottom:12 }}>
                <span className="form-label">Organization</span>
                <div>{selected.college}</div>
              </div>
              <div style={{ marginBottom:12 }}>
                <span className="form-label">Phone</span>
                <div>{selected.phone}</div>
              </div>
              <div style={{ marginBottom:12 }}>
                <span className="form-label">Local Time</span>
                <div>
                  <span className={`time-badge ${
                      (()=>{
                        const h = getLocalHour(selected.timezone);
                        const w = callWindowForTitle(selected.title);
                        return h>=w.start && h<=w.end;
                      })() ? "in-window" : "outside"
                    }`}>
                    {getLocalTime(selected.timezone)}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display:"flex", gap:8, marginBottom:20 }}>
              <button className="btn" onClick={()=>{ callLead(selected); setSelected(null); }}><PhoneIcon/> Call</button>
              <button className="btn btn-secondary" onClick={()=>{ logCall(selected.id,"No answer"); setSelected(null); }}>No Answer</button>
              <button className="btn btn-secondary" onClick={()=>{ logCall(selected.id,"Left VM"); setSelected(null); }}>VM</button>
              <button className="btn btn-success" onClick={()=>{ logCall(selected.id,"Conversation"); setSelected(null); }}>Conv</button>
              <button className="btn btn-danger" onClick={()=>{ deleteLead(selected.id); setSelected(null); }}>Delete</button>
            </div>

            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea
                className="form-textarea"
                value={selected.notes || ""}
                onChange={(e)=>{
                  const notes = e.target.value;
                  setLeads(prev => prev.map(l => l.id===selected.id ? {...l, notes} : l));
                  setSelected(s => s ? {...s, notes} : s);
                }}
                placeholder="Add notes about this lead..."
              />
            </div>

            <div>
              <h3 style={{ marginBottom:12 }}>Call History</h3>
              <div style={{ maxHeight:200, overflowY:"auto" }}>
                {logs.filter(l => l.leadId === selected.id)
                     .sort((a,b)=> new Date(b.at)-new Date(a.at))
                     .map(log => (
                  <div key={log.id} style={{ padding:8, borderBottom:"1px solid var(--separator)", display:"flex", justifyContent:"space-between" }}>
                    <span>{new Date(log.at).toLocaleString()}</span>
                    <span style={{ fontWeight:600 }}>{log.outcome}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}