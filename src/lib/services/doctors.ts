import { supabase } from "@/lib/supabase";
import type { Doctor, ReportIncentive } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// EXACT column names from the database:
//
// doctors table:
//   id, name, qualification, phone, email, specialization,
//   "incentiveRate"  ← quoted camelCase
//   isactive         ← lowercase, no quotes
//   "createdAt"      ← quoted camelCase
//   "updatedAt"      ← quoted camelCase
//
// report_incentives table:
//   id
//   "reportId"       ← quoted camelCase
//   "doctorId"       ← quoted camelCase
//   billamount       ← lowercase, no quotes
//   "incentiveRate"  ← quoted camelCase
//   incentiveamount  ← lowercase, no quotes (generated column)
//   ispaid           ← lowercase, no quotes
//   paidat           ← lowercase, no quotes
//   "createdAt"      ← quoted camelCase
// ─────────────────────────────────────────────────────────────────────────────

function mapDoctor(row: any): Doctor {
  return {
    id: row.id,
    name: row.name,
    qualification: row.qualification ?? null,
    phone: row.phone ?? null,
    email: row.email ?? null,
    specialization: row.specialization ?? null,
    incentiveRate: Number(row["incentiveRate"] ?? 50),
    isActive: row.isactive ?? true,
    createdAt: row["createdAt"],
    updatedAt: row["updatedAt"],
  };
}

function mapIncentive(row: any): ReportIncentive {
  return {
    id: row.id,
    reportId: row["reportId"],
    doctorId: row["doctorId"],
    billAmount: Number(row.billamount ?? 0),
    incentiveRate: Number(row["incentiveRate"] ?? 50),
    incentiveAmount: Number(row.incentiveamount ?? 0),
    isPaid: row.ispaid ?? false,
    paidAt: row.paidat ?? null,
    createdAt: row["createdAt"],
    doctor: {
      name: row.doctor?.name ?? "",
      qualification: row.doctor?.qualification ?? null,
    },
    report: {
      reportNumber: row.report?.reportNumber ?? "",
      collectedAt: row.report?.collectedAt ?? "",
      patient: { name: row.report?.patient?.name ?? "" },
    },
  };
}

// ── DOCTORS CRUD ──────────────────────────────────────────────────────────────

export async function listDoctors(activeOnly = false) {
  let query = supabase.from("doctors").select("*").order("name");
  if (activeOnly) query = query.eq("isactive", true);   // ← lowercase
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapDoctor);
}

export async function getDoctor(id: string) {
  const { data, error } = await supabase.from("doctors").select("*").eq("id", id).single();
  if (error) throw new Error(error.message);
  return mapDoctor(data);
}

export async function createDoctor(input: {
  name: string;
  qualification?: string;
  phone?: string;
  email?: string;
  specialization?: string;
  incentiveRate?: number;
}) {
  const { data, error } = await supabase
    .from("doctors")
    .insert({
      name: input.name.trim(),
      qualification: input.qualification?.trim() || null,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      specialization: input.specialization?.trim() || null,
      "incentiveRate": input.incentiveRate ?? 50,   // ← quoted, camelCase in DB
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapDoctor(data);
}

export async function updateDoctor(
  id: string,
  input: {
    name: string;
    qualification?: string;
    phone?: string;
    email?: string;
    specialization?: string;
    incentiveRate?: number;
    isActive?: boolean;
  },
) {
  const { data, error } = await supabase
    .from("doctors")
    .update({
      name: input.name.trim(),
      qualification: input.qualification?.trim() || null,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      specialization: input.specialization?.trim() || null,
      "incentiveRate": input.incentiveRate ?? 50,   // ← quoted camelCase
      isactive: input.isActive ?? true,              // ← lowercase
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapDoctor(data);
}

export async function deleteDoctor(id: string) {
  const { error } = await supabase.from("doctors").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ── INCENTIVES ────────────────────────────────────────────────────────────────

// Note: all join hints use the FK constraint names from the DB
const INCENTIVE_SELECT = `
  *,
  doctor:doctors!report_incentives_doctorId_fkey (name, qualification),
  report:reports!report_incentives_reportId_fkey (
    reportNumber,
    collectedAt,
    patient:patients!reports_patientId_fkey (name)
  )
`;

export async function createOrUpdateIncentive(input: {
  reportId: string;
  doctorId: string;
  billAmount: number;
  incentiveRate: number;
}) {
  // Check-then-insert/update avoids any onConflict string resolution issues
  const { data: existing } = await supabase
    .from("report_incentives")
    .select("id")
    .eq("reportId", input.reportId)
    .maybeSingle();

  if (existing?.id) {
    const { data, error } = await supabase
      .from("report_incentives")
      .update({
        "doctorId": input.doctorId,
        billamount: input.billAmount,       // ← lowercase
        "incentiveRate": input.incentiveRate,
      })
      .eq("id", existing.id)
      .select(INCENTIVE_SELECT)
      .single();
    if (error) throw new Error(error.message);
    return mapIncentive(data);
  } else {
    const { data, error } = await supabase
      .from("report_incentives")
      .insert({
        "reportId": input.reportId,         // ← quoted camelCase
        "doctorId": input.doctorId,         // ← quoted camelCase
        billamount: input.billAmount,       // ← lowercase
        "incentiveRate": input.incentiveRate,
        ispaid: false,                      // ← lowercase
      })
      .select(INCENTIVE_SELECT)
      .single();
    if (error) throw new Error(error.message);
    return mapIncentive(data);
  }
}

export async function listIncentives(params: {
  doctorId?: string;
  isPaid?: boolean;
  from?: string;
  to?: string;
}) {
  let query = supabase
    .from("report_incentives")
    .select(INCENTIVE_SELECT)
    .order("createdAt", { ascending: false });

  if (params.doctorId !== undefined) query = query.eq("doctorId", params.doctorId);
  if (params.isPaid !== undefined)   query = query.eq("ispaid", params.isPaid);   // ← lowercase in DB
  if (params.from !== undefined)     query = query.gte("createdAt", params.from);
  if (params.to !== undefined)       query = query.lte("createdAt", params.to);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapIncentive);
}

export async function markIncentivePaid(id: string, paid: boolean) {
  const { data, error } = await supabase
    .from("report_incentives")
    .update({
      ispaid: paid,                                           // ← lowercase
      paidat: paid ? new Date().toISOString() : null,        // ← lowercase
    })
    .eq("id", id)
    .select(INCENTIVE_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return mapIncentive(data);
}

export async function getIncentiveSummaryByDoctor() {
  const { data, error } = await supabase
    .from("report_incentives")
    .select(`*, doctor:doctors!report_incentives_doctorId_fkey (id, name)`);
  if (error) throw new Error(error.message);

  const map = new Map<
    string,
    { doctorId: string; doctorName: string; total: number; paid: number; pending: number; count: number }
  >();

  for (const row of data ?? []) {
    const key: string = row["doctorId"];
    const amount = Number(row.incentiveamount ?? 0);   // ← lowercase generated column
    if (!map.has(key)) {
      map.set(key, {
        doctorId: key,
        doctorName: row.doctor?.name ?? "",
        total: 0, paid: 0, pending: 0, count: 0,
      });
    }
    const entry = map.get(key)!;
    entry.total += amount;
    entry.count += 1;
    if (row.ispaid) entry.paid += amount;    // ← lowercase
    else entry.pending += amount;
  }

  return [...map.values()].sort((a, b) => b.pending - a.pending);
}