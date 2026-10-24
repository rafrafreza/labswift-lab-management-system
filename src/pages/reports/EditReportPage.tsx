import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, ClipboardList, IndianRupee, Save } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import { listDoctors } from "@/lib/services/doctors";
import { getReport, updateReport } from "@/lib/services/reports";
import { listTemplates } from "@/lib/services/templates";
import { cn, formatAge, formatCurrency, isValueAbnormal } from "@/lib/utils";
import type { Doctor, ReportWithRelations, TemplateWithFields } from "@/types";

export default function EditReportPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();

  const [report, setReport] = useState<ReportWithRelations | null>(null);
  const [templates, setTemplates] = useState<TemplateWithFields[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state — mirrors NewReportPage step 3
  const [values, setValues] = useState<Record<string, string>>({});
  const [collectedAt, setCollectedAt] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Billing state
  const [billAmount, setBillAmount] = useState<number | "">("");
  const [discountType, setDiscountType] = useState<"FLAT" | "PERCENT">("FLAT");
  const [discount, setDiscount] = useState<number | "">("");
  const [amountPaid, setAmountPaid] = useState<number | "">("");
  const [paymentStatus, setPaymentStatus] = useState<"PAID" | "PARTIAL" | "UNPAID" | "FREE">("PAID");

  // Load the draft report + templates + doctors
  useEffect(() => {
    Promise.all([getReport(id), listTemplates(true), listDoctors(true)])
      .then(([r, tmpl, docs]) => {
        if (r.status !== "DRAFT") {
          toast.error("Only draft reports can be edited.");
          navigate(`/reports/${id}`, { replace: true });
          return;
        }
        setReport(r);
        setTemplates(tmpl);
        setDoctors(docs);

        // Pre-fill form state from existing draft values
        const prefilled: Record<string, string> = {};
        r.values.forEach((v) => {
          prefilled[v.fieldId] = v.value;
        });
        setValues(prefilled);
        setCollectedAt(new Date(r.collectedAt).toISOString().slice(0, 16));
        setNotes(r.notes ?? "");

        const templatePrice = tmpl.find((t) => t.id === r.templateId)?.price ?? 0;
        const initialBill = r.billAmount != null ? r.billAmount : templatePrice;
        setBillAmount(initialBill);
        setDiscountType(r.discountType ?? "FLAT");
        setDiscount(r.discount ?? 0);
        setPaymentStatus(r.paymentStatus ?? "PAID");
        setAmountPaid(r.amountPaid != null ? r.amountPaid : initialBill);
      })
      .catch(() => {
        toast.error("Could not load report.");
        navigate("/reports", { replace: true });
      })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  // Find the full template object (with field metadata) matching this report
  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === report?.templateId) ?? null,
    [templates, report],
  );

  const referringDoctor = useMemo(
    () => doctors.find((d) => d.id === report?.patient.doctorId),
    [doctors, report],
  );

  const numBillAmount = billAmount === "" ? 0 : Number(billAmount);
  const numDiscount = discount === "" ? 0 : Number(discount);
  const discountAmount = useMemo(() => {
    if (discountType === "PERCENT") {
      return (numBillAmount * Math.min(100, Math.max(0, numDiscount))) / 100;
    }
    return Math.min(numBillAmount, Math.max(0, numDiscount));
  }, [numBillAmount, numDiscount, discountType]);

  const netBill = Math.max(0, numBillAmount - discountAmount);
  const dueAmount = paymentStatus === "PAID" ? 0 : Math.max(0, netBill - (amountPaid === "" ? 0 : Number(amountPaid)));
  const doctorIncentive = referringDoctor ? Math.round((netBill * referringDoctor.incentiveRate) / 100) : 0;

  const groupedFields = useMemo(
    () =>
      selectedTemplate?.fields.reduce(
        (groups, field) => {
          const section = field.section || "Results";
          groups[section] ??= [];
          groups[section].push(field);
          return groups;
        },
        {} as Record<string, TemplateWithFields["fields"]>,
      ) ?? {},
    [selectedTemplate],
  );

  async function handleSubmit(status: "DRAFT" | "FINAL") {
    if (!report || !selectedTemplate) return;

    // Validate only when finalising — drafts can have empty fields
    if (status === "FINAL") {
      const missing = selectedTemplate.fields
        .filter((f) => !values[f.id]?.trim())
        .map((f) => f.fieldName);
      if (missing.length > 0) {
        toast.error(
          `Fill in: ${missing.slice(0, 3).join(", ")}${missing.length > 3 ? "..." : ""}`,
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      const updated = await updateReport(report.id, {
        status,
        collectedAt,
        notes,
        billAmount: numBillAmount,
        discountType,
        discount: numDiscount,
        amountPaid: paymentStatus === "PAID" ? netBill : (amountPaid === "" ? 0 : Number(amountPaid)),
        paymentStatus,
        values: selectedTemplate.fields.map((f) => ({
          fieldId: f.id,
          value: values[f.id] ?? "",
        })),
      });
      toast.success(
        status === "DRAFT"
          ? "Draft saved."
          : `Report ${updated.reportNumber} finalised!`,
      );
      navigate(`/reports/${updated.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save report.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
      </div>
    );
  }

  if (!report || !selectedTemplate) return null;

  return (
    <div className="max-w-3xl space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-4">
        <Link to={`/reports/${id}`} className="btn btn-ghost btn-icon">
          <ArrowLeft className="h-4 w-4 text-slate-500" />
        </Link>
        <div>
          <h1 className="page-title">Edit Draft — {report.reportNumber}</h1>
          <p className="page-subtitle">
            {report.patient.name} · {selectedTemplate.name}
          </p>
        </div>
      </div>

      {/* Summary bar */}
      <div className="card flex flex-wrap items-center gap-4 p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-600 text-xs font-semibold text-white">
            {report.patient.name.charAt(0)}
          </div>
          <div>
            <div className="text-sm font-medium text-slate-800">{report.patient.name}</div>
            <div className="text-xs text-slate-400">
              {formatAge(report.patient.age, report.patient.ageMonths)} · {report.patient.patientCode}
            </div>
          </div>
        </div>
        <div className="h-8 w-px bg-slate-200" />
        <div>
          <div className="text-sm font-medium text-slate-800">{selectedTemplate.name}</div>
          <div className="text-xs text-slate-400">{selectedTemplate.category}</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <label className="text-xs text-slate-500">Collection date:</label>
          <input
            type="datetime-local"
            value={collectedAt}
            onChange={(e) => setCollectedAt(e.target.value)}
            className="form-input w-44 py-1 text-xs"
          />
        </div>
      </div>

      {/* Fields */}
      <div className="card space-y-6 p-6">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <ClipboardList className="h-4 w-4 text-teal-600" />
          Test Results
        </div>

        {Object.entries(groupedFields).map(([section, fields]) => (
          <div key={section}>
            <h3 className="mb-3 border-b border-slate-100 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {section}
            </h3>
            <div className="space-y-3">
              <div className="grid grid-cols-12 gap-3 px-1">
                <div className="col-span-5 text-xs font-medium text-slate-400">Parameter</div>
                <div className="col-span-3 text-xs font-medium text-slate-400">Result</div>
                <div className="col-span-2 text-xs font-medium text-slate-400">Unit</div>
                <div className="col-span-2 text-xs font-medium text-slate-400">Normal Range</div>
              </div>
              {fields.map((field) => {
                const value = values[field.id] || "";
                const abnormal = value ? isValueAbnormal(value, field.normalRangeMin, field.normalRangeMax) : false;

                // ── WIDAL: full dilution grid ──────────────────────────────────────────
                if (field.fieldType === "WIDAL") {
                  const ANTIGENS = ["S.TYPHI O", "S.TYPHI H", "S.PARATYPHI AH", "S.PARATYPHI BH"];
                  const DILUTIONS = ["1:20", "1:40", "1:80", "1:160", "1:320"];
                  // stored as JSON string: { "S.TYPHI O": {"1:20":"+","1:40":"+", ...}, ... }
                  let grid: Record<string, Record<string, string>> = {};
                  try { grid = JSON.parse(value || "{}"); } catch { grid = {}; }

                  function setCell(antigen: string, dilution: string, val: string) {
                    const next = { ...grid, [antigen]: { ...(grid[antigen] || {}), [dilution]: val } };
                    setValues((cur) => ({ ...cur, [field.id]: JSON.stringify(next) }));
                  }

                  return (
                    <div key={field.id} className="col-span-12">
                      <div className="mb-2 text-sm font-semibold text-slate-800">{field.fieldName}</div>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50">
                              <th className="border border-slate-200 px-3 py-2 text-left font-medium text-slate-600">Antigen</th>
                              {DILUTIONS.map((d) => (
                                <th key={d} className="border border-slate-200 px-3 py-2 text-center font-medium text-slate-600">{d}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {ANTIGENS.map((antigen) => (
                              <tr key={antigen}>
                                <td className="border border-slate-200 px-3 py-1.5 font-medium text-slate-700">{antigen}</td>
                                {DILUTIONS.map((dilution) => {
                                  const cell = grid[antigen]?.[dilution] || "";
                                  return (
                                    <td key={dilution} className="border border-slate-200 px-2 py-1 text-center">
                                      <select
                                        value={cell}
                                        onChange={(e) => setCell(antigen, dilution, e.target.value)}
                                        className="w-14 rounded border border-slate-200 bg-white px-1 py-0.5 text-center text-xs"
                                      >
                                        <option value="">–</option>
                                        <option value="+">+</option>
                                        <option value="-">−</option>
                                      </select>
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

                // ── POSITIVE_NEGATIVE dropdown ─────────────────────────────────────────
                if (field.fieldType === "POSITIVE_NEGATIVE") {
                  return (
                    <div key={field.id} className="grid grid-cols-12 items-center gap-3">
                      <div className={cn("col-span-5 text-sm", field.isBold ? "font-semibold text-slate-800" : "text-slate-700")}>
                        {field.fieldName}
                      </div>
                      <div className="col-span-3">
                        <select
                          value={value}
                          onChange={(e) => setValues((cur) => ({ ...cur, [field.id]: e.target.value }))}
                          className={cn(
                            "form-input py-1.5 text-sm",
                            value === "POSITIVE" && "border-red-400 bg-red-50 font-semibold text-red-700",
                            value === "NEGATIVE" && "border-green-400 bg-green-50 font-semibold text-green-700",
                          )}
                        >
                          <option value="">— Select —</option>
                          <option value="NEGATIVE">NEGATIVE</option>
                          <option value="POSITIVE">POSITIVE</option>
                        </select>
                      </div>
                      <div className="col-span-2 text-xs text-slate-500">{field.unit || "—"}</div>
                      <div className="col-span-2 text-xs text-slate-500">{field.normalRangeText || "NEGATIVE"}</div>
                    </div>
                  );
                }

                // ── REACTIVE dropdown (HIV, VDRL etc.) ────────────────────────────────
                if (field.fieldType === "REACTIVE") {
                  return (
                    <div key={field.id} className="grid grid-cols-12 items-center gap-3">
                      <div className={cn("col-span-5 text-sm", field.isBold ? "font-semibold text-slate-800" : "text-slate-700")}>
                        {field.fieldName}
                      </div>
                      <div className="col-span-3">
                        <select
                          value={value}
                          onChange={(e) => setValues((cur) => ({ ...cur, [field.id]: e.target.value }))}
                          className={cn(
                            "form-input py-1.5 text-sm",
                            value === "REACTIVE" && "border-red-400 bg-red-50 font-semibold text-red-700",
                            value === "NON-REACTIVE" && "border-green-400 bg-green-50 font-semibold text-green-700",
                          )}
                        >
                          <option value="">— Select —</option>
                          <option value="NON-REACTIVE">NON-REACTIVE</option>
                          <option value="REACTIVE">REACTIVE</option>
                        </select>
                      </div>
                      <div className="col-span-2 text-xs text-slate-500">{field.unit || "—"}</div>
                      <div className="col-span-2 text-xs text-slate-500">{field.normalRangeText || "NON-REACTIVE"}</div>
                    </div>
                  );
                }

                // ── Default: NUMBER / TEXT / SELECT ───────────────────────────────────
                return (
                  <div key={field.id} className="grid grid-cols-12 items-center gap-3">
                    <div className={cn("col-span-5 text-sm", field.isBold ? "font-semibold text-slate-800" : "text-slate-700")}>
                      {field.fieldName}
                    </div>
                    <div className="col-span-3">
                      <input
                        type={field.fieldType === "NUMBER" ? "number" : "text"}
                        step="any"
                        value={value}
                        onChange={(e) => setValues((cur) => ({ ...cur, [field.id]: e.target.value }))}
                        placeholder="—"
                        className={cn(
                          "form-input py-1.5 text-sm",
                          abnormal && "border-red-400 bg-red-50 font-semibold text-red-700 focus:border-red-500 focus:ring-red-400/30",
                        )}
                      />
                    </div>
                    <div className="col-span-2 text-xs text-slate-500">{field.unit || "—"}</div>
                    <div className="col-span-2 text-xs text-slate-500">{field.normalRangeText || "—"}</div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <div>
          <label className="form-label">Clinical Notes (optional)</label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any additional observations..."
            className="form-input resize-none text-sm"
          />
        </div>

        {/* Billing & Discounts */}
        <div className="border-t border-slate-100 pt-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <IndianRupee className="h-4 w-4 text-teal-600" /> Billing &amp; Discount
            </h3>
            {referringDoctor && (
              <span className="text-xs text-slate-500">
                Ref. Doctor: <span className="font-medium text-slate-700">Dr. {referringDoctor.name}</span> ({referringDoctor.incentiveRate}% incentive)
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <label className="form-label text-xs">Test Price (Rs.)</label>
              <input
                type="number"
                min={0}
                step="1"
                className="form-input text-sm"
                value={billAmount}
                onChange={(e) => setBillAmount(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </div>

            <div>
              <label className="form-label text-xs">Discount</label>
              <div className="flex gap-2">
                <select
                  className="form-input text-xs w-24 flex-shrink-0"
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as "FLAT" | "PERCENT")}
                >
                  <option value="FLAT">Flat (Rs.)</option>
                  <option value="PERCENT">Percent (%)</option>
                </select>
                <input
                  type="number"
                  min={0}
                  step={discountType === "PERCENT" ? "1" : "1"}
                  max={discountType === "PERCENT" ? 100 : undefined}
                  className="form-input text-sm flex-1"
                  placeholder="0"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value === "" ? "" : Number(e.target.value))}
                />
              </div>
            </div>

            <div>
              <label className="form-label text-xs">Payment Status</label>
              <select
                className="form-input text-sm"
                value={paymentStatus}
                onChange={(e) => {
                  const st = e.target.value as "PAID" | "PARTIAL" | "UNPAID" | "FREE";
                  setPaymentStatus(st);
                  if (st === "PAID") setAmountPaid(netBill);
                  else if (st === "UNPAID" || st === "FREE") setAmountPaid(0);
                }}
              >
                <option value="PAID">Paid in Full</option>
                <option value="PARTIAL">Partially Paid</option>
                <option value="UNPAID">Unpaid / Due</option>
                <option value="FREE">Free / Waived</option>
              </select>
            </div>

            {paymentStatus === "PARTIAL" && (
              <div>
                <label className="form-label text-xs">Amount Paid (Rs.)</label>
                <input
                  type="number"
                  min={0}
                  max={netBill}
                  className="form-input text-sm"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value === "" ? "" : Number(e.target.value))}
                />
              </div>
            )}
          </div>

          {/* Summary pill */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1 text-xs">
            <div className="flex items-center gap-4 text-slate-600">
              {discountAmount > 0 && (
                <span className="text-amber-700 font-medium">
                  Discount: -{formatCurrency(discountAmount)} ({discountType === "PERCENT" ? `${discount}%` : "Flat"})
                </span>
              )}
              <span>
                Net Bill: <strong className="text-slate-900 text-sm">{formatCurrency(netBill)}</strong>
              </span>
              {dueAmount > 0 && (
                <span className="text-red-600 font-medium">Due: {formatCurrency(dueAmount)}</span>
              )}
            </div>

            {referringDoctor && (
              <div className="text-teal-700 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200">
                Dr. Referral Amount: <strong>{formatCurrency(doctorIncentive)}</strong> ({referringDoctor.incentiveRate}% on net Rs. {netBill})
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-between">
        <Link to={`/reports/${id}`} className="btn btn-secondary">
          <ArrowLeft className="h-4 w-4" /> Cancel
        </Link>
        <div className="flex gap-2">
          <button
            onClick={() => handleSubmit("DRAFT")}
            disabled={submitting}
            className="btn btn-secondary"
          >
            <Save className="h-4 w-4" />
            {submitting ? "Saving..." : "Save as Draft"}
          </button>
          <button
            onClick={() => handleSubmit("FINAL")}
            disabled={submitting}
            className="btn btn-primary"
          >
            <Check className="h-4 w-4" />
            {submitting ? "Generating..." : "Generate Final Report"}
          </button>
        </div>
      </div>
    </div>
  );
}