import { supabase } from "@/lib/supabase";
import { mapReport, requireUserId } from "@/lib/services/helpers";
import { createOrUpdateIncentive } from "@/lib/services/doctors";
import { isValueAbnormalGender } from "@/lib/utils";
import type { CreateReportInput, TemplateField } from "@/types";

const REPORT_SELECT = `
  *,
  patient:patients!reports_patientId_fkey (
    id, patientCode, name, age, ageMonths, gender, phone, refDoctor, doctorId,
    email, address, bloodGroup,
    doctor:doctors!patients_doctorId_fkey (
      name, qualification, specialization
    )
  ),
  template:test_templates!reports_templateId_fkey (id, name, category, price),
  createdBy:profiles!reports_createdById_fkey (name),
  values:report_values (
    id,
    fieldId,
    value,
    isAbnormal,
    field:template_fields!report_values_fieldId_fkey (
      fieldName, unit, fieldType,
      normalRangeText, normalRangeTextMale, normalRangeTextFemale,
      normalRangeMin, normalRangeMax,
      normalRangeMinMale, normalRangeMaxMale,
      normalRangeMinFemale, normalRangeMaxFemale,
      section, sortOrder, isBold
    )
  )
`;

export async function listReports(params: {
  page: number;
  limit: number;
  search?: string;
  status?: string;
}) {
  const { page, limit, search = "", status = "ALL" } = params;

  const { data, error } = await supabase
    .from("reports")
    .select(REPORT_SELECT)
    .order("createdAt", { ascending: false });

  if (error) throw new Error(error.message);

  let reports = (data ?? []).map(mapReport);

  if (status !== "ALL") {
    reports = reports.filter((r) => r.status === status);
  }

  const term = search.trim().toLowerCase();
  if (term) {
    reports = reports.filter((r) =>
      [r.reportNumber, r.patient.name, r.patient.patientCode, r.template.name]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }

  const total = reports.length;
  const from = (page - 1) * limit;

  return {
    reports: reports.slice(from, from + limit),
    total,
  };
}

export async function getRecentReports(limit = 5) {
  const { data, error } = await supabase
    .from("reports")
    .select(REPORT_SELECT)
    .eq("status", "FINAL")
    .order("createdAt", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  return (data ?? []).map(mapReport);
}

export async function getReport(id: string) {
  const { data, error } = await supabase
    .from("reports")
    .select(REPORT_SELECT)
    .eq("id", id)
    .single();

  if (error || !data) {
    throw new Error("Report not found");
  }

  return mapReport(data);
}

async function tryCreateIncentive(
  reportId: string,
  patientId: string,
  templateId: string,
  effectiveBillAmount?: number | null,
) {
  try {
    const { data: patientRow } = await supabase
      .from("patients")
      .select("doctorId")
      .eq("id", patientId)
      .single();

    const doctorId = patientRow?.doctorId;

    if (!doctorId) {
      console.warn("No doctor linked to patient:", patientId);
      return;
    }

    const { data: doc } = await supabase
      .from("doctors")
      .select("incentiveRate")
      .eq("id", doctorId)
      .single();

    let price = effectiveBillAmount;
    if (price == null) {
      const { data: tmpl } = await supabase
        .from("test_templates")
        .select("price")
        .eq("id", templateId)
        .single();
      price = Number(tmpl?.price ?? 0);
    }

    const rate = Number(doc?.incentiveRate ?? 50);

    if (price >= 0) {
      await createOrUpdateIncentive({
        reportId,
        doctorId,
        billAmount: price,
        incentiveRate: rate,
      });
    }
  } catch (err) {
    console.error("Incentive creation failed:", err);
  }
}

export async function createReport(input: CreateReportInput) {
  const userId = await requireUserId();

  const { data: templateFields, error: fieldsError } = await supabase
    .from("template_fields")
    .select("*")
    .eq("templateId", input.templateId)
    .order("sortOrder");

  if (fieldsError) throw new Error(fieldsError.message);

  const { data: patientRow } = await supabase
    .from("patients")
    .select("gender")
    .eq("id", input.patientId)
    .single();

  const gender: string = patientRow?.gender ?? "OTHER";

  const { data: rn, error: rnError } = await supabase.rpc("next_report_number");
  if (rnError) throw new Error(rnError.message);

  const isFinal = (input.status ?? "FINAL") !== "DRAFT";

  // Calculate net bill amount after discount
  let netBillAmount: number | null = null;
  if (input.billAmount != null) {
    const discountAmt = input.discountType === "PERCENT"
      ? (Number(input.billAmount) * Number(input.discount ?? 0)) / 100
      : Number(input.discount ?? 0);
    netBillAmount = Math.max(0, Number(input.billAmount) - discountAmt);
  }

  const payload: Record<string, any> = {
    reportNumber: rn,
    patientId: input.patientId,
    templateId: input.templateId,
    createdById: userId,
    status: input.status ?? "FINAL",
    collectedAt: input.collectedAt
      ? new Date(input.collectedAt).toISOString()
      : new Date().toISOString(),
    reportedAt: isFinal ? new Date().toISOString() : null,
    notes: input.notes?.trim() || null,
    billAmount: input.billAmount != null ? Number(input.billAmount) : null,
    discountType: input.discountType ?? "FLAT",
    discount: input.discount != null ? Number(input.discount) : 0,
    amountPaid: input.amountPaid != null
      ? Number(input.amountPaid)
      : (input.paymentStatus === "PAID" ? netBillAmount : 0),
    paymentStatus: input.paymentStatus ?? "UNPAID",
  };

  let { data: report, error } = await supabase
    .from("reports")
    .insert(payload)
    .select("id")
    .single();

  if (error && (error.message?.includes("billAmount") || error.details?.includes("billAmount"))) {
    // Retry without billing columns in case schema hasn't reloaded yet
    delete payload.billAmount;
    delete payload.discountType;
    delete payload.discount;
    delete payload.amountPaid;
    delete payload.paymentStatus;
    const retry = await supabase.from("reports").insert(payload).select("id").single();
    report = retry.data;
    error = retry.error;
  }

  if (error || !report) throw new Error(error?.message || "Failed to create report");

  const fieldMap = new Map((templateFields ?? []).map((f: any) => [f.id, f]));

  const { error: valuesError } = await supabase.from("report_values").insert(
    input.values.map((v) => {
      const field = fieldMap.get(v.fieldId) as TemplateField | undefined;

      return {
        reportId: report.id,
        fieldId: v.fieldId,
        value: String(v.value),
        isAbnormal: field
          ? isValueAbnormalGender(v.value, field, gender)
          : false,
      };
    }),
  );

  if (valuesError) throw new Error(valuesError.message);

  if (isFinal) {
    await tryCreateIncentive(report.id, input.patientId, input.templateId, netBillAmount);
  }

  return getReport(report.id);
}

export async function updateReport(
  id: string,
  input: {
    status: "DRAFT" | "FINAL";
    collectedAt: string;
    notes?: string;
    billAmount?: number;
    discountType?: "FLAT" | "PERCENT";
    discount?: number;
    amountPaid?: number;
    paymentStatus?: "PAID" | "PARTIAL" | "UNPAID" | "FREE";
    values: Array<{ fieldId: string; value: string }>;
  },
) {
  const { data: reportRow, error: reportFetchError } = await supabase
    .from("reports")
    .select("patientId, templateId")
    .eq("id", id)
    .single();

  if (reportFetchError || !reportRow) {
    throw new Error("Report not found");
  }

  const { data: patientRow } = await supabase
    .from("patients")
    .select("gender")
    .eq("id", reportRow.patientId)
    .single();

  const { data: templateFields } = await supabase
    .from("template_fields")
    .select("*")
    .eq("templateId", reportRow.templateId);

  const gender: string = patientRow?.gender ?? "OTHER";
  const isFinal = input.status !== "DRAFT";

  // Calculate net bill amount after discount
  let netBillAmount: number | null = null;
  if (input.billAmount != null) {
    const discountAmt = input.discountType === "PERCENT"
      ? (Number(input.billAmount) * Number(input.discount ?? 0)) / 100
      : Number(input.discount ?? 0);
    netBillAmount = Math.max(0, Number(input.billAmount) - discountAmt);
  }

  const updatePayload: Record<string, any> = {
    status: input.status,
    collectedAt: new Date(input.collectedAt).toISOString(),
    reportedAt: isFinal ? new Date().toISOString() : null,
    notes: input.notes?.trim() || null,
  };

  if (input.billAmount !== undefined) {
    updatePayload.billAmount = input.billAmount != null ? Number(input.billAmount) : null;
    updatePayload.discountType = input.discountType ?? "FLAT";
    updatePayload.discount = input.discount != null ? Number(input.discount) : 0;
    updatePayload.amountPaid = input.amountPaid != null
      ? Number(input.amountPaid)
      : (input.paymentStatus === "PAID" ? netBillAmount : 0);
    updatePayload.paymentStatus = input.paymentStatus ?? "PAID";
  }

  let { error: reportError } = await supabase
    .from("reports")
    .update(updatePayload)
    .eq("id", id);

  if (reportError && (reportError.message?.includes("billAmount") || reportError.details?.includes("billAmount"))) {
    // Retry without billing columns in case schema hasn't reloaded yet
    delete updatePayload.billAmount;
    delete updatePayload.discountType;
    delete updatePayload.discount;
    delete updatePayload.amountPaid;
    delete updatePayload.paymentStatus;
    const retry = await supabase.from("reports").update(updatePayload).eq("id", id);
    reportError = retry.error;
  }

  if (reportError) throw new Error(reportError.message);

  const { error: deleteError } = await supabase
    .from("report_values")
    .delete()
    .eq("reportId", id);

  if (deleteError) throw new Error(deleteError.message);

  const fieldMap = new Map((templateFields ?? []).map((f: any) => [f.id, f]));

  const { error: insertError } = await supabase.from("report_values").insert(
    input.values.map((v) => {
      const field = fieldMap.get(v.fieldId) as TemplateField | undefined;

      return {
        reportId: id,
        fieldId: v.fieldId,
        value: String(v.value),
        isAbnormal: field
          ? isValueAbnormalGender(v.value, field, gender)
          : false,
      };
    }),
  );

  if (insertError) throw new Error(insertError.message);

  if (isFinal) {
    await tryCreateIncentive(id, reportRow.patientId, reportRow.templateId, netBillAmount);
  }

  return getReport(id);
}

export async function deleteReport(id: string) {
  const { error } = await supabase.from("reports").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function updateReportPayment(
  reportId: string,
  params: {
    paymentStatus: "PAID" | "PARTIAL" | "UNPAID" | "FREE";
    amountPaid: number;
    discount?: number;
    discountType?: "FLAT" | "PERCENT";
    billAmount?: number;
  },
) {
  const updatePayload: Record<string, any> = {
    paymentStatus: params.paymentStatus,
    amountPaid: Number(params.amountPaid),
  };
  if (params.discount !== undefined) {
    updatePayload.discount = Number(params.discount);
  }
  if (params.discountType !== undefined) {
    updatePayload.discountType = params.discountType;
  }
  if (params.billAmount !== undefined) {
    updatePayload.billAmount = Number(params.billAmount);
  }

  const { data: report, error } = await supabase
    .from("reports")
    .update(updatePayload)
    .eq("id", reportId)
    .select(REPORT_SELECT)
    .single();

  if (error || !report) throw new Error(error?.message || "Failed to update payment");

  // Re-sync doctor referral incentive on the updated net bill amount
  try {
    const basePrice = report.billAmount != null ? Number(report.billAmount) : Number(report.template?.price ?? 0);
    const disc = report.discount != null ? Number(report.discount) : 0;
    const isPercent = report.discountType === "PERCENT";
    const discountAmt = isPercent ? (basePrice * disc) / 100 : disc;
    const netBill = params.paymentStatus === "FREE" ? 0 : Math.max(0, basePrice - discountAmt);

    await tryCreateIncentive(reportId, report.patientId, report.templateId, netBill);
  } catch (incError) {
    console.error("Failed to re-sync doctor incentive after payment update:", incError);
  }

  return mapReport(report);
}