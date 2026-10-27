import {
  eachDayOfInterval,
  eachMonthOfInterval,
  differenceInCalendarDays,
  format,
  startOfDay,
  startOfMonth,
} from "date-fns";

import { supabase } from "@/lib/supabase";

// ── Raw rows ──────────────────────────────────────────────────────────────────

const PAGE = 1000;

const REPORT_FIN_SELECT = `
  id, reportNumber, createdAt, status, billAmount, discount, discountType, amountPaid, paymentStatus,
  template:test_templates!reports_templateId_fkey (id, name, category, price),
  patient:patients!reports_patientId_fkey (
    id, name, doctorId,
    doctor:doctors!patients_doctorId_fkey (name)
  )
`;

type FinReportRow = {
  id: string;
  reportNumber: string;
  createdAt: string;
  status: "DRAFT" | "FINAL" | "SENT";
  billAmount: number | null;
  discount: number | null;
  discountType: "FLAT" | "PERCENT" | null;
  amountPaid: number | null;
  paymentStatus: "PAID" | "PARTIAL" | "UNPAID" | "FREE" | null;
  template: { id: string; name: string; category: string; price: number | null } | null;
  patient: { id: string; name: string; doctorId: string | null; doctor: { name: string } | null } | null;
};

// report_incentives has lowercase billamount / incentiveamount / ispaid / paidat columns (see doctors.ts)
type FinIncentiveRow = {
  reportId: string;
  doctorId: string;
  incentiveRate: number;
  billamount: number | null;
  incentiveamount: number | null;
  ispaid: boolean | null;
  paidat: string | null;
};

export async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

export async function loadFinancialSource() {
  const [reports, incentives] = await Promise.all([
    fetchAll<FinReportRow>((from, to) =>
      supabase.from("reports").select(REPORT_FIN_SELECT).order("createdAt").range(from, to) as any,
    ),
    fetchAll<FinIncentiveRow>((from, to) =>
      supabase
        .from("report_incentives")
        .select(`"reportId", "doctorId", "incentiveRate", billamount, incentiveamount, ispaid, paidat`)
        .range(from, to) as any,
    ),
  ]);
  return { reports, incentives };
}

export type FinancialSource = Awaited<ReturnType<typeof loadFinancialSource>>;

// ── Computed model ────────────────────────────────────────────────────────────

export type FinLine = {
  id: string;
  reportNumber: string;
  date: Date;
  patientName: string;
  testId: string;
  testName: string;
  category: string;
  doctorId: string | null;
  doctorName: string | null; // null = self / walk-in
  paymentStatus: "PAID" | "PARTIAL" | "UNPAID" | "FREE";
  gross: number; // list price of the bill
  discount: number; // discount given (0 for free reports)
  waived: number; // amount written off on FREE reports
  net: number; // gross - discount - waived (what the patient owes)
  collected: number;
  due: number; // net - collected, never negative
  commission: number;
  commissionPaid: boolean;
};

export type Totals = {
  reports: number;
  gross: number;
  discount: number;
  waived: number;
  net: number;
  collected: number;
  due: number;
  commission: number;
  commissionPaid: number;
  commissionPending: number;
  netAfterCommission: number;
  avgBill: number;
  collectionRate: number; // 0..1
  discountRate: number; // 0..1 of gross
};

export type TestRevenue = { id: string; name: string; category: string; count: number; revenue: number; share: number };
export type DoctorRevenue = {
  key: string;
  name: string;
  count: number;
  revenue: number;
  commission: number;
  commissionPending: number;
};

export type FinancialModel = {
  totals: Totals;
  lines: FinLine[];
  trend: { label: string; billed: number; collected: number; reports: number }[];
  trendUnit: "day" | "month";
  tests: TestRevenue[]; // sorted by revenue desc, only tests with orders
  topTests: TestRevenue[];
  bottomTests: TestRevenue[];
  unorderedTests: { id: string; name: string; category: string }[];
  categories: { name: string; value: number }[];
  payments: { status: string; count: number; amount: number }[];
  referral: { name: string; value: number }[];
  doctors: DoctorRevenue[];
  topDues: FinLine[];
  draftsExcluded: number;
};

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const round2 = (n: number) => Math.round(n * 100) / 100;

