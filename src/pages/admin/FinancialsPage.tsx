import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertCircle,
  BadgePercent,
  Download,
  HandCoins,
  IndianRupee,
  Lightbulb,
  Receipt,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { differenceInCalendarDays, endOfDay, startOfMonth, startOfYear, subDays, subMonths } from "date-fns";
import { toast } from "sonner";

import {
  computeFinancials,
  financialsToCsv,
  loadFinancialSource,
  type FinancialSource,
} from "@/lib/services/financials";
import { listTemplates } from "@/lib/services/templates";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

const ACCENT = "#10b981";
const COLORS = ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4", "#84cc16"];
const STATUS_COLORS: Record<string, string> = {
  PAID: "#10b981",
  PARTIAL: "#f59e0b",
  UNPAID: "#ef4444",
  FREE: "#94a3b8",
};

type PresetKey = "MONTH" | "30D" | "3M" | "YEAR" | "ALL" | "CUSTOM";
const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "MONTH", label: "This month" },
  { key: "30D", label: "Last 30 days" },
  { key: "3M", label: "Last 3 months" },
  { key: "YEAR", label: "This year" },
  { key: "ALL", label: "All time" },
  { key: "CUSTOM", label: "Custom" },
];

/** Compact Indian-style money for chart axes: 1.2K, 3.4L */
function compact(n: number) {
  if (n >= 10000000) return `${+(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `${+(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `${+(n / 1000).toFixed(1)}K`;
  return String(Math.round(n));
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

// ── Small presentational pieces ──────────────────────────────────────────────

function MoneyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs shadow-lg">
      {label != null && <p className="mb-1.5 font-semibold text-slate-700">{label}</p>}
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color ?? p.payload?.fill }} className="font-medium">
          {p.name}: <span className="text-slate-800">{formatCurrency(Number(p.value))}</span>
        </p>
      ))}
    </div>
  );
}

function Kpi({
  label, value, sub, icon: Icon, bg, color, loading,
}: {
  label: string; value: string; sub?: string; icon: React.ElementType; bg: string; color: string; loading: boolean;
}) {
  return (
    <div className="card flex items-center gap-4 p-5">
      <div className={cn("flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl", bg)}>
        <Icon className={cn("h-6 w-6", color)} />
      </div>
      <div className="min-w-0">
        <div className="mb-0.5 text-[13px] text-slate-500">{label}</div>
        <div className="truncate text-2xl font-bold text-slate-900" style={{ letterSpacing: "-0.04em" }}>
          {loading ? "—" : value}
        </div>
        {sub && !loading && <div className="mt-0.5 truncate text-[11px] text-slate-400">{sub}</div>}
      </div>
    </div>
  );
}

function ChartCard({
  title, subtitle, children, span = 1, loading,
}: {
  title: string; subtitle?: string; children: React.ReactNode; span?: 1 | 2; loading: boolean;
}) {
  return (
    <div className={cn("card p-5", span === 2 && "lg:col-span-2")}>
      <div className="mb-4">
        <div className="text-[15px] font-semibold text-slate-800">{title}</div>
        {subtitle && <div className="mt-0.5 text-xs text-slate-400">{subtitle}</div>}
      </div>
      {loading ? <div className="h-56 animate-pulse rounded-xl bg-slate-100" /> : children}
    </div>
  );
}

const Empty = ({ text = "No data in this period" }: { text?: string }) => (
  <div className="flex h-56 items-center justify-center text-sm text-slate-400">{text}</div>
);

