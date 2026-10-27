import { supabase } from "@/lib/supabase";
import type {
  DashboardStats,
  LabSettings,
  Patient,
  PatientWithReports,
  Profile,
  ReportWithRelations,
  TemplateField,
  TemplateWithFields,
} from "@/types";

export function getErrorMessage(error: unknown, fallback = "Something went wrong.") {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export async function requireUserId() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("You must be signed in to continue.");
  return user.id;
}

export function mapProfile(row: any): Profile {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapPatient(row: any): Patient {
  return {
    id: row.id,
    patientCode: row.patientCode,
    name: row.name,
    age: row.age,
    ageMonths: row.ageMonths != null ? Number(row.ageMonths) : 0,
    gender: row.gender,
    phone: row.phone ?? null,
    email: row.email ?? null,
    address: row.address ?? null,
    refDoctor: row.refDoctor ?? null,
    doctorId: row.doctorId ?? null,
    bloodGroup: row.bloodGroup ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapTemplateField(row: any): TemplateField {
  return {
    id: row.id,
    templateId: row.templateId,
    fieldName: row.fieldName,
    unit: row.unit ?? null,
    normalRangeText: row.normalRangeText ?? null,
    normalRangeMin: row.normalRangeMin ?? null,
    normalRangeMax: row.normalRangeMax ?? null,
    normalRangeTextMale: row.normalRangeTextMale ?? null,
    normalRangeTextFemale: row.normalRangeTextFemale ?? null,
    normalRangeMinMale: row.normalRangeMinMale ?? null,
    normalRangeMaxMale: row.normalRangeMaxMale ?? null,
    normalRangeMinFemale: row.normalRangeMinFemale ?? null,
    normalRangeMaxFemale: row.normalRangeMaxFemale ?? null,
    fieldType: row.fieldType,
    section: row.section ?? null,
    sortOrder: row.sortOrder,
    isBold: row.isBold,
    isActive: row.isActive ?? true,
  };
}

export function mapTemplate(row: any): TemplateWithFields {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description ?? null,
    price: row.price == null ? null : Number(row.price),
    isActive: row.isActive,
    createdById: row.createdById,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    fields: (row.fields ?? [])
      .filter((f: any) => f.isActive !== false)
      .map(mapTemplateField)
      .sort((a: TemplateField, b: TemplateField) => a.sortOrder - b.sortOrder),
    _count: {
      // reports(count) arrives as [{ count: n }]; a plain id list is counted by length
      reports: Array.isArray(row.reports)
        ? typeof row.reports[0]?.count === "number" ? row.reports[0].count : row.reports.length
        : row._count?.reports ?? 0,
    },
  };
}

export function mapReport(row: any): ReportWithRelations {
  return {
    id: row.id,
    reportNumber: row.reportNumber,
    patientId: row.patientId,
    templateId: row.templateId,
    createdById: row.createdById,
    status: row.status,
    collectedAt: row.collectedAt,
    reportedAt: row.reportedAt ?? null,
    notes: row.notes ?? null,
    pdfUrl: row.pdfUrl ?? null,
    billAmount: row.billAmount != null ? Number(row.billAmount) : null,
    discountType: row.discountType ?? "FLAT",
    discount: row.discount != null ? Number(row.discount) : 0,
    amountPaid: row.amountPaid != null ? Number(row.amountPaid) : null,
    paymentStatus: row.paymentStatus ?? "PAID",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    patient: {
      id: row.patient?.id,
      patientCode: row.patient?.patientCode,
      name: row.patient?.name,
      age: row.patient?.age,
      ageMonths: row.patient?.ageMonths != null ? Number(row.patient.ageMonths) : 0,
      gender: row.patient?.gender,
      phone: row.patient?.phone ?? null,
      refDoctor: row.patient?.refDoctor ?? null,
      doctorId: row.patient?.doctorId ?? null,
      email: row.patient?.email ?? null,
      address: row.patient?.address ?? null,
      bloodGroup: row.patient?.bloodGroup ?? null,
      doctor: row.patient?.doctor ?? null,
    },
    template: {
      id: row.template?.id,
      name: row.template?.name,
      category: row.template?.category,
      price: row.template?.price ?? null,
    },
    createdBy: { name: row.createdBy?.name ?? "Unknown" },
    values: (row.values ?? [])
      .map((v: any) => ({
        id: v.id,
        fieldId: v.fieldId,
        value: v.value,
        isAbnormal: v.isAbnormal,
        field: {
          fieldName: v.field?.fieldName,
          unit: v.field?.unit ?? null,
          fieldType: v.field?.fieldType ?? "TEXT",
          normalRangeText: v.field?.normalRangeText ?? null,
          normalRangeTextMale: v.field?.normalRangeTextMale ?? null,
          normalRangeTextFemale: v.field?.normalRangeTextFemale ?? null,
          normalRangeMin: v.field?.normalRangeMin ?? null,
          normalRangeMax: v.field?.normalRangeMax ?? null,
          section: v.field?.section ?? null,
          sortOrder: v.field?.sortOrder ?? 0,
          isBold: v.field?.isBold ?? false,
        },
      }))
      .sort((a: any, b: any) => a.field.sortOrder - b.field.sortOrder),
  };
}

export function mapPatientWithReports(row: any): PatientWithReports {
  const patient = mapPatient(row);
  const doctor = row.doctor
    ? {
        name: row.doctor.name,
        qualification: row.doctor.qualification ?? null,
        specialization: row.doctor.specialization ?? null,
      }
    : null;

  return {
    ...patient,
    reports: (row.reports ?? []).map((r: any) =>
      mapReport({
        ...r,
        patient: r.patient || { ...patient, doctor },
      }),
    ),
  };
}

export function mapSettings(row: any): LabSettings {
  return {
    id: row.id,
    labName: row.labName,
    labAddress: row.labAddress,
    labPhone: row.labPhone,
    labEmail: row.labEmail,
    labWebsite: row.labWebsite ?? null,
    logoUrl: row.logoUrl ?? null,
    signatureUrl: row.signatureUrl ?? null,
    useSignature: row.useSignature !== undefined ? Boolean(row.useSignature) : Boolean(row.signatureUrl),
    pathologistName: row.pathologistName,
    pathologistQual: row.pathologistQual,
    reportNumberPrefix: row.reportNumberPrefix,
    reportCounter: row.reportCounter,
    reportFooter: row.reportFooter ?? null,
    accentColor: row.accentColor,
  };
}

export function mapDashboardStats(row: any): DashboardStats {
  return {
    totalPatients: Number(row.totalPatients ?? 0),
    totalReports: Number(row.totalReports ?? 0),
    reportsToday: Number(row.reportsToday ?? 0),
    reportsThisMonth: Number(row.reportsThisMonth ?? 0),
    pendingDrafts: Number(row.pendingDrafts ?? 0),
    topTests: Array.isArray(row.topTests) ? row.topTests : [],
  };
}
