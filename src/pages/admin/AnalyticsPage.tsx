import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  Download,
  FileText,
  FlaskConical,
  TrendingUp,
  Users,
  Calendar,
  IndianRupee,
} from "lucide-react";
import { format, subDays, startOfDay, eachDayOfInterval, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { toast } from "sonner";

import { exportBackup } from "@/lib/services/analytics";
import { supabase } from "@/lib/supabase";
import { listTemplates } from "@/lib/services/templates";
import { getIncentiveSummaryByDoctor } from "@/lib/services/doctors";
import { formatCurrency } from "@/lib/utils";

const ACCENT   = "#10b981";
const COLORS   = ["#10b981","#3b82f6","#8b5cf6","#f59e0b","#ef4444","#06b6d4","#84cc16"];

type MonthlyPoint = { month: string; reports: number; patients: number };
type CategoryPoint = { name: string; value: number };
type DailyPoint = { day: string; count: number };
type TopTest = { name: string; count: number };
type DocSummary = { doctorName: string; total: number; paid: number; pending: number };

// ── Custom tooltip ────────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-lg text-xs">
      <p className="mb-1.5 font-semibold text-slate-700">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="font-medium">
          {p.name}: <span className="text-slate-800">{p.value}</span>
        </p>
      ))}
    </div>
  );
};

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Stats
  const [totalPatients,    setTotalPatients]    = useState(0);
  const [totalReports,     setTotalReports]     = useState(0);
  const [reportsThisMonth, setReportsThisMonth] = useState(0);
  const [templateCount,    setTemplateCount]    = useState(0);
  const [totalRevenue,     setTotalRevenue]     = useState(0);
  const [revenueThisMonth, setRevenueThisMonth] = useState(0);
  const [totalDiscounts,   setTotalDiscounts]   = useState(0);

  // Chart data
  const [monthly,     setMonthly]     = useState<MonthlyPoint[]>([]);
  const [categories,  setCategories]  = useState<CategoryPoint[]>([]);
  const [topTests,    setTopTests]    = useState<TopTest[]>([]);
  const [daily,       setDaily]       = useState<DailyPoint[]>([]);
  const [docSummary,  setDocSummary]  = useState<DocSummary[]>([]);

  useEffect(() => {
    void loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [templates, incSummary] = await Promise.all([
        listTemplates(false),
        getIncentiveSummaryByDoctor(),
      ]);

      setTemplateCount(templates.length);
      setDocSummary(incSummary.map((s) => ({
        doctorName: `Dr. ${s.doctorName}`,
        total: s.total,
        paid: s.paid,
        pending: s.pending,
      })));

      // ── Total counts ──────────────────────────────────────────────────────
      const [patRes, repRes, monthRes] = await Promise.all([
        supabase.from("patients").select("id", { count: "exact", head: true }),
        supabase.from("reports").select("id", { count: "exact", head: true }),
        supabase.from("reports").select("id", { count: "exact", head: true })
          .gte("createdAt", startOfMonth(new Date()).toISOString()),
      ]);
      setTotalPatients(patRes.count ?? 0);
      setTotalReports(repRes.count ?? 0);
      setReportsThisMonth(monthRes.count ?? 0);

      // ── Monthly trend — last 7 months ─────────────────────────────────────
      const monthlyData: MonthlyPoint[] = [];
      for (let i = 6; i >= 0; i--) {
        const d   = subMonths(new Date(), i);
        const from = startOfMonth(d).toISOString();
        const to   = endOfMonth(d).toISOString();
        const [rRes, pRes] = await Promise.all([
          supabase.from("reports").select("id", { count: "exact", head: true })
            .gte("createdAt", from).lte("createdAt", to),
          supabase.from("patients").select("id", { count: "exact", head: true })
            .gte("createdAt", from).lte("createdAt", to),
        ]);
        monthlyData.push({
          month: format(d, "MMM yy"),
          reports: rRes.count ?? 0,
          patients: pRes.count ?? 0,
        });
      }
      setMonthly(monthlyData);

      // ── Category breakdown ────────────────────────────────────────────────
      const { data: allReports } = await supabase
        .from("reports")
        .select("template:test_templates!reports_templateId_fkey(category)");

      const catMap = new Map<string, number>();
      for (const r of allReports ?? []) {
        const cat = (r.template as any)?.category ?? "Other";
        catMap.set(cat, (catMap.get(cat) ?? 0) + 1);
      }
      setCategories([...catMap.entries()].sort((a,b)=>b[1]-a[1]).map(([name,value])=>({name,value})));

      // ── Top 7 tests ───────────────────────────────────────────────────────
      const { data: tmplReports } = await supabase.from("reports").select("templateId");
      const nameMap = new Map(templates.map((t) => [t.id, t.name]));
      const cntMap  = new Map<string, number>();
      for (const r of tmplReports ?? []) {
        cntMap.set(r.templateId, (cntMap.get(r.templateId) ?? 0) + 1);
      }
      setTopTests(
        [...cntMap.entries()]
          .sort((a,b)=>b[1]-a[1])
          .slice(0,7)
          .map(([id,count])=>({ name: nameMap.get(id) ?? "Unknown", count }))
      );

      // ── Daily activity — last 30 days ─────────────────────────────────────
      const { data: last30Reports } = await supabase
        .from("reports")
        .select("createdAt")
        .gte("createdAt", subDays(new Date(), 29).toISOString());

      const dayMap = new Map<string, number>();
      eachDayOfInterval({ start: subDays(new Date(), 29), end: new Date() }).forEach((d) => {
        dayMap.set(format(d, "dd MMM"), 0);
      });
      for (const r of last30Reports ?? []) {
        const key = format(new Date(r.createdAt), "dd MMM");
        dayMap.set(key, (dayMap.get(key) ?? 0) + 1);
      }
      setDaily([...dayMap.entries()].map(([day, count]) => ({ day, count })));

      // ── Financial and Revenue Calculations ─────────────────────────────────
      let totRev = 0;
      let monthRev = 0;
      let totDisc = 0;
      const startOfCurrMonth = startOfMonth(new Date()).toISOString();

      try {
        const { data: billRows } = await supabase
          .from("reports")
          .select("billAmount, discount, discountType, amountPaid, paymentStatus, createdAt, status");

        for (const row of billRows ?? []) {
          const b = Number(row.billAmount ?? 0);
          const dVal = Number(row.discount ?? 0);
          const dAmt = row.discountType === "PERCENT" ? (b * dVal) / 100 : dVal;
          const net = Math.max(0, b - dAmt);
          const paid = row.amountPaid != null ? Number(row.amountPaid) : (row.paymentStatus === "PAID" ? net : 0);

          totRev += paid;
          totDisc += dAmt;
          if (row.createdAt >= startOfCurrMonth) {
            monthRev += paid;
          }
        }
      } catch (err) {
        console.warn("Could not load revenue stats:", err);
      }

      setTotalRevenue(totRev);
      setRevenueThisMonth(monthRev);
      setTotalDiscounts(totDisc);

    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const backup = await exportBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `labswift-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Backup downloaded");
    } catch {
      toast.error("Failed to export backup");
    } finally {
      setExporting(false);
    }
  }

  const Skeleton = () => <div className="h-full w-full animate-pulse rounded-xl bg-slate-100" />;

  const StatCard = ({ label, value, icon: Icon, bg, color }: {
    label: string; value: number | string; icon: React.ElementType; bg: string; color: string;
  }) => (
    <div className="card p-5 flex items-center gap-4">
      <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl ${bg}`}>
        <Icon className={`h-6 w-6 ${color}`} />
      </div>
      <div>
        <div className="text-[13px] text-slate-500 mb-0.5">{label}</div>
        <div className="text-2xl font-bold text-slate-900" style={{ letterSpacing: "-0.04em" }}>
          {loading ? "—" : typeof value === "number" ? value.toLocaleString() : value}
        </div>
      </div>
    </div>
  );

  const ChartCard = ({ title, subtitle, children, span = 1 }: {
    title: string; subtitle?: string; children: React.ReactNode; span?: number;
  }) => (
    <div className={`card p-5 ${span === 2 ? "lg:col-span-2" : ""}`}>
      <div className="mb-4">
        <div className="text-[15px] font-semibold text-slate-800">{title}</div>
        {subtitle && <div className="text-xs text-slate-400 mt-0.5">{subtitle}</div>}
      </div>
      {loading ? <div className="h-56"><Skeleton /></div> : children}
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Analytics</h1>
          <p className="page-subtitle">Lab performance overview and insights</p>
        </div>
        <button onClick={handleExport} disabled={exporting} className="btn btn-secondary">
          {exporting
            ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" /> Exporting...</>
            : <><Download className="h-4 w-4" /> Export Backup</>}
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Patients"    value={totalPatients}    icon={Users}       bg="bg-blue-50"    color="text-blue-600" />
        <StatCard label="Total Reports"     value={totalReports}     icon={FileText}    bg="bg-emerald-50" color="text-emerald-600" />
        <StatCard label="Reports This Month" value={reportsThisMonth} icon={TrendingUp}  bg="bg-violet-50"  color="text-violet-600" />
        <StatCard label="Test Templates"    value={templateCount}    icon={FlaskConical} bg="bg-amber-50"   color="text-amber-600" />
      </div>

      {/* Financial & Revenue KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Revenue Collected" value={formatCurrency(totalRevenue)} icon={IndianRupee} bg="bg-teal-50" color="text-teal-700" />
        <StatCard label="Revenue This Month" value={formatCurrency(revenueThisMonth)} icon={TrendingUp} bg="bg-emerald-50" color="text-emerald-700" />
        <StatCard label="Total Discounts Given" value={formatCurrency(totalDiscounts)} icon={IndianRupee} bg="bg-amber-50" color="text-amber-700" />
      </div>

      {/* Charts row 1 */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Monthly trend — span 2 */}
        <ChartCard title="Monthly Activity" subtitle="Reports & new patients over last 7 months" span={2}>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={monthly} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="gReports" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={ACCENT} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={ACCENT} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gPatients" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Area type="monotone" dataKey="reports"  name="Reports"  stroke={ACCENT}    strokeWidth={2} fill="url(#gReports)"  dot={{ r: 3, fill: ACCENT }}    activeDot={{ r: 5 }} />
              <Area type="monotone" dataKey="patients" name="Patients" stroke="#3b82f6"   strokeWidth={2} fill="url(#gPatients)" dot={{ r: 3, fill: "#3b82f6" }} activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Category pie */}
        <ChartCard title="Tests by Category" subtitle="Distribution of all reports">
          {categories.length === 0 ? (
            <div className="flex h-56 items-center justify-center text-sm text-slate-400">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={categories} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                  paddingAngle={3} dataKey="value" nameKey="name">
                  {categories.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name) => [typeof value === 'number' ? value : 0, name]} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Charts row 2 */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Top tests horizontal bar */}
        <ChartCard title="Top Tests" subtitle="Most ordered tests of all time" span={2}>
          {topTests.length === 0 ? (
            <div className="flex h-56 items-center justify-center text-sm text-slate-400">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, topTests.length * 42)}>
              <BarChart data={topTests} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis dataKey="name" type="category" width={130} tick={{ fontSize: 11, fill: "#475569" }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" name="Reports" radius={[0, 6, 6, 0]} maxBarSize={22}>
                  {topTests.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Doctor incentives */}
        <ChartCard title="Doctor Incentives" subtitle="Paid vs pending by doctor">
          {docSummary.length === 0 ? (
            <div className="flex h-56 flex-col items-center justify-center gap-2 text-sm text-slate-400">
              <IndianRupee className="h-8 w-8 opacity-20" />
              No incentive data yet
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              {docSummary.slice(0, 5).map((d) => (
                <div key={d.doctorName}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[12px] font-medium text-slate-700 truncate max-w-[140px]">{d.doctorName}</span>
                    <span className="text-[12px] font-bold text-slate-800">{formatCurrency(d.total)}</span>
                  </div>
                  <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full bg-emerald-500 transition-all duration-700"
                      style={{ width: d.total > 0 ? `${Math.round((d.paid/d.total)*100)}%` : "0%" }} />
                    <div className="h-full bg-amber-400 transition-all duration-700"
                      style={{ width: d.total > 0 ? `${Math.round((d.pending/d.total)*100)}%` : "0%" }} />
                  </div>
                  <div className="mt-1 flex gap-3 text-[10px] text-slate-400">
                    <span className="text-emerald-600 font-medium">Paid {formatCurrency(d.paid)}</span>
                    <span className="text-amber-600 font-medium">Due {formatCurrency(d.pending)}</span>
                  </div>
                </div>
              ))}
              <div className="flex gap-3 pt-1 border-t border-slate-100">
                <span className="flex items-center gap-1 text-[11px] text-slate-500">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /> Paid
                </span>
                <span className="flex items-center gap-1 text-[11px] text-slate-500">
                  <span className="inline-block h-2 w-2 rounded-full bg-amber-400" /> Pending
                </span>
              </div>
            </div>
          )}
        </ChartCard>
      </div>

      {/* Daily activity sparkline */}
      <ChartCard title="Daily Report Activity" subtitle="Last 30 days">
        <ResponsiveContainer width="100%" height={120}>
          <AreaChart data={daily} margin={{ top: 4, right: 8, bottom: 0, left: -32 }}>
            <defs>
              <linearGradient id="gDaily" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={ACCENT} stopOpacity={0.2} />
                <stop offset="95%" stopColor={ACCENT} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#94a3b8" }} interval={6} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip content={<ChartTooltip />} />
            <Area type="monotone" dataKey="count" name="Reports" stroke={ACCENT} strokeWidth={2}
              fill="url(#gDaily)" dot={false} activeDot={{ r: 4, fill: ACCENT }} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}