import Dexie from "dexie"

export const db = new Dexie("SDRPowerQueueDB")
db.version(1).stores({
  leads: "++id, name, phone, college, title, state, timezone, createdAt",
  callLogs: "++id, leadId, outcome, timestamp"
})

// Simple helpers used by the app
export async function getLeads() {
  return await db.leads.toArray()
}
export async function addLead(lead) {
  return await db.leads.add({ ...lead, createdAt: new Date().toISOString() })
}
export async function updateLead(id, patch) {
  return await db.leads.update(id, patch)
}
export async function logCall(leadId, outcome) {
  return await db.callLogs.add({ leadId, outcome, timestamp: new Date().toISOString() })
}
export async function getLogs() {
  return await db.callLogs.toArray()
}

// --- DELETE HELPERS (safe no-ops if Dexie isn't wired) ---
export async function deleteLeadById(id) {
  try {
    if (typeof db?.leads?.delete === 'function') {
      await db.leads.delete(id); // Dexie path
    }
  } catch (e) {
    console.warn('deleteLeadById: non-fatal (likely no Dexie), UI will still remove from state/localStorage.', e);
  }
}