import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ClipboardList, FlaskConical, IndianRupee, Plus, Search, User } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { listDoctors } from "@/lib/services/doctors";
import { getPatientBasic, listPatients } from "@/lib/services/patients";
import { createReport } from "@/lib/services/reports";
import { listTemplates } from "@/lib/services/templates";
import { useUnsavedChangesWarning } from "@/hooks/useUnsavedChangesWarning";
import { cn, formatAge, formatCurrency, isValueAbnormal } from "@/lib/utils";
import { invalidNumericResults, missingResults, summarize, validateBilling, validateCollectedAt } from "@/lib/validation";
import type { Doctor, Patient, TemplateWithFields } from "@/types";

type Step = 1 | 2 | 3;

export default function NewReportPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedPatientId = searchParams.get("patientId");

  const [step, setStep] = useState<Step>(1);
  const [patientSearch, setPatientSearch] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientLoading, setPatientLoading] = useState(false);
  const [templates, setTemplates] = useState<TemplateWithFields[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateWithFields | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [collectedAt, setCollectedAt] = useState(new Date().toISOString().slice(0, 16));
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Billing state
  const [billAmount, setBillAmount] = useState<number | "">("");
  const [discountType, setDiscountType] = useState<"FLAT" | "PERCENT">("FLAT");
  const [discount, setDiscount] = useState<number | "">("");
  const [amountPaid, setAmountPaid] = useState<number | "">(0);
  const [paymentStatus, setPaymentStatus] = useState<"PAID" | "PARTIAL" | "UNPAID" | "FREE">("UNPAID");

  const [templateSearch, setTemplateSearch] = useState("");

  useEffect(() => {
    listTemplates(true).then(setTemplates).catch(console.error);
    listDoctors(true).then(setDoctors).catch(console.error);
  }, []);

  useEffect(() => {
    if (!preselectedPatientId) {
      return;
    }
    getPatientBasic(preselectedPatientId)
      .then((patient) => {
        setSelectedPatient(patient);
        setStep(2);
      })
      .catch(console.error);
  }, [preselectedPatientId]);

  useEffect(() => {
    if (!patientSearch.trim()) {
      setPatients([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      setPatientLoading(true);
      try {
        const data = await listPatients({ page: 1, limit: 8, search: patientSearch });
        setPatients(data.patients);
      } finally {
        setPatientLoading(false);
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [patientSearch]);

  useEffect(() => {
    if (!selectedTemplate) {
      return;
    }
    const nextValues: Record<string, string> = {};
    selectedTemplate.fields.forEach((field) => {
      nextValues[field.id] = "";
    });
    setValues(nextValues);
    const p = selectedTemplate.price ?? 0;
    setBillAmount(p);
    setDiscount(0);
    setAmountPaid(0);
    setPaymentStatus("UNPAID");
  }, [selectedTemplate]);

  const referringDoctor = useMemo(
    () => doctors.find((d) => d.id === selectedPatient?.doctorId),
    [doctors, selectedPatient],
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

  // Warn before a refresh/close would throw away typed results
  useUnsavedChangesWarning(!submitting && (Object.values(values).some((v) => v.trim() !== "") || notes.trim() !== ""));

  async function handleSubmit(status: "DRAFT" | "FINAL") {
    if (!selectedPatient || !selectedTemplate) {
      return;
    }

    const fields = selectedTemplate.fields;
    if (fields.length === 0) {
      toast.error("This test has no parameters yet. Ask an administrator to add them in Templates.");
      return;
    }
    if (status === "FINAL") {
      const missing = missingResults(fields, values);
      if (missing.length > 0) {
        toast.error(`Fill in: ${summarize(missing)}`);
        return;
      }
    } else if (missingResults(fields, values).length === fields.length) {
      toast.error("Enter at least one result before saving a draft.");
      return;
    }
    const notNumbers = invalidNumericResults(fields, values);
    if (notNumbers.length > 0) {
      toast.error(`These results must be numbers: ${summarize(notNumbers)}`);
      return;
    }
    const dateError = validateCollectedAt(collectedAt);
    if (dateError) {
      toast.error(dateError);
      return;
    }
    const billingError = validateBilling({
      billAmount: numBillAmount,
      discountType,
      discount: numDiscount,
      paymentStatus,
      amountPaid: paymentStatus === "PAID" ? netBill : amountPaid === "" ? 0 : Number(amountPaid),
    });
    if (billingError) {
      toast.error(billingError);
      return;
    }

    setSubmitting(true);
    try {
      const report = await createReport({
        patientId: selectedPatient.id,
        templateId: selectedTemplate.id,
        collectedAt,
        notes,
        status,
        billAmount: numBillAmount,
        discountType,
        discount: numDiscount,
        amountPaid: paymentStatus === "PAID" ? netBill : (amountPaid === "" ? 0 : Number(amountPaid)),
        paymentStatus,
        values: Object.entries(values).map(([fieldId, value]) => ({ fieldId, value })),
      });
      toast.success(`Report ${report.reportNumber} created!`);
      navigate(`/reports/${report.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create report");
      setSubmitting(false);
    }
  }

  const groupedFields = useMemo(
    () =>
      selectedTemplate?.fields.reduce((groups, field) => {
        const section = field.section || "Results";
        groups[section] ??= [];
        groups[section].push(field);
        return groups;
      }, {} as Record<string, TemplateWithFields["fields"]>) || {},
    [selectedTemplate],
  );

  const groupedTemplates = useMemo(
    () =>
      templates.reduce((groups, template) => {
        groups[template.category] ??= [];
        groups[template.category].push(template);
        return groups;
      }, {} as Record<string, TemplateWithFields[]>),
    [templates],
  );

  const steps = [
    { n: 1, label: "Select Patient", icon: User },
    { n: 2, label: "Select Test", icon: FlaskConical },
    { n: 3, label: "Enter Results", icon: ClipboardList },
  ];

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/reports" className="btn btn-ghost btn-icon">
          <ArrowLeft className="h-4 w-4 text-slate-500" />
        </Link>
        <div>
          <h1 className="page-title">New Report</h1>
          <p className="page-subtitle">Step {step} of 3</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {steps.map((item, index) => (
          <div key={item.n} className="flex flex-1 items-center gap-2">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-all",
                  step > item.n ? "bg-teal-700 text-white" : step === item.n ? "bg-teal-700 text-white ring-4 ring-teal-100" : "bg-slate-100 text-slate-400",
                )}
              >
                {step > item.n ? <Check className="h-3.5 w-3.5" /> : item.n}
              </div>
              <span className={cn("hidden text-xs font-medium sm:block", step >= item.n ? "text-slate-800" : "text-slate-400")}>{item.label}</span>
            </div>
            {index < steps.length - 1 && <div className={cn("mx-2 h-0.5 flex-1", step > item.n ? "bg-teal-600" : "bg-slate-200")} />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="card animate-fade-in space-y-4 p-6">
          <h2 className="text-sm font-semibold text-slate-800">Search existing patient or add new</h2>

          <div className="relative">
            {/* <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /> */}
            <input
              type="text"
              placeholder="Type patient name, phone or ID..."
              value={patientSearch}
              onChange={(event) => setPatientSearch(event.target.value)}
              className="form-input pl-9"
            />
          </div>

          {patientSearch && (
            <div className="overflow-hidden rounded-lg border border-slate-200 divide-y divide-slate-100">
              {patientLoading ? (
                <div className="p-4 text-center text-sm text-slate-400">Searching...</div>
              ) : patients.length === 0 ? (
                <div className="p-4 text-center text-sm text-slate-400">
                  No patients found.{" "}
                  <Link to="/patients/new" className="text-teal-700 hover:underline">
                    Add new patient {"->"}
                  </Link>
                </div>
              ) : (
                patients.map((patient) => (
                  <button
                    key={patient.id}
                    onClick={() => {
                      setSelectedPatient(patient);
                      setPatientSearch("");
                      setStep(2);
                    }}
                    className={cn(
                      "flex w-full items-center gap-4 p-3.5 text-left transition-colors hover:bg-teal-50",
                      selectedPatient?.id === patient.id && "bg-teal-50",
                    )}
                  >
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
                      {patient.name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-slate-900">{patient.name}</div>
                      <div className="text-xs text-slate-500">
                        {[formatAge(patient.age, patient.ageMonths), patient.gender, patient.phone].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    <span className="font-mono text-xs text-slate-400">{patient.patientCode}</span>
                  </button>
                ))
              )}
            </div>
          )}

          {selectedPatient && !patientSearch && (
            <div className="flex items-center gap-3 rounded-lg border border-teal-200 bg-teal-50 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-600 font-semibold text-white">
                {selectedPatient.name.charAt(0)}
              </div>
              <div className="flex-1">
                <div className="font-medium text-teal-900">{selectedPatient.name}</div>
                <div className="text-xs text-teal-700">
                  {formatAge(selectedPatient.age, selectedPatient.ageMonths)} · {selectedPatient.patientCode}
                </div>
              </div>
              <Check className="h-5 w-5 text-teal-600" />
            </div>
          )}

          <div className="flex justify-between pt-2">
            <Link to="/patients/new" className="btn btn-secondary btn-sm">
              <Plus className="h-3.5 w-3.5" /> New Patient
            </Link>
            <button onClick={() => setStep(2)} disabled={!selectedPatient} className="btn btn-primary">
              Next <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="card animate-fade-in space-y-5 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">Select test type</h2>
            <div className="rounded-full bg-slate-100 px-3 py-1.5 text-xs text-slate-500">
              Patient: <span className="font-medium text-slate-700">{selectedPatient?.name}</span>
            </div>
          </div>

          {/* Search box */}
          <div className="relative">
            {/* <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /> */}
            <input
              type="text"
              placeholder="Search test name or category..."
              value={templateSearch}
              onChange={(e) => setTemplateSearch(e.target.value)}
              className="form-input pl-9"
            />
          </div>

          {/* Filtered results */}
          {(() => {
            const q = templateSearch.trim().toLowerCase();
            const filtered = q
              ? templates.filter(
                  (t) =>
                    t.name.toLowerCase().includes(q) ||
                    t.category.toLowerCase().includes(q),
                )
              : templates;

            const grouped = filtered.reduce((acc, t) => {
              acc[t.category] ??= [];
              acc[t.category].push(t);
              return acc;
            }, {} as Record<string, TemplateWithFields[]>);

            if (templates.length === 0) {
              return (
                <div className="rounded-lg border border-dashed border-slate-300 py-10 text-center text-sm text-slate-500">
                  <FlaskConical className="mx-auto mb-2 h-8 w-8 opacity-30" />
                  <p className="font-medium">No tests are set up yet</p>
                  <p className="mt-1 text-xs text-slate-400">An administrator needs to add test templates before reports can be created.</p>
                </div>
              );
            }

            if (filtered.length === 0) {
              return (
                <div className="rounded-lg border border-slate-200 py-8 text-center text-sm text-slate-400">
                  No tests found for &quot;{templateSearch}&quot;.{" "}
                  <button type="button" onClick={() => setTemplateSearch("")} className="text-teal-700 hover:underline">
                    Clear search
                  </button>
                </div>
              );
            }

            return Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{category}</div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {items.map((template) => (
                    <button
                      key={template.id}
                      disabled={template.fields.length === 0}
                      title={template.fields.length === 0 ? "This test has no parameters yet" : undefined}
                      onClick={() => { setSelectedTemplate(template); setStep(3); }}
                      className={cn(
                        "flex items-start gap-3 rounded-xl border p-4 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50",
                        selectedTemplate?.id === template.id
                          ? "border-teal-400 bg-teal-50 ring-2 ring-teal-200"
                          : "border-slate-200 hover:border-teal-300 hover:bg-slate-50",
                      )}
                    >
                      <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-teal-100">
                        <FlaskConical className="h-4 w-4 text-teal-700" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-slate-900">{template.name}</div>
                        <div className="mt-0.5 text-xs text-slate-500">
                          {template.fields.length === 0 ? "No parameters yet" : `${template.fields.length} parameters`}
                        </div>
                        {template.price && <div className="mt-1 text-xs font-medium text-teal-700">Rs.{Number(template.price)}</div>}
                      </div>
                      {selectedTemplate?.id === template.id && <Check className="h-4 w-4 flex-shrink-0 text-teal-600" />}
                    </button>
                  ))}
                </div>
              </div>
            ));
          })()}

          <div className="flex justify-between pt-2">
            <button onClick={() => setStep(1)} className="btn btn-secondary">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <button onClick={() => setStep(3)} disabled={!selectedTemplate} className="btn btn-primary">
              Next <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {step === 3 && selectedTemplate && (
        <div className="animate-fade-in space-y-4">
          <div className="card flex flex-wrap items-center gap-4 p-4">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-600 text-xs font-semibold text-white">
                {selectedPatient?.name.charAt(0)}
              </div>
              <div>
                <div className="text-sm font-medium text-slate-800">{selectedPatient?.name}</div>
                <div className="text-xs text-slate-400">
                  {formatAge(selectedPatient?.age, selectedPatient?.ageMonths)} · {selectedPatient?.patientCode}
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
              <input type="datetime-local" value={collectedAt} onChange={(event) => setCollectedAt(event.target.value)} className="form-input w-44 py-1 text-xs" />
            </div>
          </div>

          <div className="card space-y-6 p-6">
            {Object.entries(groupedFields).map(([section, fields]) => (
              <div key={section}>
                <h3 className="mb-3 border-b border-slate-100 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{section}</h3>
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
                onChange={(event) => setNotes(event.target.value)}
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

          <div className="flex justify-between">
            <button onClick={() => setStep(2)} className="btn btn-secondary">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <button onClick={() => handleSubmit("DRAFT")} disabled={submitting} className="btn btn-secondary">
              Save as Draft
            </button>
            <button onClick={() => handleSubmit("FINAL")} disabled={submitting} className="btn btn-primary">
              <Check className="h-4 w-4" /> Generate Report
            </button>
            {/* <button onClick={handleSubmit} disabled={submitting} className="btn btn-primary">
              {submitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Generating...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" /> Generate Report
                </>
              )}
            </button> */}
          </div>
        </div>
      )}
    </div>
  );
}
