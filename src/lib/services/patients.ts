import { supabase } from "@/lib/supabase";
import { mapPatient, mapPatientWithReports } from "@/lib/services/helpers";
import type { CreatePatientInput } from "@/types";

export async function listPatients(params: { page: number; limit: number; search?: string }) {
  const { page, limit, search = "" } = params;
  let query = supabase
    .from("patients")
    .select("*", { count: "exact" })
    .order("createdAt", { ascending: false });

  if (search.trim()) {
    const term = search.trim();
    query = query.or(
      `name.ilike.%${term}%,phone.ilike.%${term}%,patientCode.ilike.%${term}%,refDoctor.ilike.%${term}%`,
    );
  }

  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const { data, count, error } = await query.range(from, to);
  if (error) throw new Error(error.message);

  return { patients: (data ?? []).map(mapPatient), total: count ?? 0 };
}

/** Just the patient row (no reports), e.g. to preselect a patient when starting a report. */
export async function getPatientBasic(id: string) {
  const { data, error } = await supabase.from("patients").select("*").eq("id", id).single();
  if (error) throw new Error(error.message);
  return mapPatient(data);
}

/**
 * Patient plus a light list of their reports. Result values are reduced to their isAbnormal flag
 * (enough for the abnormal badge); fetch the full report with getReport when values are needed.
 */
export async function getPatient(id: string) {
  const { data, error } = await supabase
    .from("patients")
    .select(`
      *,
      doctor:doctors!patients_doctorId_fkey (
        name, qualification, specialization
      ),
      reports (
        id,
        reportNumber,
        patientId,
        templateId,
        createdById,
        status,
        collectedAt,
        reportedAt,
        notes,
        pdfUrl,
        billAmount,
        discountType,
        discount,
        amountPaid,
        paymentStatus,
        createdAt,
        updatedAt,
        template:test_templates!reports_templateId_fkey (id, name, category, price),
        createdBy:profiles!reports_createdById_fkey (name),
        values:report_values (isAbnormal)
      )
    `)
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);
  return mapPatientWithReports(data);
}

export async function createPatient(input: CreatePatientInput) {
  const payload: Record<string, any> = {
    patientCode: "",
    name: input.name.trim(),
    age: Number(input.age),
    ageMonths: input.ageMonths != null ? Math.max(0, Math.min(11, Number(input.ageMonths))) : 0,
    gender: input.gender,
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    address: input.address?.trim() || null,
    refDoctor: input.refDoctor?.trim() || null,
    doctorId: input.doctorId || null,
    bloodGroup: input.bloodGroup || null,
  };

  // The code is issued by a separate call, so two staff registering at the same moment can be handed the
  // same code. The unique constraint rejects the second insert (23505); fetch a fresh code and try again.
  let data: any = null;
  let error: { message?: string; details?: string; code?: string } | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data: patientCode, error: codeError } = await supabase.rpc("next_patient_code");
    if (codeError) throw new Error(codeError.message);
    payload.patientCode = patientCode;

    let res = await supabase.from("patients").insert(payload).select("*").single();

    if (res.error && (res.error.message?.includes("ageMonths") || res.error.details?.includes("ageMonths"))) {
      delete payload.ageMonths;
      res = await supabase.from("patients").insert(payload).select("*").single();
    }

    data = res.data;
    error = res.error;
    if (!error || error.code !== "23505") break;
  }

  if (error) throw new Error(error.message);
  return mapPatient(data);
}

export async function updatePatient(id: string, input: CreatePatientInput) {
  const payload: Record<string, any> = {
    name: input.name.trim(),
    age: Number(input.age),
    ageMonths: input.ageMonths != null ? Math.max(0, Math.min(11, Number(input.ageMonths))) : 0,
    gender: input.gender,
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    address: input.address?.trim() || null,
    refDoctor: input.refDoctor?.trim() || null,
    doctorId: input.doctorId || null,
    bloodGroup: input.bloodGroup || null,
  };

  let { data, error } = await supabase
    .from("patients")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error && (error.message?.includes("ageMonths") || error.details?.includes("ageMonths"))) {
    delete payload.ageMonths;
    const retry = await supabase.from("patients").update(payload).eq("id", id).select("*").single();
    data = retry.data;
    error = retry.error;
  }

  if (error) throw new Error(error.message);
  return mapPatient(data);
}

export async function deletePatient(id: string) {
  const { error } = await supabase.from("patients").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