function toLine(r: FinReportRow, inc: FinIncentiveRow | undefined): FinLine {
  const gross = Number(r.billAmount ?? r.template?.price ?? 0);
  const free = r.paymentStatus === "FREE";
  const dVal = Number(r.discount ?? 0);
  const dAmt = r.discountType === "PERCENT" ? (gross * dVal) / 100 : dVal;
  const discount = free ? 0 : Math.min(gross, Math.max(0, dAmt));
  const waived = free ? gross : 0;
  const net = Math.max(0, gross - discount - waived);
  const status = r.paymentStatus ?? "UNPAID";
  const collected = free
    ? 0
    : r.amountPaid != null
      ? Number(r.amountPaid)
      : status === "PAID"
        ? net
        : 0;

  return {
    id: r.id,
    reportNumber: r.reportNumber,
    date: new Date(r.createdAt),
    patientName: r.patient?.name ?? "Unknown",
    testId: r.template?.id ?? "unknown",
    testName: r.template?.name ?? "Unknown",
    category: r.template?.category ?? "Other",
    doctorId: r.patient?.doctorId ?? null,
    doctorName: r.patient?.doctor?.name ?? null,
    paymentStatus: status,
    gross: round2(gross),
    discount: round2(discount),
    waived: round2(waived),
    net: round2(net),
    collected: round2(collected),
    due: round2(Math.max(0, net - collected)),
    commission: round2(Number(inc?.incentiveamount ?? 0)),
    commissionPaid: inc?.ispaid ?? false,
  };
}

/**
 * Builds every figure the Financials page shows for reports created in [from, to].
 * DRAFT reports are excluded: they are not billed until finalised.
 */
