// Input validation shared by the forms. Each helper returns an error message, or null when the input is fine.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(value: string) {
  const v = value.trim();
  return v.length <= 254 && EMAIL_PATTERN.test(v);
}

/** Digits with an optional leading +, and spaces, dashes or brackets between them: 7 to 15 digits (E.164 limit). */
export function isValidPhone(value: string) {
  const v = value.trim();
  if (!/^\+?[0-9\s\-()]+$/.test(v)) return false;
  const digits = v.replace(/\D/g, "").length;
  return digits >= 7 && digits <= 15;
}

export function isHexColor(value: string) {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
}

export function isHttpUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Collapse runs of whitespace and trim, so "  Anita   Sharma " is stored as "Anita Sharma". */
export function cleanName(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export const isFiniteNumber = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

// ── Billing ─────────────────────────────────────────────────────────────────────────────

export type BillingInput = {
  billAmount: number;
  discountType: "FLAT" | "PERCENT";
  discount: number;
  paymentStatus: "PAID" | "PARTIAL" | "UNPAID" | "FREE";
  amountPaid: number;
};

export function netBillOf(billAmount: number, discountType: "FLAT" | "PERCENT", discount: number) {
  const off = discountType === "PERCENT" ? (billAmount * discount) / 100 : discount;
  return Math.max(0, billAmount - off);
}

export function validateBilling(b: BillingInput): string | null {
  if (!isFiniteNumber(b.billAmount) || b.billAmount < 0) return "Bill amount must be a number, 0 or more.";
  if (!isFiniteNumber(b.discount) || b.discount < 0) return "Discount must be a number, 0 or more.";
  if (b.discountType === "PERCENT" && b.discount > 100) return "A percentage discount can't be more than 100%.";
  if (b.discountType === "FLAT" && b.discount > b.billAmount) return "The discount can't be more than the bill amount.";
  if (!isFiniteNumber(b.amountPaid) || b.amountPaid < 0) return "Amount received must be a number, 0 or more.";

  const net = Math.round(netBillOf(b.billAmount, b.discountType, b.discount) * 100) / 100;
  if (b.paymentStatus === "FREE") return null;
  if (b.amountPaid > net + 0.005) return `The amount received can't be more than the net bill (Rs. ${net}).`;
  if (b.paymentStatus === "PARTIAL" && net > 0 && (b.amountPaid <= 0 || b.amountPaid >= net)) {
    return `For a partial payment enter an amount above 0 and below the net bill (Rs. ${net}).`;
  }
  return null;
}

// ── Report details ──────────────────────────────────────────────────────────────────────

/** Collection time must be a real date and not in the future (a few minutes of clock drift is allowed). */
export function validateCollectedAt(value: string): string | null {
  if (!value) return "Enter the collection date and time.";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "The collection date is not valid.";
  if (d.getTime() > Date.now() + 5 * 60 * 1000) return "The collection date can't be in the future.";
  return null;
}

type FieldLike = { id: string; fieldName: string; fieldType: string };

/** Numeric parameters must hold a real number. Empty values are skipped (use missingResults for those). */
export function invalidNumericResults(fields: FieldLike[], values: Record<string, string>): string[] {
  return fields
    .filter((f) => {
      if (f.fieldType !== "NUMBER") return false;
      const v = (values[f.id] ?? "").trim();
      return v !== "" && !Number.isFinite(Number(v));
    })
    .map((f) => f.fieldName);
}

export function missingResults(fields: FieldLike[], values: Record<string, string>): string[] {
  return fields.filter((f) => !(values[f.id] ?? "").trim()).map((f) => f.fieldName);
}

export function summarize(names: string[], max = 3) {
  return `${names.slice(0, max).join(", ")}${names.length > max ? ` and ${names.length - max} more` : ""}`;
}

// ── Patients ────────────────────────────────────────────────────────────────────────────

export function validatePatientForm(v: {
  name: string;
  age: number | "";
  ageMonths: number | "";
  phone: string;
  email: string;
}): Record<string, string> {
  const e: Record<string, string> = {};

  const name = cleanName(v.name);
  if (!name) e.name = "Name is required";
  else if (name.length < 2) e.name = "Enter the patient's full name";
  else if (name.length > 100) e.name = "Name is too long (100 characters at most)";
  else if (!/\p{L}/u.test(name)) e.name = "Name must contain letters";

  const yearsEmpty = v.age === "" || v.age == null;
  const monthsEmpty = v.ageMonths === "" || v.ageMonths == null;
  const years = yearsEmpty ? 0 : Number(v.age);
  const months = monthsEmpty ? 0 : Number(v.ageMonths);
  if (yearsEmpty && monthsEmpty) e.age = "Age is required (years or months)";
  else if (!Number.isInteger(years) || years < 0 || years > 150) e.age = "Enter a whole number of years (0 to 150)";
  if (!Number.isInteger(months) || months < 0 || months > 11) e.ageMonths = "Months must be a whole number from 0 to 11";
  if (!e.age && !e.ageMonths && years === 0 && months === 0) e.age = "Age can't be 0 years and 0 months";

  if (v.phone.trim() && !isValidPhone(v.phone)) e.phone = "Enter a valid phone number (7 to 15 digits)";
  if (v.email.trim() && !isValidEmail(v.email)) e.email = "Enter a valid email address";
  return e;
}

// ── Passwords ───────────────────────────────────────────────────────────────────────────

const COMMON_PASSWORDS = new Set([
  "password", "password1", "password123", "12345678", "123456789", "1234567890", "qwerty123", "qwertyuiop",
  "iloveyou", "admin123", "welcome1", "letmein123", "abc12345", "labswift123",
]);

/** The rules shown to the user while they type; every one must pass. */
export function passwordChecks(password: string) {
  return [
    { label: "At least 8 characters", ok: password.length >= 8 },
    { label: "A letter and a number", ok: /\p{L}/u.test(password) && /\d/.test(password) },
  ];
}

export function validatePassword(
  password: string,
  confirm: string,
  email?: string | null,
): { password?: string; confirm?: string } {
  const e: { password?: string; confirm?: string } = {};
  if (!password) e.password = "Create a password";
  else if (password.length < 8) e.password = "Use at least 8 characters";
  else if (password.length > 72) e.password = "Use 72 characters or fewer";
  else if (!/\p{L}/u.test(password) || !/\d/.test(password)) e.password = "Include at least one letter and one number";
  else if (COMMON_PASSWORDS.has(password.toLowerCase())) e.password = "That password is too common. Choose something harder to guess";
  else if (email && password.toLowerCase() === email.toLowerCase()) e.password = "Your password can't be your email address";

  if (!confirm) e.confirm = "Re-enter the password to confirm it";
  else if (password !== confirm) e.confirm = "The passwords don't match";
  return e;
}