function TestList({ rows, tone }: { rows: { id: string; name: string; count: number; revenue: number; share: number }[]; tone: "top" | "low" }) {
  if (rows.length === 0) return <Empty />;
  const max = Math.max(...rows.map((r) => r.revenue), 1);
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.id}>
          <div className="mb-1 flex items-center justify-between gap-3">
            <span className="truncate text-[13px] font-medium text-slate-700">{r.name}</span>
            <span className="flex-shrink-0 text-[13px] font-bold text-slate-800">{formatCurrency(r.revenue)}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className={cn("h-full rounded-full", tone === "top" ? "bg-emerald-500" : "bg-amber-400")}
              style={{ width: `${Math.max(3, (r.revenue / max) * 100)}%` }}
            />
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {r.count} {r.count === 1 ? "order" : "orders"} · {pct(r.share)} of revenue
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FinancialsPage() {
  const [source, setSource] = useState<FinancialSource | null>(null);
  const [templates, setTemplates] = useState<{ id: string; name: string; category: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [preset, setPreset] = useState<PresetKey>("MONTH");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [src, tpls] = await Promise.all([loadFinancialSource(), listTemplates(true)]);
        if (cancelled) return;
        setSource(src);
        setTemplates(tpls.map((t) => ({ id: t.id, name: t.name, category: t.category })));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load financial data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const range = useMemo(() => {
    const now = new Date();
    switch (preset) {
      case "MONTH":  return { from: startOfMonth(now), to: endOfDay(now) };
      case "30D":    return { from: startOfDay29(now), to: endOfDay(now) };
      case "3M":     return { from: startOfMonth(subMonths(now, 2)), to: endOfDay(now) };
      case "YEAR":   return { from: startOfYear(now), to: endOfDay(now) };
      case "ALL":    return { from: null as Date | null, to: endOfDay(now) };
      case "CUSTOM": return {
        from: customFrom ? new Date(`${customFrom}T00:00:00`) : null,
        to: customTo ? endOfDay(new Date(`${customTo}T00:00:00`)) : endOfDay(now),
      };
    }
  }, [preset, customFrom, customTo]);

  const model = useMemo(
    () => (source ? computeFinancials(source, range, templates) : null),
    [source, range, templates],
  );

  const t = model?.totals;
  const busy = loading || !model || !t;

  const insights = useMemo(() => {
    if (!model || !t || t.reports === 0) return [];
    const out: string[] = [];
    const best = model.topTests[0];
    if (best) out.push(`${best.name} is your top earner: ${formatCurrency(best.revenue)} (${pct(best.share)} of revenue).`);
    if (t.due > 0) out.push(`${formatCurrency(t.due)} is still to be collected. Collection rate is ${pct(t.collectionRate)}.`);
    if (t.discount > 0) out.push(`You gave ${formatCurrency(t.discount)} in discounts (${pct(t.discountRate)} of gross billing).`);
    if (t.commission > 0) out.push(`Doctor commissions are ${formatCurrency(t.commission)}, of which ${formatCurrency(t.commissionPending)} is unpaid.`);
    const referred = model.referral[1]?.value ?? 0;
    if (t.net > 0) out.push(`${pct(referred / t.net)} of revenue comes from doctor referrals; ${pct(1 - referred / t.net)} is self / walk-in.`);
    if (model.unorderedTests.length > 0) out.push(`${model.unorderedTests.length} active test(s) had no orders in this period.`);
    return out;
  }, [model, t]);

  function handleExport() {
    if (!model) return;
    const blob = new Blob([financialsToCsv(model.lines)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `labswift-financials-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Financial report downloaded");
  }

  const rangeLabel =
    range.from == null
      ? "All time"
      : `${formatDate(range.from)} – ${formatDate(range.to)}`;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">Financials</h1>
          <p className="page-subtitle">
            Revenue, dues, discounts and commissions · {rangeLabel}
            {model && model.draftsExcluded > 0 && ` · ${model.draftsExcluded} draft(s) not counted`}
          </p>
        </div>
        <button onClick={handleExport} disabled={busy || model.lines.length === 0} className="btn btn-secondary">
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>

      {/* Period selector */}
      <div className="card flex flex-wrap items-center gap-2 p-3">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPreset(p.key)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors",
              preset === p.key ? "bg-emerald-600 text-white" : "text-slate-600 hover:bg-slate-100",
            )}
          >
            {p.label}
          </button>
        ))}
        {preset === "CUSTOM" && (
          <div className="ml-auto flex items-center gap-2 text-xs text-slate-500">
            <input type="date" value={customFrom} max={customTo || undefined} onChange={(e) => setCustomFrom(e.target.value)} className="form-input w-40 py-1 text-xs" />
            to
            <input type="date" value={customTo} min={customFrom || undefined} onChange={(e) => setCustomTo(e.target.value)} className="form-input w-40 py-1 text-xs" />
          </div>
        )}
      </div>

      {error && (
        <div className="card flex items-center gap-3 border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-5 w-5 flex-shrink-0" /> {error}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi loading={busy} label="Total Revenue (Billed)" value={formatCurrency(t?.net ?? 0)} sub={`Gross ${formatCurrency(t?.gross ?? 0)} · ${t?.reports ?? 0} reports`} icon={IndianRupee} bg="bg-teal-50" color="text-teal-700" />
        <Kpi loading={busy} label="Collected" value={formatCurrency(t?.collected ?? 0)} sub={`${pct(t?.collectionRate ?? 0)} of billed`} icon={Wallet} bg="bg-emerald-50" color="text-emerald-700" />
        <Kpi loading={busy} label="Outstanding Dues" value={formatCurrency(t?.due ?? 0)} sub="Billed but not yet received" icon={AlertCircle} bg="bg-red-50" color="text-red-600" />
        <Kpi loading={busy} label="Average Bill" value={formatCurrency(t?.avgBill ?? 0)} sub="Per report, after discount" icon={Receipt} bg="bg-blue-50" color="text-blue-600" />
        <Kpi loading={busy} label="Discounts Given" value={formatCurrency(t?.discount ?? 0)} sub={`${pct(t?.discountRate ?? 0)} of gross · ${formatCurrency(t?.waived ?? 0)} written off as free`} icon={BadgePercent} bg="bg-amber-50" color="text-amber-700" />
        <Kpi loading={busy} label="Doctor Commissions" value={formatCurrency(t?.commission ?? 0)} sub={`Paid ${formatCurrency(t?.commissionPaid ?? 0)} · Pending ${formatCurrency(t?.commissionPending ?? 0)}`} icon={HandCoins} bg="bg-violet-50" color="text-violet-600" />
        <Kpi loading={busy} label="Revenue after Commissions" value={formatCurrency(t?.netAfterCommission ?? 0)} sub="Billed − commissions (before lab expenses)" icon={TrendingUp} bg="bg-emerald-50" color="text-emerald-700" />
        <Kpi loading={busy} label="Commission Rate" value={t && t.net > 0 ? pct(t.commission / t.net) : "0%"} sub="Commissions as % of revenue" icon={TrendingDown} bg="bg-slate-100" color="text-slate-600" />
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="card border-emerald-100 bg-emerald-50/50 p-5">
          <div className="mb-2 flex items-center gap-2 text-[15px] font-semibold text-slate-800">
            <Lightbulb className="h-4 w-4 text-emerald-600" /> Key insights
          </div>
          <ul className="space-y-1.5 text-[13px] text-slate-600">
            {insights.map((s) => (
              <li key={s} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-500" />{s}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Trend + payment status */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard loading={busy} span={2} title="Revenue Trend" subtitle={`Billed vs collected, by ${model?.trendUnit ?? "day"}`}>
          {!model || model.lines.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={model.trend} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
                <defs>
                  <linearGradient id="gBilled" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gCollected" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={ACCENT} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={ACCENT} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} minTickGap={24} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={compact} />
                <Tooltip content={<MoneyTooltip />} />
                <Area type="monotone" dataKey="billed" name="Billed" stroke="#3b82f6" strokeWidth={2} fill="url(#gBilled)" dot={false} activeDot={{ r: 4 }} />
                <Area type="monotone" dataKey="collected" name="Collected" stroke={ACCENT} strokeWidth={2} fill="url(#gCollected)" dot={false} activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
          {model && model.lines.length > 0 && (
            <div className="mt-2 flex gap-4 text-[11px] text-slate-500">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500" /> Billed</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Collected</span>
            </div>
          )}
        </ChartCard>

        <ChartCard loading={busy} title="Payment Status" subtitle="Reports by payment state">
          {!model || model.lines.length === 0 ? <Empty /> : (
            <>
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={model.payments.filter((p) => p.count > 0)} dataKey="count" nameKey="status" cx="50%" cy="50%" innerRadius={42} outerRadius={68} paddingAngle={3}>
                    {model.payments.filter((p) => p.count > 0).map((p) => <Cell key={p.status} fill={STATUS_COLORS[p.status]} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [`${v} reports`, String(n)]} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-1.5">
                {model.payments.map((p) => (
                  <div key={p.status} className="flex items-center justify-between text-[12px]">
                    <span className="flex items-center gap-2 text-slate-600">
                      <span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLORS[p.status] }} />
                      {p.status === "FREE" ? "Free (written off)" : p.status.charAt(0) + p.status.slice(1).toLowerCase()} · {p.count}
                    </span>
                    <span className="font-semibold text-slate-800">{formatCurrency(p.amount)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </ChartCard>
      </div>

      {/* Revenue by test + category */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard loading={busy} span={2} title="Revenue by Test" subtitle="Top 10 tests by revenue">
          {!model || model.tests.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={Math.max(220, Math.min(10, model.tests.length) * 36)}>
              <BarChart data={model.tests.slice(0, 10)} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={compact} />
                <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 11, fill: "#475569" }} axisLine={false} tickLine={false} />
                <Tooltip content={<MoneyTooltip />} cursor={{ fill: "#f8fafc" }} />
                <Bar dataKey="revenue" name="Revenue" radius={[0, 6, 6, 0]} maxBarSize={20}>
                  {model.tests.slice(0, 10).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard loading={busy} title="Revenue by Category" subtitle="Share of billed revenue">
          {!model || model.categories.length === 0 ? <Empty /> : (
            <>
              <ResponsiveContainer width="100%" height={170}>
                <PieChart>
                  <Pie data={model.categories} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={78} paddingAngle={3}>
                    {model.categories.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<MoneyTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-1.5">
                {model.categories.map((c, i) => (
                  <div key={c.name} className="flex items-center justify-between text-[12px]">
                    <span className="flex items-center gap-2 text-slate-600">
                      <span className="h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />{c.name}
                    </span>
                    <span className="font-semibold text-slate-800">{formatCurrency(c.value)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </ChartCard>
      </div>

      {/* Best / worst tests */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard loading={busy} title="Highest-Earning Tests" subtitle="Top 5 by revenue">
          <TestList rows={model?.topTests ?? []} tone="top" />
        </ChartCard>
        <ChartCard loading={busy} title="Lowest-Earning Tests" subtitle="Tests with orders but least revenue">
          <TestList rows={model?.bottomTests ?? []} tone="low" />
        </ChartCard>
        <ChartCard loading={busy} title="Tests with No Orders" subtitle="Active templates not ordered in this period">
          {!model || model.unorderedTests.length === 0 ? (
            <Empty text="Every active test was ordered" />
          ) : (
            <ul className="max-h-60 space-y-1.5 overflow-y-auto pr-1">
              {model.unorderedTests.map((u) => (
                <li key={u.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-[13px]">
                  <span className="truncate text-slate-700">{u.name}</span>
                  <span className="ml-2 flex-shrink-0 text-[11px] text-slate-400">{u.category}</span>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>
      </div>

      {/* Referral + doctors */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard loading={busy} title="Referral Source" subtitle="Self / walk-in vs doctor referred">
          {!model || model.totals.net === 0 ? <Empty /> : (
            <>
              <ResponsiveContainer width="100%" height={170}>
                <PieChart>
                  <Pie data={model.referral} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={78} paddingAngle={3}>
                    <Cell fill="#94a3b8" />
                    <Cell fill={ACCENT} />
                  </Pie>
                  <Tooltip content={<MoneyTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-1.5">
                {model.referral.map((r, i) => (
                  <div key={r.name} className="flex items-center justify-between text-[12px]">
                    <span className="flex items-center gap-2 text-slate-600">
                      <span className="h-2 w-2 rounded-full" style={{ background: i === 0 ? "#94a3b8" : ACCENT }} />{r.name}
                    </span>
                    <span className="font-semibold text-slate-800">{formatCurrency(r.value)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </ChartCard>

        <ChartCard loading={busy} span={2} title="Revenue & Commission by Doctor" subtitle="What each referring doctor brings in and is owed">
          {!model || model.doctors.length === 0 ? <Empty text="No doctor referrals in this period" /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    <th className="pb-2 pr-3">Doctor</th>
                    <th className="pb-2 pr-3 text-right">Reports</th>
                    <th className="pb-2 pr-3 text-right">Revenue</th>
                    <th className="pb-2 pr-3 text-right">Commission</th>
                    <th className="pb-2 text-right">Pending</th>
                  </tr>
                </thead>
                <tbody>
                  {model.doctors.map((d) => (
                    <tr key={d.key} className="border-b border-slate-50 last:border-0">
                      <td className="py-2 pr-3 font-medium text-slate-700">Dr. {d.name}</td>
                      <td className="py-2 pr-3 text-right text-slate-500">{d.count}</td>
                      <td className="py-2 pr-3 text-right font-semibold text-slate-800">{formatCurrency(d.revenue)}</td>
                      <td className="py-2 pr-3 text-right text-violet-700">{formatCurrency(d.commission)}</td>
                      <td className={cn("py-2 text-right font-semibold", d.commissionPending > 0 ? "text-amber-600" : "text-slate-300")}>
                        {formatCurrency(d.commissionPending)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ChartCard>
      </div>

      {/* Outstanding dues */}
      <ChartCard loading={busy} title="Largest Outstanding Dues" subtitle="Follow up on these first">
        {!model || model.topDues.length === 0 ? (
          <Empty text="No outstanding dues 🎉" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  <th className="pb-2 pr-3">Report</th>
                  <th className="pb-2 pr-3">Patient</th>
                  <th className="pb-2 pr-3">Test</th>
                  <th className="pb-2 pr-3">Date</th>
                  <th className="pb-2 pr-3 text-right">Age</th>
                  <th className="pb-2 pr-3 text-right">Billed</th>
                  <th className="pb-2 text-right">Due</th>
                </tr>
              </thead>
              <tbody>
                {model.topDues.map((l) => {
                  const days = differenceInCalendarDays(new Date(), l.date);
                  return (
                    <tr key={l.id} className="border-b border-slate-50 last:border-0">
                      <td className="py-2 pr-3">
                        <Link to={`/reports/${l.id}`} className="font-medium text-emerald-700 hover:underline">{l.reportNumber}</Link>
                      </td>
                      <td className="py-2 pr-3 text-slate-700">{l.patientName}</td>
                      <td className="py-2 pr-3 text-slate-500">{l.testName}</td>
                      <td className="py-2 pr-3 text-slate-500">{formatDate(l.date)}</td>
                      <td className={cn("py-2 pr-3 text-right", days > 14 ? "font-semibold text-red-600" : "text-slate-500")}>{days}d</td>
                      <td className="py-2 pr-3 text-right text-slate-500">{formatCurrency(l.net)}</td>
                      <td className="py-2 text-right font-bold text-red-600">{formatCurrency(l.due)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </ChartCard>
    </div>
  );
}

function startOfDay29(now: Date) {
  const d = subDays(now, 29);
  d.setHours(0, 0, 0, 0);
  return d;
}
