// src/services/leads.js
import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  onSnapshot,
  query,
  orderBy,
  where,
} from "firebase/firestore";
import { db } from "../firebase";

// Optional: your timezone map; keep in one place if you use it
export const STATE_TO_TZ = {
  AL: 'America/Chicago', AK: 'America/Anchorage', AZ: 'America/Phoenix', AR: 'America/Chicago',
  CA: 'America/Los_Angeles', CO: 'America/Denver', CT: 'America/New_York', DE: 'America/New_York',
  FL: 'America/New_York', GA: 'America/New_York', HI: 'Pacific/Honolulu', ID: 'America/Denver',
  IL: 'America/Chicago', IN: 'America/New_York', IA: 'America/Chicago', KS: 'America/Chicago',
  KY: 'America/New_York', LA: 'America/Chicago', ME: 'America/New_York', MD: 'America/New_York',
  MA: 'America/New_York', MI: 'America/New_York', MN: 'America/Chicago', MS: 'America/Chicago',
  MO: 'America/Chicago', MT: 'America/Denver', NE: 'America/Chicago', NV: 'America/Los_Angeles',
  NH: 'America/New_York', NJ: 'America/New_York', NM: 'America/Denver', NY: 'America/New_York',
  NC: 'America/New_York', ND: 'America/Chicago', OH: 'America/New_York', OK: 'America/Chicago',
  OR: 'America/Los_Angeles', PA: 'America/New_York', RI: 'America/New_York', SC: 'America/New_York',
  SD: 'America/Chicago', TN: 'America/Chicago', TX: 'America/Chicago', UT: 'America/Denver',
  VT: 'America/New_York', VA: 'America/New_York', WA: 'America/Los_Angeles', WV: 'America/New_York',
  WI: 'America/Chicago', WY: 'America/Denver'
};

export const normalizePhone = (phone) => {
  const cleaned = (phone || "").replace(/\D/g, "");
  if (cleaned.length === 10) return "+1" + cleaned;
  if (cleaned.length === 11 && cleaned[0] === "1") return "+" + cleaned;
  return cleaned ? "+" + cleaned : "";
};

// Collection helper
const userLeadsCol = (uid) => collection(db, "users", uid, "leads");

/**
 * Subscribe to all leads for a user (realtime)
 * @param {string} uid
 * @param {(leads: Array<{id:string} & Lead>) => void} callback
 * @param {object} opts optional { hideDNC: boolean, state?: string }
 * @returns unsubscribe function
 */
export function subscribeLeads(uid, callback, opts = {}) {
  let constraints = [orderBy("createdAt", "desc")];
  if (opts.hideDNC) constraints.push(where("dnc", "==", false));
  // Example: if you want to filter by state in the UI
  if (opts.state) constraints.push(where("state", "==", opts.state));

  const q = query(userLeadsCol(uid), ...constraints);
  return onSnapshot(q, (snap) => {
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(data);
  });
}

/**
 * Create a lead
 * @param {string} uid
 * @param {Partial<Lead>} lead
 * @returns {Promise<string>} new doc id
 */
export async function createLead(uid, lead) {
  const payload = {
    name: lead.name?.trim() || "",
    phone: normalizePhone(lead.phone || ""),
    email: (lead.email || "").trim(),
    college: lead.college?.trim() || "",
    title: lead.title?.trim() || "",
    state: lead.state || "",
    timezone: lead.timezone || (lead.state ? STATE_TO_TZ[lead.state] : ""),
    dnc: !!lead.dnc,
    notes: lead.notes || "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const ref = await addDoc(userLeadsCol(uid), payload);
  return ref.id;
}

/**
 * Update a lead (partial)
 * @param {string} uid
 * @param {string} leadId
 * @param {Partial<Lead>} patch
 */
export async function updateLead(uid, leadId, patch) {
  const ref = doc(db, "users", uid, "leads", leadId);
  const payload = {
    ...patch,
    ...(patch.phone ? { phone: normalizePhone(patch.phone) } : {}),
    updatedAt: serverTimestamp(),
  };
  await updateDoc(ref, payload);
}

/**
 * Replace a lead (full set)
 * @param {string} uid
 * @param {string} leadId
 * @param {Lead} lead
 */
export async function setLead(uid, leadId, lead) {
  const ref = doc(db, "users", uid, "leads", leadId);
  await setDoc(ref, {
    ...lead,
    phone: normalizePhone(lead.phone),
    updatedAt: serverTimestamp(),
    createdAt: lead.createdAt || serverTimestamp(),
  });
}

/**
 * Delete a lead
 * @param {string} uid
 * @param {string} leadId
 */
export async function deleteLead(uid, leadId) {
  const ref = doc(db, "users", uid, "leads", leadId);
  await deleteDoc(ref);
}