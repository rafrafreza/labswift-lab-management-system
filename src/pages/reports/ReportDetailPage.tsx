import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  FileText,
  IndianRupee,
  Mail,
  MessageCircle,
  Pencil,
  Phone,
  Share2,
  Trash2,
} from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import PaymentModal from "@/components/shared/PaymentModal";
import PDFDownloadButton from "@/components/shared/PDFDownloadButton";
import { deleteReport, getReport } from "@/lib/services/reports";
import {
  buildWhatsAppLink,
  formatAge,
  formatCurrency,
  formatDate,
  formatDateTime,
  GENDER_LABELS,
  STATUS_CONFIG,
} from "@/lib/utils";
import type { ReportWithRelations } from "@/types";

export default function ReportDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [report, setReport] = useState<ReportWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [shareOpen, setShareOpen] = useState(searchParams.get("share") === "1");
  const [deleting, setDeleting] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);

  useEffect(() => {
    getReport(id)
      .then(setReport)
      .catch(() => navigate("/reports", { replace: true }))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  async function handleDelete() {
    if (!report) return;
    const confirmed = window.confirm(
      `Delete draft ${report.reportNumber} for ${report.patient.name}? This cannot be undone.`,
    );
    if (!confirmed) return;
    setDeleting(true);
    try {
      await deleteReport(report.id);
      toast.success("Draft deleted.");
      navigate("/reports", { replace: true });
    } catch {
      toast.error("Failed to delete report.");
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
      </div>
    );
  }

  if (!report) return null;

  const isDraft = report.status === "DRAFT";
  const hasAbnormal = report.values.some((v) => v.isAbnormal);

  const sections = report.values.reduce(
    (groups, value) => {
      const section = value.field.section || "Results";
      groups[section] ??= [];
      groups[section].push(value);
      return groups;
    },
    {} as Record<string, typeof report.values>,
  );

  const whatsappLink = buildWhatsAppLink(
    report.patient.phone ?? "",
    `Your lab report is ready.\n\nPatient: ${report.patient.name}\nTest: ${report.template.name}\nReport No: ${report.reportNumber}\nDate: ${formatDate(report.collectedAt)}\n\nPlease collect your report from the lab.\n\nThank you!`,
  );

  return (
    <div className="max-w-4xl space-y-5">
      {/* Top bar */}
      <div className="flex items-center gap-4">
        <Link to="/reports" className="btn btn-ghost btn-icon">
          <ArrowLeft className="h-4 w-4 text-slate-500" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="page-title">{report.reportNumber}</h1>
            <span className={`badge badge-${report.status.toLowerCase()}`}>
              {STATUS_CONFIG[report.status].label}
            </span>
            {hasAbnormal && !isDraft && (
              <span className="badge border border-red-200 bg-red-50 text-red-600">
                <AlertTriangle className="h-3 w-3" /> Abnormal Values
              </span>
            )}
          </div>
          <p className="page-subtitle">
            Created {formatDateTime(report.createdAt)} · by {report.createdBy.name}
          </p>
        </div>

        {/* Actions — different for DRAFT vs FINAL/SENT */}
        <div className="flex items-center gap-2">
          {isDraft ? (
            <>
              <Link to={`/reports/${report.id}/edit`} className="btn btn-secondary">
                <Pencil className="h-4 w-4" /> Edit Draft
              </Link>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="btn btn-secondary text-red-600 hover:border-red-300 hover:bg-red-50"
              >
                {deleting ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-red-400 border-t-transparent" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Delete
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setPaymentModalOpen(true)}
                className={`btn ${
                  report.paymentStatus === "UNPAID"
                    ? "btn-primary bg-emerald-600 hover:bg-emerald-700 text-white"
                    : report.paymentStatus === "PARTIAL"
                      ? "btn-primary bg-amber-600 hover:bg-amber-700 text-white"
                      : "btn-secondary"
                }`}
              >
                <IndianRupee className="h-4 w-4" />
                {report.paymentStatus === "UNPAID"
                  ? "Collect Payment"
                  : report.paymentStatus === "PARTIAL"
                    ? "Collect Due"
                    : "Update Payment"}
              </button>

              {/* Share dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShareOpen((v) => !v)}
                  className="btn btn-secondary"
                >
                  <Share2 className="h-4 w-4" /> Share
                </button>
                {shareOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShareOpen(false)} />
                    <div className="absolute right-0 top-full z-20 mt-2 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-dropdown animate-fade-in">
                      <a
                        href={whatsappLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setShareOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <MessageCircle className="h-4 w-4 text-green-600" />
                        Send via WhatsApp
                      </a>
                      <button
                        onClick={() => {
                          toast.info("Email sharing coming soon.");
                          setShareOpen(false);
                        }}
                        className="flex w-full items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <Mail className="h-4 w-4 text-blue-600" />
                        Send via Email
                      </button>
                    </div>
                  </>
                )}
              </div>

              <PDFDownloadButton report={report} />
            </>
          )}
        </div>
      </div>

      {/* Draft notice banner */}
      {isDraft && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          <span className="font-semibold">This is a draft report.</span> Values may be incomplete.
          Use <strong>Edit Draft</strong> to update and finalise it.
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Left sidebar */}
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Patient
            </h2>
            <div className="mb-3 flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-100 font-semibold text-teal-700">
                {report.patient.name.charAt(0)}
              </div>
              <div>
                <div className="font-semibold text-slate-900">{report.patient.name}</div>
                <div className="mt-0.5 text-xs text-slate-500">
                  {formatAge(report.patient.age, report.patient.ageMonths)} · {GENDER_LABELS[report.patient.gender]}
                </div>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-slate-600">
                <Phone className="h-3.5 w-3.5 text-slate-400" />
                <span>{report.patient.phone}</span>
              </div>
              {report.patient.refDoctor && (
                <div className="text-slate-600">
                  <span className="text-xs text-slate-400">Ref. by </span>
                  {report.patient.refDoctor}
                </div>
              )}
              <Link
                to={`/patients/${report.patient.id}`}
                className="text-xs text-teal-700 hover:underline"
              >
                View patient profile →
              </Link>
            </div>
          </div>

          <div className="card p-5">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Test Info
            </h2>
            <div className="space-y-2 text-sm">
              <div>
                <div className="text-xs text-slate-400">Test Name</div>
                <div className="font-medium text-slate-800">{report.template.name}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Category</div>
                <div className="text-slate-700">{report.template.category}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Collected</div>
                <div className="text-slate-700">{formatDateTime(report.collectedAt)}</div>
              </div>
              {report.reportedAt && (
                <div>
                  <div className="text-xs text-slate-400">Reported</div>
                  <div className="text-slate-700">{formatDateTime(report.reportedAt)}</div>
                </div>
              )}
            </div>
          </div>

          {/* Billing card */}
          {((report.billAmount ?? report.template.price) != null || report.discount != null) && (() => {
            const basePrice = report.billAmount ?? report.template.price ?? 0;
            const discountVal = report.discount ?? 0;
            const discountAmt = report.discountType === "PERCENT"
              ? (basePrice * discountVal) / 100
              : discountVal;
            const net = Math.max(0, basePrice - discountAmt);
            const paid = report.amountPaid != null ? report.amountPaid : (report.paymentStatus === "PAID" ? net : 0);
            const due = Math.max(0, net - paid);

            return (
              <div className="card p-5">
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 flex items-center justify-between">
                  <span>Billing &amp; Payment</span>
                  <span className={`badge ${
                    report.paymentStatus === "PAID" ? "badge-final" :
                    report.paymentStatus === "FREE" ? "bg-purple-100 text-purple-700" :
                    report.paymentStatus === "PARTIAL" ? "bg-amber-100 text-amber-700" :
                    "bg-red-100 text-red-700"
                  }`}>
                    {report.paymentStatus === "PAID" ? "Paid" :
                     report.paymentStatus === "FREE" ? "Free" :
                     report.paymentStatus === "PARTIAL" ? "Partial" : "Unpaid"}
                  </span>
                </h2>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>Base Price</span>
                    <span>{formatCurrency(basePrice)}</span>
                  </div>
                  {discountAmt > 0 && (
                    <div className="flex justify-between text-amber-700 font-medium">
                      <span>Discount ({report.discountType === "PERCENT" ? `${report.discount}%` : "Flat"})</span>
                      <span>-{formatCurrency(discountAmt)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold text-slate-900 border-t border-slate-100 pt-1">
                    <span>Net Bill</span>
                    <span>{formatCurrency(net)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Amount Paid</span>
                    <span className="text-teal-700 font-medium">{formatCurrency(paid)}</span>
                  </div>
                  {due > 0 && (
                    <div className="flex justify-between text-red-600 font-medium">
                      <span>Balance Due</span>
                      <span>{formatCurrency(due)}</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setPaymentModalOpen(true)}
                    className={`mt-3 w-full btn btn-sm cursor-pointer ${
                      report.paymentStatus === "UNPAID"
                        ? "btn-primary bg-emerald-600 hover:bg-emerald-700 text-white"
                        : report.paymentStatus === "PARTIAL"
                          ? "btn-primary bg-amber-600 hover:bg-amber-700 text-white"
                          : "btn-secondary text-slate-700"
                    }`}
                  >
                    <IndianRupee className="h-3.5 w-3.5" />
                    {report.paymentStatus === "UNPAID"
                      ? `Collect Payment (${formatCurrency(due || net)})`
                      : report.paymentStatus === "PARTIAL"
                        ? `Collect Balance (${formatCurrency(due)})`
                        : "Edit Payment & Discount"}
                  </button>
                </div>
              </div>
            );
          })()}

          {report.notes && (
            <div className="card p-5">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Notes
              </h2>
              <p className="text-sm leading-relaxed text-slate-700">{report.notes}</p>
            </div>
          )}
        </div>

        {/* Results table */}
        <div className="card overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <FileText className="h-4 w-4 text-teal-600" />
              Test Results
            </h2>
            {hasAbnormal && !isDraft && (
              <span className="flex items-center gap-1 text-xs text-red-600">
                <AlertTriangle className="h-3 w-3" />
                Bold red = abnormal
              </span>
            )}
          </div>

          <div className="divide-y divide-slate-100">
            {Object.entries(sections).map(([section, values]) => (
              <div key={section}>
                <div className="bg-slate-50 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {section}
                </div>
                <div className="grid grid-cols-12 gap-2 border-b border-slate-100 px-5 py-2">
                  <div className="col-span-5 text-xs font-medium text-slate-400">Parameter</div>
                  <div className="col-span-3 text-xs font-medium text-slate-400">Result</div>
                  <div className="col-span-2 text-xs font-medium text-slate-400">Unit</div>
                  <div className="col-span-2 text-xs font-medium text-slate-400">Normal Range</div>
                </div>
                {values.map((value) => {
                  // ── WIDAL: render dilution grid ──────────────────────
                  if (value.field.fieldType === "WIDAL") {
                    const ANTIGENS  = ["S.TYPHI O", "S.TYPHI H", "S.PARATYPHI AH", "S.PARATYPHI BH"];
                    const DILUTIONS = ["1:20", "1:40", "1:80", "1:160", "1:320"];
                    let grid: Record<string, Record<string, string>> = {};
                    try { grid = JSON.parse(value.value || "{}"); } catch { grid = {}; }

                    return (
                      <div key={value.id} className="px-5 py-3">
                        <div className="mb-2 text-sm font-semibold text-slate-700">{value.field.fieldName}</div>
                        <div className="overflow-x-auto rounded-lg border border-slate-200">
                          <table className="w-full border-collapse text-sm">
                            <thead>
                              <tr className="bg-slate-100">
                                <th className="border border-slate-200 px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Antigen</th>
                                {DILUTIONS.map((d) => (
                                  <th key={d} className="border border-slate-200 px-4 py-2 text-center text-xs font-semibold text-slate-500">{d}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {ANTIGENS.map((antigen, ai) => (
                                <tr key={antigen} className={ai % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                                  <td className="border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700">{antigen}</td>
                                  {DILUTIONS.map((dilution) => {
                                    const cell = grid[antigen]?.[dilution] ?? "–";
                                    return (
                                      <td key={dilution} className="border border-slate-200 px-4 py-2 text-center">
                                        <span className={`font-semibold ${cell === "+" ? "text-red-600" : "text-slate-400"}`}>
                                          {cell}
                                        </span>
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  }

                  // ── POSITIVE_NEGATIVE / REACTIVE: colour-coded ───────
                  const isPositive = value.value === "POSITIVE" || value.value === "REACTIVE";
                  const isNegative = value.value === "NEGATIVE" || value.value === "NON-REACTIVE";

                  return (
                    <div
                      key={value.id}
                      className={`grid grid-cols-12 items-center gap-2 px-5 py-2.5 ${
                        value.isAbnormal && !isDraft ? "bg-red-50/50" : ""
                      }`}
                    >
                      <div className={`col-span-5 text-sm text-slate-700 ${value.field.isBold ? "font-semibold" : ""}`}>
                        {value.field.fieldName}
                      </div>
                      <div className={`col-span-3 text-sm font-semibold ${
                        isPositive ? "text-red-600" :
                        isNegative ? "text-green-600" :
                        value.isAbnormal && !isDraft ? "text-red-600" : "text-slate-900"
                      }`}>
                        {value.value || <span className="text-slate-300 italic">—</span>}
                      </div>
                      <div className="col-span-2 text-xs text-slate-500">{value.field.unit || "-"}</div>
                      <div className="col-span-2 text-xs text-slate-500">{value.field.normalRangeText || "-"}</div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <PaymentModal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        report={report}
        onSuccess={(updated) => setReport(updated)}
      />
    </div>
  );
}