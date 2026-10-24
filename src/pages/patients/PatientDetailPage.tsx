import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  CheckSquare,
  Download,
  Droplets,
  Edit2,
  FileText,
  IndianRupee,
  Mail,
  MapPin,
  MinusSquare,
  Phone,
  Plus,
  Square,
  Stethoscope,
  User,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "sonner";

import PaymentModal from "@/components/shared/PaymentModal";
import ReportRowDownload from "@/components/shared/ReportRowDownload";
import { getPatient } from "@/lib/services/patients";
import { getSettings } from "@/lib/services/settings";
import {
  formatAge,
  formatCurrency,
  formatDate,
  formatDateTime,
  GENDER_LABELS,
  STATUS_CONFIG,
} from "@/lib/utils";
import type { PatientWithReports, ReportWithRelations } from "@/types";

export default function PatientDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<PatientWithReports | null>(null);
  const [loading, setLoading] = useState(true);

  // Multi-select for combined PDF download
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [downloadingCombined, setDownloadingCombined] = useState(false);
  const [paymentModalReport, setPaymentModalReport] = useState<ReportWithRelations | null>(null);

  useEffect(() => {
    getPatient(id)
      .then(setPatient)
      .catch(() => navigate("/patients", { replace: true }))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  // Sort reports latest to oldest
  const sortedReports = useMemo(() => {
    if (!patient?.reports) return [];
    return [...patient.reports].sort((a, b) => {
      const timeB = new Date(b.collectedAt || b.createdAt).getTime();
      const timeA = new Date(a.collectedAt || a.createdAt).getTime();
      return timeB - timeA;
    });
  }, [patient?.reports]);

  // Group sorted reports by date (e.g., Today, Yesterday, or formatted date)
  const groupedReports = useMemo(() => {
    const groups: {
      dateKey: string;
      displayDate: string;
      isToday: boolean;
      reports: ReportWithRelations[];
    }[] = [];

    const map = new Map<string, ReportWithRelations[]>();
    for (const report of sortedReports) {
      const d = new Date(report.collectedAt || report.createdAt);
      const key = format(d, "yyyy-MM-dd");
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(report);
    }

    const todayStr = format(new Date(), "yyyy-MM-dd");
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = format(yesterday, "yyyy-MM-dd");

    for (const [key, reports] of map.entries()) {
      const sampleDate = new Date(reports[0].collectedAt || reports[0].createdAt);
      let displayDate = format(sampleDate, "dd MMMM yyyy (EEEE)");
      let isToday = false;

      if (key === todayStr) {
        displayDate = `Today · ${format(sampleDate, "dd MMM yyyy")}`;
        isToday = true;
      } else if (key === yesterdayStr) {
        displayDate = `Yesterday · ${format(sampleDate, "dd MMM yyyy")}`;
      }

      groups.push({
        dateKey: key,
        displayDate,
        isToday,
        reports,
      });
    }

    return groups;
  }, [sortedReports]);

  // Selection handlers
  const toggleSelectReport = (reportId: string, e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(reportId)) next.delete(reportId);
      else next.add(reportId);
      return next;
    });
  };

  const toggleDateGroup = (reports: ReportWithRelations[]) => {
    const allSelected = reports.every((r) => selectedIds.has(r.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        reports.forEach((r) => next.delete(r.id));
      } else {
        reports.forEach((r) => next.add(r.id));
      }
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === sortedReports.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedReports.map((r) => r.id)));
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  // Download combined PDF of all selected reports
  const handleDownloadCombined = async () => {
    if (selectedIds.size === 0 || !patient) return;
    setDownloadingCombined(true);
    try {
      const selectedReports = sortedReports.filter((r) => selectedIds.has(r.id));
      const [settings, { pdf }, { default: LabReportPDF }] = await Promise.all([
        getSettings(),
        import("@react-pdf/renderer"),
        import("@/components/shared/LabReportPDF"),
      ]);

      const pdfSettings = {
        ...settings,
        labWebsite: settings.labWebsite ?? undefined,
        logoUrl: settings.logoUrl ?? undefined,
        signatureUrl: settings.signatureUrl ?? undefined,
        reportFooter: settings.reportFooter ?? undefined,
        useSignature: settings.useSignature,
      };

      const blob = await pdf(<LabReportPDF reports={selectedReports} settings={pdfSettings} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const cleanName = patient.name.replace(/\s+/g, "-");
      const reportDate = selectedReports[0]?.collectedAt || selectedReports[0]?.createdAt || new Date();
      const dateStr = format(new Date(reportDate), "dd-MM");
      a.download = `${patient.patientCode}-${cleanName}-${dateStr}-Combined-Reports.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Downloaded combined PDF with ${selectedReports.length} report${selectedReports.length > 1 ? "s" : ""}`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate combined PDF");
    } finally {
      setDownloadingCombined(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
      </div>
    );
  }

  if (!patient) {
    return null;
  }

  const infoRows = [
    { icon: User, label: "Patient ID", value: patient.patientCode },
    { icon: Phone, label: "Phone", value: patient.phone },
    { icon: Mail, label: "Email", value: patient.email || "-" },
    { icon: MapPin, label: "Address", value: patient.address || "-" },
    { icon: Stethoscope, label: "Referring Doctor", value: patient.refDoctor || "-" },
    { icon: Droplets, label: "Blood Group", value: patient.bloodGroup || "-" },
  ];

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex items-center gap-4">
        <Link to="/patients" className="btn btn-ghost btn-icon">
          <ArrowLeft className="h-4 w-4 text-slate-500" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-700 text-lg font-bold text-white">
              {patient.name.charAt(0)}
            </div>
            <div>
              <h1 className="page-title">{patient.name}</h1>
              <p className="page-subtitle">
                {formatAge(patient.age, patient.ageMonths)} · {GENDER_LABELS[patient.gender]} · Registered {formatDate(patient.createdAt)}
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to={`/patients/${id}/edit`} className="btn btn-secondary">
            <Edit2 className="h-4 w-4" /> Edit
          </Link>
          <Link to={`/reports/new?patientId=${id}`} className="btn btn-primary">
            <Plus className="h-4 w-4" /> New Report
          </Link>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Left Column: Details & Summary */}
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Patient Details</h2>
            <div className="space-y-3.5">
              {infoRows.map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-3">
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-slate-100">
                    <Icon className="h-3.5 w-3.5 text-slate-500" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">{label}</div>
                    <div className={`mt-0.5 text-sm font-medium ${label === "Patient ID" ? "inline-block rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-500" : "text-slate-800"}`}>
                      {value}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Report Summary</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Total", value: patient.reports.length, color: "text-slate-900" },
                { label: "Final", value: patient.reports.filter((report) => report.status === "FINAL").length, color: "text-green-600" },
                { label: "Sent", value: patient.reports.filter((report) => report.status === "SENT").length, color: "text-blue-600" },
                { label: "Draft", value: patient.reports.filter((report) => report.status === "DRAFT").length, color: "text-amber-600" },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-lg bg-slate-50 p-3 text-center">
                  <div className={`text-2xl font-bold ${color}`}>{value}</div>
                  <div className="mt-0.5 text-xs text-slate-400">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Reports History with Date Categorization & Multi-Select */}
        <div className="card overflow-hidden lg:col-span-2">
          {/* Header Bar */}
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-slate-800">Reports History</h2>
              {sortedReports.length > 0 && (
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                  {sortedReports.length} {sortedReports.length === 1 ? "report" : "reports"}
                </span>
              )}
            </div>
            <Link to={`/reports/new?patientId=${id}`} className="btn btn-primary btn-sm">
              <Plus className="h-3.5 w-3.5" /> New Report
            </Link>
          </div>

          {/* Multi-Select Action Toolbar */}
          {sortedReports.length > 0 && (
            <div className={`transition-all border-b px-5 py-3 ${
              selectedIds.size > 0 
                ? "bg-teal-50/80 border-teal-200" 
                : "bg-slate-50/60 border-slate-100"
            }`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={selectAll}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-teal-700 transition-colors"
                  >
                    {selectedIds.size === sortedReports.length && sortedReports.length > 0 ? (
                      <CheckSquare className="h-4 w-4 text-teal-600" />
                    ) : selectedIds.size > 0 ? (
                      <MinusSquare className="h-4 w-4 text-teal-600" />
                    ) : (
                      <Square className="h-4 w-4 text-slate-400" />
                    )}
                    {selectedIds.size === sortedReports.length
                      ? "Deselect All"
                      : "Select All Reports"}
                  </button>

                  {selectedIds.size > 0 && (
                    <>
                      <span className="text-slate-300">|</span>
                      <span className="text-xs font-bold text-teal-900">
                        {selectedIds.size} of {sortedReports.length} selected
                      </span>
                      <button
                        type="button"
                        onClick={clearSelection}
                        className="text-xs font-medium text-slate-500 hover:text-slate-800 underline transition-colors"
                      >
                        Clear
                      </button>
                    </>
                  )}
                </div>

                {selectedIds.size > 0 && (
                  <button
                    type="button"
                    onClick={handleDownloadCombined}
                    disabled={downloadingCombined}
                    className="btn btn-primary btn-sm shadow-xs inline-flex items-center gap-1.5"
                  >
                    {downloadingCombined ? (
                      <>
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        <span>Generating Combined PDF...</span>
                      </>
                    ) : (
                      <>
                        <Download className="h-3.5 w-3.5" />
                        <span>Download Combined PDF ({selectedIds.size})</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Reports List by Date Categories */}
          {sortedReports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <FileText className="mb-3 h-10 w-10 opacity-25" />
              <p className="mb-1 text-sm font-medium text-slate-500">No reports yet</p>
              <p className="mb-4 text-xs">Create the first report for this patient</p>
              <Link to={`/reports/new?patientId=${id}`} className="btn btn-primary btn-sm">
                <Plus className="h-3.5 w-3.5" /> Create Report
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {groupedReports.map((group) => {
                const allInGroup = group.reports.every((r) => selectedIds.has(r.id));
                const someInGroup = !allInGroup && group.reports.some((r) => selectedIds.has(r.id));

                return (
                  <div key={group.dateKey} className="space-y-0">
                    {/* Date Category Header */}
                    <div className="flex items-center justify-between bg-slate-50 px-5 py-2.5 border-t border-slate-200/80">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        <span className={`text-xs font-bold ${group.isToday ? "text-teal-800" : "text-slate-700"}`}>
                          {group.displayDate}
                        </span>
                        {group.isToday && (
                          <span className="rounded bg-teal-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-teal-800">
                            Latest
                          </span>
                        )}
                        <span className="text-xs text-slate-400">
                          ({group.reports.length} {group.reports.length === 1 ? "test" : "tests"})
                        </span>
                      </div>

                      {/* Select All For Date Button */}
                      <button
                        type="button"
                        onClick={() => toggleDateGroup(group.reports)}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-700 hover:text-teal-800 bg-white hover:bg-teal-50/80 px-2.5 py-1 rounded border border-slate-200 hover:border-teal-300 transition-colors cursor-pointer"
                        title={`Select all reports from ${group.displayDate}`}
                      >
                        {allInGroup ? (
                          <CheckSquare className="h-3.5 w-3.5 text-teal-600" />
                        ) : someInGroup ? (
                          <MinusSquare className="h-3.5 w-3.5 text-teal-600" />
                        ) : (
                          <Square className="h-3.5 w-3.5 text-slate-400" />
                        )}
                        <span>{allInGroup ? "Deselect date" : `Select all for date (${group.reports.length})`}</span>
                      </button>
                    </div>

                    {/* Reports on this date */}
                    <div className="divide-y divide-slate-100">
                      {group.reports.map((report) => {
                        const hasAbnormal = report.values.some((value) => value.isAbnormal);
                        const isSelected = selectedIds.has(report.id);
                        const paymentStatus = report.paymentStatus || "UNPAID";
                        const isUnpaid = paymentStatus === "UNPAID";
                        const billAmount = report.billAmount ?? report.template.price;

                        return (
                          <div
                            key={report.id}
                            className={`group flex items-center gap-3 px-5 py-3.5 transition-colors ${
                              isSelected ? "bg-teal-50/40" : "hover:bg-slate-50/80"
                            }`}
                          >
                            {/* Checkbox for Multi-Select */}
                            <div
                              onClick={(e) => toggleSelectReport(report.id, e)}
                              className="p-1 -m-1 rounded hover:bg-slate-200/50 cursor-pointer flex-shrink-0"
                              title="Toggle select report"
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}} // handled by parent onClick
                                className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                              />
                            </div>

                            {/* Status indicator dot */}
                            <div
                              className={`h-2 w-2 flex-shrink-0 rounded-full ${
                                report.status === "FINAL"
                                  ? "bg-green-500"
                                  : report.status === "SENT"
                                    ? "bg-blue-500"
                                    : "bg-amber-400"
                              }`}
                            />

                            {/* Main Info - Links to report details */}
                            <Link
                              to={`/reports/${report.id}`}
                              className="min-w-0 flex-1 block"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono text-xs font-semibold text-slate-600">
                                  {report.reportNumber}
                                </span>
                                <span className={`badge badge-${report.status.toLowerCase()}`}>
                                  {STATUS_CONFIG[report.status].label}
                                </span>

                                {/* Payment Status Badge */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setPaymentModalReport(report);
                                  }}
                                  title="Click to change payment or discount"
                                  className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold border cursor-pointer hover:opacity-85 transition-opacity ${
                                    paymentStatus === "PAID"
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                      : paymentStatus === "PARTIAL"
                                        ? "bg-amber-50 text-amber-700 border-amber-200"
                                        : paymentStatus === "FREE"
                                          ? "bg-purple-50 text-purple-700 border-purple-200"
                                          : "bg-rose-50 text-rose-700 border-rose-200"
                                  }`}
                                >
                                  {paymentStatus}
                                </button>

                                {hasAbnormal && (
                                  <span className="text-xs font-semibold text-red-500">
                                    ⚠ Abnormal
                                  </span>
                                )}
                              </div>

                              <div className="mt-1 flex items-center justify-between gap-2">
                                <div className="text-sm font-semibold text-slate-800 group-hover:text-teal-700 transition-colors">
                                  {report.template.name}
                                </div>
                                {billAmount != null && (
                                  <div className="text-xs font-mono font-medium text-slate-600">
                                    {formatCurrency(billAmount)}
                                  </div>
                                )}
                              </div>

                              <div className="mt-0.5 text-xs text-slate-400">
                                {report.template.category} · Collected {formatDateTime(report.collectedAt)}
                              </div>
                            </Link>

                            {/* Actions Right */}
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {/* Collect / Update Payment Button */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setPaymentModalReport(report);
                                }}
                                className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-semibold shadow-xs transition-colors cursor-pointer ${
                                  isUnpaid
                                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                                    : paymentStatus === "PARTIAL"
                                      ? "bg-amber-600 hover:bg-amber-700 text-white"
                                      : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
                                }`}
                                title="Collect payment, add discount, or mark free"
                              >
                                <IndianRupee className="h-3 w-3" />
                                <span>
                                  {isUnpaid
                                    ? "Collect"
                                    : paymentStatus === "PARTIAL"
                                      ? "Collect Due"
                                      : "Payment"}
                                </span>
                              </button>

                              {/* Single Report Download Icon */}
                              <ReportRowDownload
                                reportId={report.id}
                                reportNumber={report.reportNumber}
                                patientName={patient.name}
                              />

                              {/* Go to Details Arrow */}
                              <Link
                                to={`/reports/${report.id}`}
                                className="p-1 text-slate-300 transition-colors group-hover:text-teal-600"
                                title="View report details"
                              >
                                <ArrowRight className="h-4 w-4" />
                              </Link>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <PaymentModal
        isOpen={!!paymentModalReport}
        onClose={() => setPaymentModalReport(null)}
        report={paymentModalReport}
        onSuccess={(updatedReport) => {
          setPatient((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              reports: prev.reports.map((r) =>
                r.id === updatedReport.id ? updatedReport : r,
              ),
            };
          });
        }}
      />
    </div>
  );
}
