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
      )
    `)
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);
  return mapPatientWithReports(data);
}

export async function createPatient(input: CreatePatientInput) {
  const { data: patientCode, error: codeError } = await supabase.rpc("next_patient_code");
  if (codeError) throw new Error(codeError.message);

  const payload: Record<string, any> = {
    patientCode,
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
    .insert(payload)
    .select("*")
    .single();

  if (error && (error.message?.includes("ageMonths") || error.details?.includes("ageMonths"))) {
    delete payload.ageMonths;
    const retry = await supabase.from("patients").insert(payload).select("*").single();
    data = retry.data;
    error = retry.error;
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
