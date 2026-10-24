import { useCallback, useEffect, useState } from "react";
import { Check, IndianRupee, TrendingUp } from "lucide-react";
import { toast } from "sonner";

import {
  getIncentiveSummaryByDoctor,
  listDoctors,
  listIncentives,
  markIncentivePaid,
} from "@/lib/services/doctors";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Doctor, ReportIncentive } from "@/types";

export default function IncentivesPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [incentives, setIncentives] = useState<ReportIncentive[]>([]);
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof getIncentiveSummaryByDoctor>>>([]);
  const [filterDoctor, setFilterDoctor] = useState("");
  const [filterPaid, setFilterPaid] = useState<"ALL" | "PAID" | "PENDING">("PENDING");
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [docs, summ] = await Promise.all([listDoctors(), getIncentiveSummaryByDoctor()]);
      setDoctors(docs);
      setSummary(summ);

      const rows = await listIncentives({
        doctorId: filterDoctor || undefined,
        isPaid: filterPaid === "ALL" ? undefined : filterPaid === "PAID",
      });
      setIncentives(rows);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [filterDoctor, filterPaid]);

  async function handleTogglePaid(incentive: ReportIncentive) {
    setTogglingId(incentive.id);
    try {
      await markIncentivePaid(incentive.id, !incentive.isPaid);
      toast.success(incentive.isPaid ? "Marked as pending" : "Marked as paid");
      void load();
    } catch {
      toast.error("Failed to update status");
    } finally {
      setTogglingId(null);
    }
  }

  const totalPending = summary.reduce((s, r) => s + r.pending, 0);
  const totalPaid    = summary.reduce((s, r) => s + r.paid,    0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Doctor Incentives</h1>
        <p className="page-subtitle">Track and manage referral incentives for doctors</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <IndianRupee className="h-3.5 w-3.5" /> Total Pending
          </div>
          <div className="text-2xl font-bold text-red-600">{formatCurrency(totalPending)}</div>
        </div>
        <div className="card p-5">
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <Check className="h-3.5 w-3.5" /> Total Paid
          </div>
          <div className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</div>
        </div>
        <div className="card p-5">
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <TrendingUp className="h-3.5 w-3.5" /> Total Earned
          </div>
          <div className="text-2xl font-bold text-teal-700">
            {formatCurrency(totalPending + totalPaid)}
          </div>
        </div>
      </div>

      {/* Per-doctor summary */}
      {summary.length > 0 && (
        <div className="card overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-700">
            Summary by Doctor
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Doctor</th>
                <th>Reports</th>
                <th>Total Earned</th>
                <th>Paid</th>
                <th>Pending</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((s) => (
                <tr key={s.doctorId}
                  className="cursor-pointer hover:bg-slate-50"
                  onClick={() => { setFilterDoctor(s.doctorId); setFilterPaid("ALL"); }}>
                  <td className="font-medium text-slate-900">Dr. {s.doctorName}</td>
                  <td className="text-slate-600">{s.count}</td>
                  <td className="font-semibold text-slate-800">{formatCurrency(s.total)}</td>
                  <td className="text-green-700">{formatCurrency(s.paid)}</td>
                  <td>
                    <span className={s.pending > 0 ? "font-semibold text-red-600" : "text-slate-400"}>
                      {formatCurrency(s.pending)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Filters */}
      <div className="card flex flex-wrap items-center gap-3 p-3">
        <select className="form-input w-56 py-1.5 text-sm"
          value={filterDoctor} onChange={(e) => setFilterDoctor(e.target.value)}>
          <option value="">All Doctors</option>
          {doctors.map((d) => (
            <option key={d.id} value={d.id}>Dr. {d.name}</option>
          ))}
        </select>
        <div className="flex gap-1">
          {(["PENDING", "PAID", "ALL"] as const).map((f) => (
            <button key={f}
              onClick={() => setFilterPaid(f)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                filterPaid === f ? "bg-teal-700 text-white" : "text-slate-500 hover:bg-slate-100"
              }`}>
              {f === "ALL" ? "All" : f === "PENDING" ? "Pending" : "Paid"}
            </button>
          ))}
        </div>
        {(filterDoctor || filterPaid !== "PENDING") && (
          <button className="ml-auto text-xs text-teal-600 hover:underline"
            onClick={() => { setFilterDoctor(""); setFilterPaid("PENDING"); }}>
            Clear filters
          </button>
        )}
      </div>

      {/* Incentives table */}
      <div className="card overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>Report</th>
              <th>Patient</th>
              <th>Doctor</th>
              <th>Bill Amount</th>
              <th>Rate</th>
              <th>Incentive</th>
              <th>Date</th>
              <th>Status</th>
              <th className="text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}>{[...Array(9)].map((_, c) => (
                  <td key={c}><div className="h-4 animate-pulse rounded bg-slate-100" /></td>
                ))}</tr>
              ))
            ) : incentives.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-sm text-slate-400">
                  No incentives found for the selected filters.
                </td>
              </tr>
            ) : (
              incentives.map((inc) => (
                <tr key={inc.id}>
                  <td>
                    <span className="font-mono text-xs text-slate-600">
                      {inc.report.reportNumber}
                    </span>
                  </td>
                  <td className="text-sm text-slate-700">{inc.report.patient.name}</td>
                  <td>
                    <div className="font-medium text-slate-800">Dr. {inc.doctor.name}</div>
                    {inc.doctor.qualification && (
                      <div className="text-xs text-slate-400">{inc.doctor.qualification}</div>
                    )}
                  </td>
                  <td className="text-sm text-slate-700">{formatCurrency(inc.billAmount)}</td>
                  <td className="text-sm text-slate-600">{inc.incentiveRate}%</td>
                  <td className="font-semibold text-teal-700">{formatCurrency(inc.incentiveAmount)}</td>
                  <td className="text-sm text-slate-500">{formatDate(inc.report.collectedAt)}</td>
                  <td>
                    <span className={`badge ${inc.isPaid ? "badge-final" : "badge-draft"}`}>
                      {inc.isPaid ? "Paid" : "Pending"}
                    </span>
                  </td>
                  <td>
                    <button
                      onClick={() => handleTogglePaid(inc)}
                      disabled={togglingId === inc.id}
                      className={`btn btn-sm ${inc.isPaid
                        ? "btn-secondary text-red-600 hover:border-red-300 hover:bg-red-50"
                        : "btn-primary"}`}
                    >
                      {togglingId === inc.id
                        ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        : inc.isPaid ? "Mark Pending" : "Mark Paid"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}