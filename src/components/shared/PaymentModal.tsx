import { useState } from "react";
import { Check, DollarSign, IndianRupee, Percent, X } from "lucide-react";
import { toast } from "sonner";

import { updateReportPayment } from "@/lib/services/reports";
import { formatCurrency } from "@/lib/utils";
import { validateBilling } from "@/lib/validation";
import type { ReportWithRelations } from "@/types";

type PaymentModalProps = {
  isOpen: boolean;
  onClose: () => void;
  report: ReportWithRelations | null;
  onSuccess: (updatedReport: ReportWithRelations) => void;
};

type Status = "PAID" | "PARTIAL" | "UNPAID" | "FREE";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Outer shell: renders nothing while closed, and gives the form a fresh state for every report it is opened on. */
export default function PaymentModal({ isOpen, onClose, report, onSuccess }: PaymentModalProps) {
  if (!isOpen || !report) return null;
  return <PaymentForm key={report.id} report={report} onClose={onClose} onSuccess={onSuccess} />;
}

function PaymentForm({
  report,
  onClose,
  onSuccess,
}: {
  report: ReportWithRelations;
  onClose: () => void;
  onSuccess: (updatedReport: ReportWithRelations) => void;
}) {
  const basePrice = report.billAmount ?? report.template.price ?? 0;

  const [discountType, setDiscountType] = useState<"FLAT" | "PERCENT">(report.discountType || "FLAT");
  const [discount, setDiscount] = useState<number>(report.discount || 0);
  // What the cashier picked / typed. The amounts that are saved are DERIVED from these plus the current discount
  // (below), so changing the discount can never leave a stale "amount received" behind.
  const [pickedStatus, setPickedStatus] = useState<Status>(report.paymentStatus || "UNPAID");
  const [partialText, setPartialText] = useState<string>(
    report.paymentStatus === "PARTIAL" && report.amountPaid != null ? String(report.amountPaid) : "",
  );
  const [saving, setSaving] = useState(false);

  // ── Derived money (single source of truth for display and save) ──
  const discountAmount = round2(
    Math.min(
      basePrice,
      discountType === "PERCENT" ? (basePrice * Math.max(0, discount)) / 100 : Math.max(0, discount),
    ),
  );
  const netBill = pickedStatus === "FREE" ? 0 : round2(Math.max(0, basePrice - discountAmount));

  const typedPartial = round2(Math.max(0, Number(partialText) || 0));
  const amountPaid =
    pickedStatus === "PAID"
      ? netBill
      : pickedStatus === "PARTIAL"
        ? Math.min(typedPartial, netBill)
        : 0;

  // A "partial" that covers the whole net bill is a full payment (e.g. 500 typed, then a 100 discount applied),
  // and a partial of nothing is unpaid.
  const paymentStatus: Status =
    pickedStatus === "PARTIAL" && netBill > 0
      ? amountPaid >= netBill
        ? "PAID"
        : amountPaid <= 0
          ? "UNPAID"
          : "PARTIAL"
      : pickedStatus;

  const balanceDue = paymentStatus === "FREE" ? 0 : round2(Math.max(0, netBill - amountPaid));

  const handleSelectStatus = (status: Status) => {
    if (status === "PARTIAL") {
      // Start from half, unless a usable partial amount is already there
      if (!(typedPartial > 0 && typedPartial < netBill)) setPartialText(String(round2(netBill / 2)));
    }
    setPickedStatus(status);
  };

  const handleAmountPaidChange = (text: string) => {
    if (pickedStatus === "FREE") return;
    setPartialText(text);
    setPickedStatus("PARTIAL"); // `paymentStatus` above turns this into PAID / UNPAID when the amount calls for it
  };

  const handleDiscountChange = (raw: number) => {
    const limit = discountType === "PERCENT" ? 100 : basePrice;
    setDiscount(Math.min(Math.max(0, raw), limit));
    if (pickedStatus === "FREE") setPickedStatus("UNPAID"); // editing the discount means it's no longer a free test
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    const billingError = validateBilling({
      billAmount: basePrice,
      discountType,
      discount,
      paymentStatus,
      amountPaid,
    });
    if (billingError) {
      toast.error(billingError);
      return;
    }

    setSaving(true);
    try {
      const updated = await updateReportPayment(report.id, {
        paymentStatus,
        amountPaid,
        discount,
        discountType,
        billAmount: basePrice,
      });

      toast.success(`Payment updated: ${paymentStatus} (${formatCurrency(amountPaid)})`);
      onSuccess(updated);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to update payment");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
      <div
        className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
          <div>
            <h3 className="text-base font-semibold text-slate-800">
              Collect Payment &amp; Billing
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Report <span className="font-mono font-medium">{report.reportNumber}</span> · {report.patient.name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-5">
          {/* Test & Base Price Card */}
          <div className="rounded-xl bg-slate-50 p-4 border border-slate-200/80 space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500">Test / Investigation</span>
              <span className="font-medium text-slate-800">{report.template.name}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500">Base Price</span>
              <span className="font-semibold text-slate-900">{formatCurrency(basePrice)}</span>
            </div>
          </div>

          {/* Discount Section */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Discount Given to Patient
            </label>
            <div className="flex gap-2">
              <div className="flex rounded-lg border border-slate-200 bg-slate-100 p-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setDiscountType("FLAT");
                    setDiscount((d) => Math.min(d, basePrice));
                  }}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                    discountType === "FLAT"
                      ? "bg-white text-teal-800 shadow-xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Flat (₹)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDiscountType("PERCENT");
                    setDiscount((d) => Math.min(d, 100));
                  }}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                    discountType === "PERCENT"
                      ? "bg-white text-teal-800 shadow-xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Percent (%)
                </button>
              </div>

              <div className="relative flex-1">
                <input
                  type="number"
                  min="0"
                  max={discountType === "PERCENT" ? "100" : basePrice}
                  step={discountType === "PERCENT" ? "1" : "10"}
                  value={discount === 0 ? "" : discount}
                  onChange={(e) => handleDiscountChange(Number(e.target.value) || 0)}
                  placeholder="0"
                  className="input pr-8 text-right font-medium"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">
                  {discountType === "PERCENT" ? "%" : "₹"}
                </span>
              </div>
            </div>

            {/* Quick Discount Presets */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] text-slate-400 mr-1">Quick:</span>
              {[
                { label: "No Discount", type: "FLAT" as const, val: 0 },
                { label: "10%", type: "PERCENT" as const, val: 10 },
                { label: "20%", type: "PERCENT" as const, val: 20 },
                { label: "50%", type: "PERCENT" as const, val: 50 },
                { label: "Free (100%)", type: "PERCENT" as const, val: 100 },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setDiscountType(preset.type);
                    setDiscount(preset.val);
                    if (preset.val === 100) setPickedStatus("FREE");
                    else if (pickedStatus === "FREE") setPickedStatus("UNPAID");
                  }}
                  className="rounded bg-slate-100 hover:bg-slate-200/80 px-2 py-0.5 text-[11px] font-medium text-slate-600 transition-colors cursor-pointer"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Net Amount Banner */}
          <div className="flex items-center justify-between rounded-xl bg-teal-50/80 border border-teal-200/80 px-4 py-3">
            <div>
              <span className="text-xs font-medium text-teal-800">Net Payable Amount</span>
              {discountAmount > 0 && paymentStatus !== "FREE" && (
                <span className="block text-[11px] text-teal-600">
                  (After discount of {formatCurrency(discountAmount)})
                </span>
              )}
            </div>
            <span className="text-lg font-bold text-teal-900 font-mono">
              {formatCurrency(netBill)}
            </span>
          </div>

          {/* Payment Status Selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Payment Status
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                {
                  id: "PAID" as const,
                  label: "Paid",
                  activeClass: "bg-emerald-600 text-white border-emerald-600 shadow-xs",
                  idleClass: "bg-emerald-50/60 text-emerald-800 border-emerald-200 hover:bg-emerald-100/60",
                },
                {
                  id: "PARTIAL" as const,
                  label: "Partial",
                  activeClass: "bg-amber-600 text-white border-amber-600 shadow-xs",
                  idleClass: "bg-amber-50/60 text-amber-800 border-amber-200 hover:bg-amber-100/60",
                },
                {
                  id: "UNPAID" as const,
                  label: "Unpaid",
                  activeClass: "bg-rose-600 text-white border-rose-600 shadow-xs",
                  idleClass: "bg-rose-50/60 text-rose-800 border-rose-200 hover:bg-rose-100/60",
                },
                {
                  id: "FREE" as const,
                  label: "Free",
                  activeClass: "bg-purple-600 text-white border-purple-600 shadow-xs",
                  idleClass: "bg-purple-50/60 text-purple-800 border-purple-200 hover:bg-purple-100/60",
                },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelectStatus(opt.id)}
                  className={`rounded-lg border px-3 py-2 text-center text-xs font-bold transition-all cursor-pointer ${
                    paymentStatus === opt.id ? opt.activeClass : opt.idleClass
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Amount Collected Input (especially when PARTIAL or customized) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Amount Collected (₹)
              </label>
              {(paymentStatus === "PARTIAL" || paymentStatus === "UNPAID") && balanceDue > 0 && (
                <span className="text-xs font-semibold text-rose-600">
                  Balance Due: {formatCurrency(balanceDue)}
                </span>
              )}
            </div>

            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                ₹
              </span>
              <input
                type="number"
                min="0"
                max={netBill > 0 ? netBill : undefined}
                step="any"
                value={pickedStatus === "PARTIAL" ? partialText : String(amountPaid)}
                onChange={(e) => handleAmountPaidChange(e.target.value)}
                disabled={paymentStatus === "FREE"}
                className={`input pl-8 font-mono font-bold text-slate-800 ${
                  paymentStatus === "FREE" ? "bg-slate-100 text-slate-400 cursor-not-allowed" : ""
                }`}
              />
            </div>

            {paymentStatus !== "FREE" && netBill > 0 && (
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setPickedStatus("PAID")}
                  className="rounded bg-slate-100 hover:bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors cursor-pointer"
                >
                  Full ({formatCurrency(netBill)})
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectStatus("PARTIAL")}
                  className="rounded bg-slate-100 hover:bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors cursor-pointer"
                >
                  Half ({formatCurrency(round2(netBill / 2))})
                </button>
                <button
                  type="button"
                  onClick={() => setPickedStatus("UNPAID")}
                  className="rounded bg-slate-100 hover:bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors cursor-pointer"
                >
                  Zero (₹0)
                </button>
              </div>
            )}
          </div>

          {/* Dialog Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="btn btn-secondary text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs inline-flex items-center gap-1.5"
            >
              {saving ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>Save Payment</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
