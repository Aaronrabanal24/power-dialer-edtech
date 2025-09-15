import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { auth, db } from "../services/firebase";
import {
  addDoc, collection, deleteDoc, doc, getDocs, onSnapshot,
  orderBy, query, updateDoc, where, writeBatch
} from "firebase/firestore";
import { STATE_TO_TZ } from "../utils/time";
import { normalizePhone } from "../utils/phone";

const LeadsCtx = createContext(null);
export const useLeads = () => useContext(LeadsCtx);

export function LeadsProvider({ children }) {
  const [user, setUser] = useState(null);
  const [leads, setLeads] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // auth
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => setUser(u || null));
    return () => unsub();
  }, []);

  // data subscriptions
  useEffect(() => {
    if (!user) { setLeads([]); setLogs([]); setLoading(false); return; }
    setLoading(true);

    const qLeads = query(
      collection(db, "leads"),
      where("userId", "==", user.uid),
      orderBy("order", "asc") // uses 'order' for persistent manual sort
    );
    const unsubLeads = onSnapshot(qLeads, (snap) => {
      const arr = [];
      snap.forEach((d) => {
        const data = d.data();
        arr.push({ id: d.id, ...data, order: data.order ?? data.createdAt ?? Date.now() });
      });
      setLeads(arr);
      setLoading(false);
    });

    const qLogs = query(
      collection(db, "callLogs"),
      where("userId", "==", user.uid),
      orderBy("at", "desc")
    );
    const unsubLogs = onSnapshot(qLogs, (snap) => {
      const arr = [];
      snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
      setLogs(arr);
    });

    return () => { unsubLeads(); unsubLogs(); };
  }, [user]);

  // actions
  const addLead = async (form) => {
    if (!user) throw new Error("Not signed in");
    const tz = STATE_TO_TZ[form.state] || form.timezone || "America/New_York";
    const now = Date.now();
    await addDoc(collection(db, "leads"), {
      userId: user.uid,
      name: form.name,
      phone: normalizePhone(form.phone),
      email: form.email || "",
      college: form.college,
      title: form.title,
      state: form.state || "",
      timezone: tz,
      notes: form.notes || "",
      dnc: false,
      createdAt: now,
      updatedAt: now,
      order: now,               // new leads go to bottom
    });
  };

  const toggleDnc = (lead) =>
    updateDoc(doc(db, "leads", lead.id), { dnc: !lead.dnc, updatedAt: Date.now() });

  const updateNotes = (leadId, notes) =>
    updateDoc(doc(db, "leads", leadId), { notes, updatedAt: Date.now() });

  const deleteLead = async (lead) => {
    // delete related logs then the lead
    const qLogs = query(
      collection(db, "callLogs"),
      where("userId", "==", user.uid),
      where("leadId", "==", lead.id)
    );
    const snap = await getDocs(qLogs);
    const batch = writeBatch(db);
    snap.forEach((d) => batch.delete(doc(db, "callLogs", d.id)));
    batch.delete(doc(db, "leads", lead.id));
    await batch.commit();
  };

  const logCall = async (lead, outcome) => {
    const now = Date.now();
    await addDoc(collection(db, "callLogs"), {
      userId: user.uid, leadId: lead.id, at: now, outcome,
    });
    if (outcome === "DNC") {
      await updateDoc(doc(db, "leads", lead.id), { dnc: true, updatedAt: now });
    }
  };

  // reorder helper (fractional indexing)
  const updateOrder = async (leadId, newOrder) => {
    await updateDoc(doc(db, "leads", leadId), { order: newOrder, updatedAt: Date.now() });
  };

  const value = useMemo(() => ({
    user, leads, logs, loading,
    addLead, toggleDnc, updateNotes, deleteLead, logCall, updateOrder,
  }), [user, leads, logs, loading]);

  return <LeadsCtx.Provider value={value}>{children}</LeadsCtx.Provider>;
}