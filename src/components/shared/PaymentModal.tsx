import { useEffect, useState } from "react";
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

export default function PaymentModal({
  isOpen,
  onClose,
  report,
  onSuccess,
}: PaymentModalProps) {
  if (!isOpen || !report) return null;

  const basePrice = report.billAmount ?? report.template.price ?? 0;

  const [discountType, setDiscountType] = useState<"FLAT" | "PERCENT">(
    report.discountType || "FLAT",
  );
  const [discount, setDiscount] = useState<number>(report.discount || 0);
  const [paymentStatus, setPaymentStatus] = useState<"PAID" | "PARTIAL" | "UNPAID" | "FREE">(
    report.paymentStatus || "UNPAID",
  );
  const [amountPaid, setAmountPaid] = useState<number>(
    report.amountPaid != null ? report.amountPaid : 0,
  );
  const [saving, setSaving] = useState(false);

  // Initialize/reset form whenever report changes
  useEffect(() => {
    if (report) {
      const bPrice = report.billAmount ?? report.template.price ?? 0;
      const dType = report.discountType || "FLAT";
      const dVal = report.discount || 0;
      setDiscountType(dType);
      setDiscount(dVal);

      const dAmt = dType === "PERCENT" ? (bPrice * dVal) / 100 : dVal;
      const net = Math.max(0, bPrice - dAmt);

      const pStatus = report.paymentStatus || "UNPAID";
      setPaymentStatus(pStatus);

      if (pStatus === "PAID") {
        setAmountPaid(net);
      } else if (pStatus === "FREE" || pStatus === "UNPAID") {
        setAmountPaid(0);
      } else {
        setAmountPaid(report.amountPaid != null ? report.amountPaid : 0);
      }
    }
  }, [report]);

  // Derived calculations
  const discountAmount =
    discountType === "PERCENT"
      ? (basePrice * Math.max(0, discount)) / 100
      : Math.max(0, discount);

  const netBill =
    paymentStatus === "FREE"
      ? 0
      : Math.max(0, basePrice - discountAmount);

  const balanceDue = Math.max(0, netBill - Math.max(0, amountPaid));

  // Handler when clicking status buttons
  const handleSelectStatus = (status: "PAID" | "PARTIAL" | "UNPAID" | "FREE") => {
    setPaymentStatus(status);
    if (status === "PAID") {
      setAmountPaid(netBill);
    } else if (status === "UNPAID") {
      setAmountPaid(0);
    } else if (status === "FREE") {
      setAmountPaid(0);
    } else if (status === "PARTIAL") {
      if (amountPaid <= 0 || amountPaid >= netBill) {
        setAmountPaid(Math.round(netBill / 2));
      }
    }
  };

  // Handler for amount paid change
  const handleAmountPaidChange = (val: number) => {
    const clamped = Math.max(0, val);
    setAmountPaid(clamped);

    if (paymentStatus === "FREE") {
      return;
    }

    if (clamped >= netBill && netBill > 0) {
      setPaymentStatus("PAID");
    } else if (clamped > 0 && clamped < netBill) {
      setPaymentStatus("PARTIAL");
    } else if (clamped === 0) {
      setPaymentStatus("UNPAID");
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    let finalPaid = amountPaid;
    if (paymentStatus === "PAID") {
      finalPaid = netBill;
    } else if (paymentStatus === "UNPAID" || paymentStatus === "FREE") {
      finalPaid = 0;
    }

    const billingError = validateBilling({
      billAmount: basePrice,
      discountType,
      discount,
      paymentStatus,
      amountPaid: finalPaid,
    });
    if (billingError) {
      toast.error(billingError);
      return;
    }

    setSaving(true);
    try {

      const updated = await updateReportPayment(report.id, {
        paymentStatus,
        amountPaid: finalPaid,
        discount,
        discountType,
        billAmount: basePrice,
      });

      toast.success(
        `Payment updated: ${paymentStatus} (${formatCurrency(finalPaid)})`,
      );
      onSuccess(updated);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : "Failed to update payment",
      );
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
                  onClick={() => setDiscountType("FLAT")}
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
                  onClick={() => setDiscountType("PERCENT")}
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
                  onChange={(e) => setDiscount(Number(e.target.value) || 0)}
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
                    if (preset.val === 100) {
                      setPaymentStatus("FREE");
                      setAmountPaid(0);
                    }
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
              {paymentStatus === "PARTIAL" && (
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
                value={amountPaid === 0 ? "0" : amountPaid}
                onChange={(e) => handleAmountPaidChange(Number(e.target.value) || 0)}
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
                  onClick={() => handleAmountPaidChange(netBill)}
                  className="rounded bg-slate-100 hover:bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors cursor-pointer"
                >
                  Full ({formatCurrency(netBill)})
                </button>
                <button
                  type="button"
                  onClick={() => handleAmountPaidChange(Math.round(netBill / 2))}
                  className="rounded bg-slate-100 hover:bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors cursor-pointer"
                >
                  50% ({formatCurrency(Math.round(netBill / 2))})
                </button>
                <button
                  type="button"
                  onClick={() => handleAmountPaidChange(0)}
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
