import { clsx, type ClassValue } from "clsx";
import { format, formatDistanceToNow } from "date-fns";
import { twMerge } from "tailwind-merge";
import type { TemplateField } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  return format(new Date(date), "dd MMM yyyy");
}

export function formatDateTime(date: Date | string): string {
  return format(new Date(date), "dd MMM yyyy, hh:mm a");
}

export function formatRelative(date: Date | string): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export const STATUS_CONFIG = {
  DRAFT: { label: "Draft", color: "bg-amber-100 text-amber-700" },
  FINAL: { label: "Final", color: "bg-green-100 text-green-700" },
  SENT:  { label: "Sent",  color: "bg-blue-100 text-blue-700"  },
} as const;

export const GENDER_LABELS = {
  MALE: "Male",
  FEMALE: "Female",
  OTHER: "Other",
} as const;

/** Simple numeric range check (no gender awareness) */
export function isValueAbnormal(value: string, min?: number | null, max?: number | null): boolean {
  const num = parseFloat(value);
  if (Number.isNaN(num)) return false;
  if (min != null && num < min) return true;
  if (max != null && num > max) return true;
  return false;
}

/**
 * Gender-aware abnormality check.
 * Uses gender-specific min/max when available, falls back to generic ranges.
 */
export function isValueAbnormalGender(
  value: string,
  field: Pick<
    TemplateField,
    | "normalRangeMin" | "normalRangeMax"
    | "normalRangeMinMale" | "normalRangeMaxMale"
    | "normalRangeMinFemale" | "normalRangeMaxFemale"
  >,
  gender: string,
): boolean {
  const num = parseFloat(value);
  if (Number.isNaN(num)) return false;

  let min: number | null | undefined;
  let max: number | null | undefined;

  if (gender === "MALE" && (field.normalRangeMinMale != null || field.normalRangeMaxMale != null)) {
    min = field.normalRangeMinMale;
    max = field.normalRangeMaxMale;
  } else if (gender === "FEMALE" && (field.normalRangeMinFemale != null || field.normalRangeMaxFemale != null)) {
    min = field.normalRangeMinFemale;
    max = field.normalRangeMaxFemale;
  } else {
    min = field.normalRangeMin;
    max = field.normalRangeMax;
  }

  if (min != null && num < min) return true;
  if (max != null && num > max) return true;
  return false;
}

/**
 * Returns the correct display range text for a field based on patient gender.
 */
export function getRangeText(
  field: Pick<
    TemplateField,
    "normalRangeText" | "normalRangeTextMale" | "normalRangeTextFemale"
  >,
  gender: string,
): string {
  if (gender === "MALE" && field.normalRangeTextMale) return field.normalRangeTextMale;
  if (gender === "FEMALE" && field.normalRangeTextFemale) return field.normalRangeTextFemale;
  return field.normalRangeText || "";
}

export function buildWhatsAppLink(phone: string, message: string): string {
  const cleaned = phone.replace(/\D/g, "");
  const e164 = cleaned.startsWith("91") ? cleaned : `91${cleaned}`;
  return `https://wa.me/${e164}?text=${encodeURIComponent(message)}`;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function normalizeSearch(value: string): string {
  return value.trim().toLowerCase();
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatAge(age?: number | null, ageMonths?: number | null, uppercaseUnits = false): string {
  const y = age != null && !isNaN(Number(age)) ? Math.max(0, Number(age)) : 0;
  const m = ageMonths != null && !isNaN(Number(ageMonths)) ? Math.max(0, Number(ageMonths)) : 0;

  if (uppercaseUnits) {
    // PDF reports: always show years (so "0 Yrs 7 Mos" can't be misread as 7 years); show months only when non-zero
    if (m === 0) return `${y} Yrs`;
    return `${y} Yrs ${m} Mos`;
  }

  const yrLabel = "yrs";
  const moLabel = "mos";

  if (y > 0 && m > 0) return `${y} ${yrLabel} ${m} ${moLabel}`;
  if (y === 0 && m > 0) return `${m} ${moLabel}`;
  if (y > 0 && m === 0) return `${y} ${yrLabel}`;
  return `${y} ${yrLabel}`;
}