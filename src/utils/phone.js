export const normalizePhone = (phone = "") => {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10) return "+1" + cleaned;
  if (cleaned.length === 11 && cleaned[0] === "1") return "+" + cleaned;
  return cleaned ? "+" + cleaned : "";
};

export const formatDisplayPhone = (raw = "") => {
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
};