import type { ReportValueWithField, ReportWithRelations } from "@/types";

// Fictional report used to preview PDF designs from the Settings page. Contains a mix of normal
// and abnormal results so every part of the layout (section headers, flags, notes) is visible.

type Row = [section: string, name: string, unit: string, value: string, range: string, abnormal?: boolean, bold?: boolean];

const ROWS: Row[] = [
  ["Haemogram", "Haemoglobin", "g/dL", "10.4", "12.0 - 15.0", true, true],
  ["Haemogram", "Total Leucocyte Count (TLC)", "/cumm", "7800", "4000 - 11000"],
  ["Haemogram", "Total RBC Count", "million/cumm", "4.1", "3.8 - 4.8"],
  ["Haemogram", "PCV / Haematocrit", "%", "33", "36 - 46", true],
  ["Haemogram", "Platelet Count", "/cumm", "310000", "150000 - 410000", false, true],
  ["RBC Indices", "MCV", "fL", "76", "83 - 101", true],
  ["RBC Indices", "MCH", "pg", "25.0", "27 - 32", true],
  ["RBC Indices", "MCHC", "g/dL", "33.1", "31.5 - 34.5"],
];

export function getSampleReport(): ReportWithRelations {
  const now = new Date();
  const collected = new Date(now.getTime() - 3 * 60 * 60 * 1000);

  const values: ReportValueWithField[] = ROWS.map(([section, name, unit, value, range, abnormal, bold], i) => ({
    id: `sample-${i}`,
    fieldId: `sample-field-${i}`,
    value,
    isAbnormal: Boolean(abnormal),
    field: {
      fieldName: name,
      unit: unit || null,
      fieldType: "NUMBER",
      normalRangeText: range,
      normalRangeTextMale: null,
      normalRangeTextFemale: null,
      normalRangeMin: null,
      normalRangeMax: null,
      section,
      sortOrder: i,
      isBold: Boolean(bold),
    },
  }));

  return {
    id: "sample-report",
    reportNumber: "LAB-2026-00123",
    patientId: "sample-patient",
    templateId: "sample-template",
    createdById: "sample-user",
    status: "FINAL",
    collectedAt: collected.toISOString(),
    reportedAt: now.toISOString(),
    publicToken: "sample-preview-0000000000000000000000000000",
    notes: "Microcytic hypochromic picture. Iron studies advised. This is a sample report for design preview only.",
    createdAt: collected.toISOString(),
    updatedAt: now.toISOString(),
    patient: {
      id: "sample-patient",
      patientCode: "PAT-00123",
      name: "Anita Sharma",
      age: 34,
      ageMonths: 0,
      gender: "FEMALE",
      phone: null,
      refDoctor: "Dr. R. Menon",
      doctorId: null,
      doctor: { name: "R. Menon", qualification: "MBBS, MD", specialization: "General Physician" },
    },
    template: { id: "sample-template", name: "Complete Blood Count (CBC)", category: "Haematology", price: 300 },
    createdBy: { name: "Sample" },
    values,
  };
}
