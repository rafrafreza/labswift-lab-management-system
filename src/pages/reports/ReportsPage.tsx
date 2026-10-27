import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  Filter,
  IndianRupee,
  Pencil,
  Plus,
  Search,
  Share2,
  Trash2,
} from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import PaymentModal from "@/components/shared/PaymentModal";
import ReportRowDownload from "@/components/shared/ReportRowDownload";
import { deleteReport, listReports } from "@/lib/services/reports";
import { formatAge, formatDate, STATUS_CONFIG } from "@/lib/utils";
import type { ReportWithRelations } from "@/types";

const PAGE_SIZE = 20;
const STATUSES = ["ALL", "DRAFT", "FINAL", "SENT"] as const;

export default function ReportsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [reports, setReports] = useState<ReportWithRelations[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>(searchParams.get("status") || "ALL");
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [paymentModalReport, setPaymentModalReport] = useState<ReportWithRelations | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(search);
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  // Only the latest request may update the screen (slow earlier responses are dropped)
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const data = await listReports({ page, limit: PAGE_SIZE, search: query, status });
      if (id !== requestId.current) return;
      setReports(data.reports);
      setTotal(data.total);
    } catch (err) {
      if (id !== requestId.current) return;
      toast.error(err instanceof Error ? err.message : "Failed to load reports");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [page, query, status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDelete(report: ReportWithRelations) {
    const confirmed = window.confirm(
      `Delete draft ${report.reportNumber} for ${report.patient.name}? This cannot be undone.`,
    );
    if (!confirmed) return;
    setDeletingId(report.id);
    try {
      await deleteReport(report.id);
      toast.success(`Draft ${report.reportNumber} deleted.`);
      void load();
    } catch {
      toast.error("Failed to delete report.");
    } finally {
      setDeletingId(null);
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">
            {total} report{total !== 1 ? "s" : ""} total
          </p>
        </div>
        <Link to="/reports/new" className="btn btn-primary">
          <Plus className="h-4 w-4" /> New Report
        </Link>
      </div>

      <div className="card flex flex-wrap items-center gap-3 p-3">
        <div className="flex min-w-48 flex-1 items-center gap-2">
          <Search className="h-4 w-4 flex-shrink-0 text-slate-400" />
          <input
            type="text"
            placeholder="Search patient, report number, test..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
          />
        </div>
        <div className="flex items-center gap-1 border-l border-slate-200 pl-3">
          <Filter className="h-3.5 w-3.5 text-slate-400" />
          <div className="flex gap-1">
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => { setStatus(s); setPage(1); }}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                  status === s ? "bg-teal-700 text-white" : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                {s === "ALL" ? "All" : STATUS_CONFIG[s].label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className={`data-table transition-opacity ${loading && reports.length > 0 ? "opacity-50" : ""}`}>
            <thead>
              <tr>
                <th>Report No.</th>
                <th>Patient</th>
                <th>Test</th>
                <th>Status</th>
                <th>Date</th>
                <th>By</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && reports.length === 0 ? (
                [...Array(7)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(7)].map((_, c) => (
                      <td key={c}>
                        <div className="h-4 animate-pulse rounded bg-slate-100" style={{ width: c === 6 ? 80 : "75%" }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : reports.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    <FileText className="mx-auto mb-3 h-10 w-10 opacity-25" />
                    <p className="mb-1 text-sm font-medium text-slate-500">No reports found</p>
                    {query || status !== "ALL" ? (
                      <>
                        <p className="text-xs">
                          {query ? `No results for "${query}"` : "No reports with this status"}
                        </p>
                        <button
                          type="button"
                          onClick={() => { setSearch(""); setStatus("ALL"); setPage(1); }}
                          className="mt-2 text-xs font-medium text-teal-700 hover:underline"
                        >
                          Clear search and filters
                        </button>
                      </>
                    ) : (
                      <>
                        <p className="text-xs">Create your first report to get started</p>
                        <Link to="/reports/new" className="btn btn-primary btn-sm mt-3">
                          <Plus className="h-3.5 w-3.5" /> New Report
                        </Link>
                      </>
                    )}
                  </td>
                </tr>
              ) : (
                reports.map((report) => (
                  <tr
                    key={report.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/reports/${report.id}`)}
                  >
                    <td>
                      <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600">
                        {report.reportNumber}
                      </span>
                    </td>
                    <td>
                      <div className="font-medium text-slate-900">{report.patient.name}</div>
                      <div className="text-xs text-slate-400">
                        {formatAge(report.patient.age, report.patient.ageMonths)} · {report.patient.patientCode}
                      </div>
                    </td>
                    <td>
                      <div className="text-sm text-slate-700">{report.template.name}</div>
                      <div className="text-xs text-slate-400">{report.template.category}</div>
                    </td>
                    <td>
                      <div className="flex flex-col gap-1 items-start">
                        <span className={`badge badge-${report.status.toLowerCase()}`}>
                          {STATUS_CONFIG[report.status].label}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPaymentModalReport(report);
                          }}
                          title="Click to update payment"
                          className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold border cursor-pointer hover:opacity-85 transition-opacity ${
                            report.paymentStatus === "PAID"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : report.paymentStatus === "FREE"
                                ? "bg-purple-50 text-purple-700 border-purple-200"
                                : report.paymentStatus === "PARTIAL"
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : "bg-rose-50 text-rose-700 border-rose-200"
                          }`}
                        >
                          {report.paymentStatus === "PAID"
                            ? "Paid"
                            : report.paymentStatus === "FREE"
                              ? "Free"
                              : report.paymentStatus === "PARTIAL"
                                ? "Partial"
                                : "Unpaid"}
                        </button>
                      </div>
                    </td>
                    <td className="text-slate-500">{formatDate(report.collectedAt)}</td>
                    <td className="text-xs text-slate-500">{report.createdBy.name}</td>

                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        {/* Payment action — for any report */}
                        <button
                          type="button"
                          onClick={() => setPaymentModalReport(report)}
                          title="Collect / Update Payment"
                          className={`btn btn-ghost btn-icon btn-sm ${
                            report.paymentStatus === "UNPAID"
                              ? "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                              : report.paymentStatus === "PARTIAL"
                                ? "text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                : "text-slate-400 hover:text-teal-700"
                          }`}
                        >
                          <IndianRupee className="h-3.5 w-3.5" />
                        </button>

                        {/* View — always */}
                        <Link
                          to={`/reports/${report.id}`}
                          title="View"
                          className="btn btn-ghost btn-icon btn-sm text-slate-400 hover:text-teal-700"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Link>

                        {/* DRAFT — edit + delete (download is shown but explains that drafts can't be downloaded) */}
                        {report.status === "DRAFT" && (
                          <>
                            <Link
                              to={`/reports/${report.id}/edit`}
                              title="Edit Draft"
                              className="btn btn-ghost btn-icon btn-sm text-slate-400 hover:text-amber-600"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Link>
                            <ReportRowDownload
                              reportId={report.id}
                              reportNumber={report.reportNumber}
                              patientName={report.patient.name}
                              status="DRAFT"
                            />
                            <button
                              onClick={() => handleDelete(report)}
                              disabled={deletingId === report.id}
                              title="Delete Draft"
                              className="btn btn-ghost btn-icon btn-sm text-slate-400 hover:text-red-600"
                            >
                              {deletingId === report.id ? (
                                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-red-400 border-t-transparent" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </>
                        )}

                        {/* FINAL / SENT — download + share */}
                        {(report.status === "FINAL" || report.status === "SENT") && (
                          <>
                            <ReportRowDownload
                              reportId={report.id}
                              reportNumber={report.reportNumber}
                              patientName={report.patient.name}
                              status={report.status}
                            />
                            <Link
                              to={`/reports/${report.id}?share=1`}
                              title="Share"
                              className="btn btn-ghost btn-icon btn-sm text-slate-400 hover:text-green-700"
                            >
                              <Share2 className="h-3.5 w-3.5" />
                            </Link>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-5 py-3.5">
            <span className="text-xs text-slate-500">
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn btn-ghost btn-icon btn-sm">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2 text-xs text-slate-600">Page {page} of {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn btn-ghost btn-icon btn-sm">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <PaymentModal
        isOpen={!!paymentModalReport}
        onClose={() => setPaymentModalReport(null)}
        report={paymentModalReport}
        onSuccess={(updatedReport) => {
          setReports((prev) =>
            prev.map((r) => (r.id === updatedReport.id ? updatedReport : r))
          );
        }}
      />
    </div>
  );
}