export function computeFinancials(
  source: FinancialSource,
  range: { from: Date | null; to: Date },
  activeTemplates: { id: string; name: string; category: string }[],
): FinancialModel {
  const incByReport = new Map(source.incentives.map((i) => [i.reportId, i]));

  let draftsExcluded = 0;
  const lines: FinLine[] = [];
  for (const r of source.reports) {
    const d = new Date(r.createdAt);
    if (range.from && d < range.from) continue;
    if (d > range.to) continue;
    if (r.status === "DRAFT") {
      draftsExcluded++;
      continue;
    }
    lines.push(toLine(r, incByReport.get(r.id)));
  }

  const gross = sum(lines.map((l) => l.gross));
  const net = sum(lines.map((l) => l.net));
  const collected = sum(lines.map((l) => l.collected));
  const commission = sum(lines.map((l) => l.commission));
  const commissionPaid = sum(lines.filter((l) => l.commissionPaid).map((l) => l.commission));
  const totals: Totals = {
    reports: lines.length,
    gross: round2(gross),
    discount: round2(sum(lines.map((l) => l.discount))),
    waived: round2(sum(lines.map((l) => l.waived))),
    net: round2(net),
    collected: round2(collected),
    due: round2(sum(lines.map((l) => l.due))),
    commission: round2(commission),
    commissionPaid: round2(commissionPaid),
    commissionPending: round2(commission - commissionPaid),
    netAfterCommission: round2(net - commission),
    avgBill: lines.length ? round2(net / lines.length) : 0,
    collectionRate: net > 0 ? Math.min(1, collected / net) : 0,
    discountRate: gross > 0 ? sum(lines.map((l) => l.discount)) / gross : 0,
  };

  // ── Trend: daily for short ranges, monthly otherwise ──
  const first = range.from ?? (lines[0]?.date ?? range.to);
  const spanDays = differenceInCalendarDays(range.to, first) + 1;
  const trendUnit: "day" | "month" = spanDays <= 62 ? "day" : "month";
  const buckets = new Map<string, { label: string; billed: number; collected: number; reports: number }>();
  if (trendUnit === "day") {
    for (const d of eachDayOfInterval({ start: startOfDay(first), end: startOfDay(range.to) })) {
      buckets.set(format(d, "yyyy-MM-dd"), { label: format(d, "dd MMM"), billed: 0, collected: 0, reports: 0 });
    }
  } else {
    for (const d of eachMonthOfInterval({ start: startOfMonth(first), end: range.to })) {
      buckets.set(format(d, "yyyy-MM"), { label: format(d, "MMM yy"), billed: 0, collected: 0, reports: 0 });
    }
  }
  for (const l of lines) {
    const b = buckets.get(format(l.date, trendUnit === "day" ? "yyyy-MM-dd" : "yyyy-MM"));
    if (!b) continue;
    b.billed += l.net;
    b.collected += l.collected;
    b.reports += 1;
  }
  const trend = [...buckets.values()].map((b) => ({ ...b, billed: round2(b.billed), collected: round2(b.collected) }));

  // ── Revenue by test ──
  const testMap = new Map<string, TestRevenue>();
  for (const l of lines) {
    const t = testMap.get(l.testId) ?? { id: l.testId, name: l.testName, category: l.category, count: 0, revenue: 0, share: 0 };
    t.count += 1;
    t.revenue += l.net;
    testMap.set(l.testId, t);
  }
  const tests = [...testMap.values()]
    .map((t) => ({ ...t, revenue: round2(t.revenue), share: net > 0 ? t.revenue / net : 0 }))
    .sort((a, b) => b.revenue - a.revenue || b.count - a.count);
  const topTests = tests.slice(0, 5);
  const topIds = new Set(topTests.map((t) => t.id));
  const bottomTests = [...tests].reverse().filter((t) => !topIds.has(t.id)).slice(0, 5);
  const unorderedTests = activeTemplates
    .filter((t) => !testMap.has(t.id))
    .map(({ id, name, category }) => ({ id, name, category }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // ── Category / payment / referral splits ──
  const catMap = new Map<string, number>();
  for (const l of lines) catMap.set(l.category, (catMap.get(l.category) ?? 0) + l.net);
  const categories = [...catMap.entries()]
    .map(([name, value]) => ({ name, value: round2(value) }))
    .sort((a, b) => b.value - a.value);

  const payments = (["PAID", "PARTIAL", "UNPAID", "FREE"] as const).map((status) => {
    const ls = lines.filter((l) => l.paymentStatus === status);
    return { status, count: ls.length, amount: round2(sum(ls.map((l) => (status === "FREE" ? l.waived : l.net)))) };
  });

  const selfNet = sum(lines.filter((l) => !l.doctorId).map((l) => l.net));
  const referral = [
    { name: "Self / Walk-in", value: round2(selfNet) },
    { name: "Doctor referred", value: round2(net - selfNet) },
  ];

  // ── Doctors ──
  const docMap = new Map<string, DoctorRevenue>();
  for (const l of lines) {
    if (!l.doctorId) continue;
    const d = docMap.get(l.doctorId) ?? {
      key: l.doctorId,
      name: l.doctorName ?? "Unknown",
      count: 0,
      revenue: 0,
      commission: 0,
      commissionPending: 0,
    };
    d.count += 1;
    d.revenue += l.net;
    d.commission += l.commission;
    if (!l.commissionPaid) d.commissionPending += l.commission;
    docMap.set(l.doctorId, d);
  }
  const doctors = [...docMap.values()]
    .map((d) => ({
      ...d,
      revenue: round2(d.revenue),
      commission: round2(d.commission),
      commissionPending: round2(d.commissionPending),
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const topDues = lines
    .filter((l) => l.due > 0)
    .sort((a, b) => b.due - a.due)
    .slice(0, 8);

  return {
    totals, lines, trend, trendUnit, tests, topTests, bottomTests, unorderedTests,
    categories, payments, referral, doctors, topDues, draftsExcluded,
  };
}

// ── CSV export ────────────────────────────────────────────────────────────────

export function financialsToCsv(lines: FinLine[]): string {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const head = [
    "Report No", "Date", "Patient", "Test", "Category", "Referred By", "Payment Status",
    "Gross", "Discount", "Waived", "Net Bill", "Collected", "Due", "Commission", "Commission Paid",
  ];
  const rows = lines.map((l) => [
    l.reportNumber, format(l.date, "yyyy-MM-dd"), l.patientName, l.testName, l.category,
    l.doctorName ? `Dr. ${l.doctorName}` : "Self", l.paymentStatus,
    l.gross, l.discount, l.waived, l.net, l.collected, l.due, l.commission, l.commissionPaid ? "Yes" : "No",
  ]);
  return [head, ...rows].map((r) => r.map(esc).join(",")).join("\n");
}
