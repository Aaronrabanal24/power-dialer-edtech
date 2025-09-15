// Logical shape (TS-style for clarity)
type Lead = {
  name: string;
  phone: string;        // E.164 (+1xxxxxxxxxx)
  email?: string;
  college: string;
  title: string;
  state?: string;       // e.g. "CA"
  timezone?: string;    // e.g. "America/Los_Angeles"
  dnc: boolean;
  notes?: string;

  // system fields
  createdAt: Timestamp; // serverTimestamp()
  updatedAt: Timestamp; // serverTimestamp()
};
