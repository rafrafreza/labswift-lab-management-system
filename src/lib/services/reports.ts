import { supabase } from "@/lib/supabase";
import { mapReport, requireUserId } from "@/lib/services/helpers";
import { createOrUpdateIncentive } from "@/lib/services/doctors";
import { isValueAbnormalGender } from "@/lib/utils";
import { searchTerm } from "@/lib/validation";
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

// Light select for the list screen: no result values or field definitions (those are only needed on detail pages)
const REPORT_LIST_SELECT = `
  id, reportNumber, patientId, templateId, createdById, status, collectedAt, reportedAt, notes, pdfUrl,
  billAmount, discountType, discount, amountPaid, paymentStatus, createdAt, updatedAt,
  patient:patients!reports_patientId_fkey (
    id, patientCode, name, age, ageMonths, gender, phone, refDoctor, doctorId, email, address, bloodGroup
  ),
  template:test_templates!reports_templateId_fkey (id, name, category, price),
  createdBy:profiles!reports_createdById_fkey (name)
`;

// Cap on patient ids sent in a search filter; keeps the request URL a safe length
const SEARCH_MATCH_CAP = 100;

export async function listReports(params: {
  page: number;
  limit: number;
  search?: string;
  status?: string;
}) {
  const { page, limit, search = "", status = "ALL" } = params;

  let query = supabase
    .from("reports")
    .select(REPORT_LIST_SELECT, { count: "exact" })
    .order("createdAt", { ascending: false });

  if (status !== "ALL") {
    query = query.eq("status", status);
  }

  // Strip characters that have meaning in PostgREST filter strings
  const term = searchTerm(search);
  if (term) {
    const [patientRes, templateRes] = await Promise.all([
      supabase
        .from("patients")
        .select("id")
        .or(`name.ilike.%${term}%,patientCode.ilike.%${term}%`)
        .limit(SEARCH_MATCH_CAP),
      supabase.from("test_templates").select("id").ilike("name", `%${term}%`).limit(SEARCH_MATCH_CAP),
    ]);
    if (patientRes.error) throw new Error(patientRes.error.message);
    if (templateRes.error) throw new Error(templateRes.error.message);

    const conditions = [`reportNumber.ilike.%${term}%`];
    const patientIds = (patientRes.data ?? []).map((p) => p.id);
    const templateIds = (templateRes.data ?? []).map((t) => t.id);
    if (patientIds.length) conditions.push(`patientId.in.(${patientIds.join(",")})`);
    if (templateIds.length) conditions.push(`templateId.in.(${templateIds.join(",")})`);
    query = query.or(conditions.join(","));
  }

  const from = (page - 1) * limit;
  const { data, count, error } = await query.range(from, from + limit - 1);
  if (error) throw new Error(error.message);

  return {
    reports: (data ?? []).map(mapReport),
    total: count ?? 0,
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

/** Value rows for the save functions: abnormal flags are worked out here, with the patient's gender. */
function valueRows(
  values: Array<{ fieldId: string; value: string }>,
  templateFields: TemplateField[] | null,
  gender: string,
) {
  const fieldMap = new Map((templateFields ?? []).map((f) => [f.id, f]));
  return values.map((v) => {
    const field = fieldMap.get(v.fieldId);
    return {
      fieldId: v.fieldId,
      value: String(v.value),
      isAbnormal: field ? isValueAbnormalGender(v.value, field, gender) : false,
    };
  });
}

function netBillOf(billAmount?: number | null, discountType?: string, discount?: number | null): number | null {
  if (billAmount == null) return null;
  const discountAmt =
    discountType === "PERCENT" ? (Number(billAmount) * Number(discount ?? 0)) / 100 : Number(discount ?? 0);
  return Math.max(0, Number(billAmount) - discountAmt);
}

// The report row and its values are saved by ONE database function (21.sql) = one transaction, so a failure can never
// leave an empty report behind or wipe an edited report's results.
export async function createReport(input: CreateReportInput) {
  await requireUserId();

  const { data: templateFields, error: fieldsError } = await supabase
    .from("template_fields")
    .select("*")
    .eq("templateId", input.templateId)
    .order("sortOrder");
  if (fieldsError) throw new Error(fieldsError.message);

  const { data: patientRow } = await supabase.from("patients").select("gender").eq("id", input.patientId).single();
  const gender: string = patientRow?.gender ?? "OTHER";

  const status = input.status ?? "FINAL";
  const isFinal = status !== "DRAFT";
  const netBillAmount = netBillOf(input.billAmount, input.discountType, input.discount);

  const { data: reportId, error } = await supabase.rpc("create_report_atomic", {
    p_report: {
      patientId: input.patientId,
      templateId: input.templateId,
      status,
      collectedAt: input.collectedAt ? new Date(input.collectedAt).toISOString() : new Date().toISOString(),
      notes: input.notes?.trim() || null,
      billAmount: input.billAmount != null ? Number(input.billAmount) : null,
      discountType: input.discountType ?? "FLAT",
      discount: input.discount != null ? Number(input.discount) : 0,
      amountPaid:
        input.amountPaid != null ? Number(input.amountPaid) : input.paymentStatus === "PAID" ? netBillAmount : 0,
      paymentStatus: input.paymentStatus ?? "UNPAID",
    },
    p_values: valueRows(input.values, templateFields as TemplateField[] | null, gender),
  });
  if (error || !reportId) throw new Error(error?.message || "Failed to create report");

  if (isFinal) {
    await tryCreateIncentive(reportId, input.patientId, input.templateId, netBillAmount);
  }

  return getReport(reportId);
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

  const { data: patientRow } = await supabase.from("patients").select("gender").eq("id", reportRow.patientId).single();
  const { data: templateFields } = await supabase.from("template_fields").select("*").eq("templateId", reportRow.templateId);

  const gender: string = patientRow?.gender ?? "OTHER";
  const isFinal = input.status !== "DRAFT";
  const netBillAmount = netBillOf(input.billAmount, input.discountType, input.discount);

  const payload: Record<string, unknown> = {
    status: input.status,
    collectedAt: new Date(input.collectedAt).toISOString(),
    notes: input.notes?.trim() || null,
  };
  if (input.billAmount !== undefined) {
    // (the function only touches the billing columns when "billAmount" is present)
    payload.billAmount = input.billAmount != null ? Number(input.billAmount) : null;
    payload.discountType = input.discountType ?? "FLAT";
    payload.discount = input.discount != null ? Number(input.discount) : 0;
    payload.amountPaid =
      input.amountPaid != null ? Number(input.amountPaid) : input.paymentStatus === "PAID" ? netBillAmount : 0;
    payload.paymentStatus = input.paymentStatus ?? "PAID";
  }

  const { error } = await supabase.rpc("update_report_atomic", {
    p_report_id: id,
    p_report: payload,
    p_values: valueRows(input.values, templateFields as TemplateField[] | null, gender),
  });
  if (error) throw new Error(error.message);

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