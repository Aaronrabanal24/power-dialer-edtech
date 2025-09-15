import React, { useState } from "react";
import { STATE_TO_TZ } from "../utils/time";

export default function AddLeadModal({ onSubmit, onCancel }) {
  const [form, setForm] = useState({ name:"", phone:"", college:"", title:"", state:"", email:"", notes:"" });

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Add New Lead</h2>
          <button className="btn-icon btn-ghost" onClick={onCancel}>✕</button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }}>
          <div className="form-group"><label className="form-label">Name *</label>
            <input className="form-input" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required autoFocus />
          </div>
          <div className="form-group"><label className="form-label">Phone *</label>
            <input className="form-input" type="tel" placeholder="(555) 123-4567" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} required />
          </div>
          <div className="form-group"><label className="form-label">College/University *</label>
            <input className="form-input" value={form.college} onChange={e=>setForm({...form,college:e.target.value})} required />
          </div>
          <div className="form-group"><label className="form-label">Title *</label>
            <input className="form-input" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} required />
          </div>
          <div className="form-group"><label className="form-label">State</label>
            <select className="form-select" value={form.state} onChange={e=>setForm({...form,state:e.target.value})}>
              <option value="">Select State</option>
              {Object.keys(STATE_TO_TZ).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group"><label className="form-label">Email</label>
            <input className="form-input" type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} />
          </div>
          <div className="form-group"><label className="form-label">Notes</label>
            <textarea className="form-textarea" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} />
          </div>

          <div style={{ display:"flex", gap:12, justifyContent:"flex-end" }}>
            <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
            <button type="submit" className="btn">Add Lead</button>
          </div>
        </form>
      </div>
    </div>
  );
}