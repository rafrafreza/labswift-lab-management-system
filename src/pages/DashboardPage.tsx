import { useEffect, useState } from "react";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Clock,
  FileText,
  FlaskConical,
  Plus,
  TrendingUp,
  Users,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Link } from "react-router-dom";

import { getDashboardStats } from "@/lib/services/analytics";
import { getRecentReports } from "@/lib/services/reports";
import { getSettings } from "@/lib/services/settings";
import { formatDate, formatRelative, STATUS_CONFIG, formatCurrency } from "@/lib/utils";
import type { DashboardStats, ReportWithRelations } from "@/types";

function StatCard({
  label, value, icon: Icon, color, bgColor, trend, loading,
}: {
  label: string; value: string | number; icon: React.ElementType;
  color: string; bgColor: string; trend?: string; loading?: boolean;
}) {
  return (
    <div className="card p-5 flex flex-col gap-4 card-hover animate-fade-up">
      <div className="flex items-start justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${bgColor}`}>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
        {trend && (
          <span className="flex items-center gap-0.5 text-xs font-semibold text-emerald-600 bg-emerald-50 rounded-full px-2 py-0.5">
            <ArrowUpRight className="h-3 w-3" />{trend}
          </span>
        )}
      </div>
      <div>
        <div className="text-[13px] font-medium text-slate-500 mb-1">{label}</div>
        {loading ? (
          <div className="h-8 w-16 animate-pulse rounded-lg bg-slate-100" />
        ) : (
          <div className="text-3xl font-bold text-slate-900 tracking-tight" style={{ letterSpacing: "-0.04em" }}>
            {value}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recent, setRecent] = useState<ReportWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [labName, setLabName] = useState("Your Lab");

  useEffect(() => {
    async function load() {
      try {
        const [statsData, recentReports, settings] = await Promise.all([
          getDashboardStats(),
          getRecentReports(6),
          getSettings(),
        ]);
        setStats(statsData);
        setRecent(recentReports);
        setLabName(settings.labName || "Your Lab");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const today = formatDate(new Date());

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Hello!</h1>
          <p className="page-subtitle">{labName} &middot; {today}</p>
        </div>
        <Link to="/reports/new" className="btn btn-primary shadow-sm">
          <Plus className="h-4 w-4" /> New Report
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 stagger">
        <StatCard label="Total Patients"   value={stats?.totalPatients  ?? "—"} icon={Users}     color="text-blue-600"    bgColor="bg-blue-50"    loading={loading} />
        <StatCard label="Reports Today"    value={stats?.reportsToday   ?? "—"} icon={Activity}   color="text-emerald-600" bgColor="bg-emerald-50" loading={loading} />
        <StatCard label="This Month"       value={stats?.reportsThisMonth ?? "—"} icon={TrendingUp} color="text-violet-600"  bgColor="bg-violet-50"  loading={loading} />
        <StatCard label="Pending Drafts"   value={stats?.pendingDrafts  ?? "—"} icon={Clock}      color="text-amber-600"   bgColor="bg-amber-50"   loading={loading} />
      </div>

      {/* Main grid */}
      <div className="grid gap-5 lg:grid-cols-3">

        {/* Recent reports */}
        <div className="card overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div>
              <h2 className="text-[15px] font-semibold text-slate-800">Recent Reports</h2>
              <p className="text-xs text-slate-400 mt-0.5">Latest finalised reports</p>
            </div>
            <Link to="/reports" className="flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition-colors">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="divide-y divide-slate-100">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-4">
                  <div className="h-9 w-9 animate-pulse rounded-full bg-slate-100 flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-32 animate-pulse rounded bg-slate-100" />
                    <div className="h-3 w-48 animate-pulse rounded bg-slate-100" />
                  </div>
                  <div className="h-3 w-16 animate-pulse rounded bg-slate-100" />
                </div>
              ))}
            </div>
          ) : recent.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 mb-4">
                <FileText className="h-6 w-6 text-slate-300" />
              </div>
              <p className="text-sm font-medium text-slate-500">No reports yet</p>
              <p className="text-xs text-slate-400 mt-1">Create your first report to get started</p>
              <Link to="/reports/new" className="mt-4 btn btn-primary btn-sm">
                <Plus className="h-3.5 w-3.5" /> Create Report
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-100/80">
              {recent.map((report, i) => (
                <Link key={report.id} to={`/reports/${report.id}`}
                  className="group flex items-center gap-4 px-5 py-3.5 transition-all duration-100 hover:bg-slate-50/80"
                  style={{ animationDelay: `${i * 30}ms` }}>
                  {/* Avatar */}
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-100 to-slate-200 text-sm font-bold text-slate-500 group-hover:from-emerald-50 group-hover:to-emerald-100 group-hover:text-emerald-600 transition-all">
                    {report.patient.name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-slate-800 truncate">{report.patient.name}</span>
                      <span className={`badge badge-${report.status.toLowerCase()} flex-shrink-0`}>
                        {STATUS_CONFIG[report.status].label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <span className="font-mono">{report.reportNumber}</span>
                      <span>·</span>
                      <span>{report.template.name}</span>
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className="text-xs text-slate-400">{formatRelative(report.collectedAt)}</div>
                    {report.values.some((v) => v.isAbnormal) && (
                      <div className="flex items-center justify-end gap-1 mt-1 text-[10px] font-semibold text-red-500">
                        <AlertCircle className="h-3 w-3" /> Abnormal
                      </div>
                    )}
                  </div>
                  <ArrowRight className="h-4 w-4 flex-shrink-0 text-slate-200 group-hover:text-emerald-500 transition-colors" />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* Quick actions */}
          <div className="card p-5">
            <h2 className="text-[13px] font-semibold text-slate-800 mb-3">Quick Actions</h2>
            <div className="space-y-2">
              {[
                {
                  to: "/reports/new",
                  icon: FileText,
                  label: "New Report",
                  sub: "Generate a lab report",
                  iconBg: "bg-emerald-100",
                  iconColor: "text-emerald-700",
                  hoverBorder: "hover:border-emerald-200",
                  hoverBg: "hover:bg-emerald-50/50",
                },
                {
                  to: "/patients/new",
                  icon: Users,
                  label: "Add Patient",
                  sub: "Register a new patient",
                  iconBg: "bg-blue-100",
                  iconColor: "text-blue-700",
                  hoverBorder: "hover:border-blue-200",
                  hoverBg: "hover:bg-blue-50/50",
                },
                {
                  to: "/reports?status=DRAFT",
                  icon: Clock,
                  label: "Pending Drafts",
                  sub: `${stats?.pendingDrafts ?? 0} awaiting completion`,
                  iconBg: "bg-amber-100",
                  iconColor: "text-amber-700",
                  hoverBorder: "hover:border-amber-200",
                  hoverBg: "hover:bg-amber-50/50",
                },
              ].map((action) => (
                <Link key={action.to} to={action.to}
                  className={`flex items-center gap-3 rounded-xl border border-slate-200/80 p-3 transition-all duration-150 ${action.hoverBorder} ${action.hoverBg} group`}>
                  <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${action.iconBg} transition-transform group-hover:scale-110`}>
                    <action.icon className={`h-4 w-4 ${action.iconColor}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold text-slate-800">{action.label}</div>
                    <div className="text-xs text-slate-400">{action.sub}</div>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500 flex-shrink-0 transition-colors" />
                </Link>
              ))}
            </div>
          </div>

          {/* Top tests */}
          {stats?.topTests && stats.topTests.length > 0 && (
            <div className="card p-5">
              <h2 className="flex items-center gap-2 text-[13px] font-semibold text-slate-800 mb-4">
                <FlaskConical className="h-4 w-4 text-emerald-600" />
                Top Tests
              </h2>
              <div className="space-y-3">
                {stats.topTests.slice(0, 5).map((test, idx) => {
                  const max = stats.topTests[0].count;
                  const pct = Math.round((test.count / max) * 100);
                  return (
                    <div key={test.name}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-300 w-3">{idx + 1}</span>
                          <span className="text-xs font-medium text-slate-700 truncate max-w-[140px]">{test.name}</span>
                        </div>
                        <span className="text-xs font-semibold text-slate-500">{test.count}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-700"
                          style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Status summary */}
          <div className="card p-5">
            <h2 className="text-[13px] font-semibold text-slate-800 mb-3">Report Status</h2>
            <div className="space-y-2">
              {[
                { label: "Final Reports", value: (stats?.totalReports ?? 0) - (stats?.pendingDrafts ?? 0), color: "bg-emerald-500", icon: CheckCircle2, textColor: "text-emerald-600" },
                { label: "Draft Reports", value: stats?.pendingDrafts ?? 0, color: "bg-amber-400", icon: Clock, textColor: "text-amber-600" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <div className="flex items-center gap-2">
                    <item.icon className={`h-3.5 w-3.5 ${item.textColor}`} />
                    <span className="text-[13px] text-slate-600">{item.label}</span>
                  </div>
                  <span className="text-[13px] font-bold text-slate-800">{loading ? "—" : item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}