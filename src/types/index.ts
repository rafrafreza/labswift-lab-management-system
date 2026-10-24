export type Role = "ADMIN" | "STAFF";
export type Gender = "MALE" | "FEMALE" | "OTHER";
export type ReportStatus = "DRAFT" | "FINAL" | "SENT";
export type DiscountType = "FLAT" | "PERCENT";
export type PaymentStatus = "PAID" | "PARTIAL" | "UNPAID" | "FREE";
export type FieldType =
  | "NUMBER"
  | "TEXT"
  | "SELECT"
  | "POSITIVE_NEGATIVE"
  | "REACTIVE"
  | "WIDAL"
  | "URINE_ROUTINE";

export type Profile = {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Doctor = {
  id: string;
  name: string;
  qualification: string | null;
  phone: string | null;
  email: string | null;
  specialization: string | null;
  incentiveRate: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ReportIncentive = {
  id: string;
  reportId: string;
  doctorId: string;
  billAmount: number;
  incentiveRate: number;
  incentiveAmount: number;
  isPaid: boolean;
  paidAt: string | null;
  createdAt: string;
  doctor: { name: string; qualification: string | null };
  report: { reportNumber: string; collectedAt: string; patient: { name: string } };
};

export type Patient = {
  id: string;
  patientCode: string;
  name: string;
  age: number;
  ageMonths?: number | null;
  gender: Gender;
  phone: string | null;   // now optional
  email: string | null;
  address: string | null;
  refDoctor: string | null;
  doctorId: string | null;
  bloodGroup: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TemplateField = {
  id: string;
  templateId: string;
  fieldName: string;
  unit: string | null;
  // Generic (used when no gender-specific range set)
  normalRangeText: string | null;
  normalRangeMin: number | null;
  normalRangeMax: number | null;
  // Gender-specific
  normalRangeTextMale: string | null;
  normalRangeTextFemale: string | null;
  normalRangeMinMale: number | null;
  normalRangeMaxMale: number | null;
  normalRangeMinFemale: number | null;
  normalRangeMaxFemale: number | null;
  fieldType: FieldType;
  section: string | null;
  sortOrder: number;
  isBold: boolean;
  isActive?: boolean;
};

export type TestTemplate = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  price: number | null;
  isActive: boolean;
  createdById: string;
  createdAt: string;
  updatedAt: string;
};

export type TemplateWithFields = TestTemplate & {
  fields: TemplateField[];
  _count?: { reports: number };
};

export type ReportValueWithField = {
  id: string;
  fieldId: string;
  value: string;
  isAbnormal: boolean;
  field: {
    fieldName: string;
    unit: string | null;
    fieldType: FieldType;
    normalRangeText: string | null;
    normalRangeTextMale: string | null;
    normalRangeTextFemale: string | null;
    normalRangeMin?: number | null;
    normalRangeMax?: number | null;
    section: string | null;
    sortOrder: number;
    isBold: boolean;
  };
};

export type ReportWithRelations = {
  id: string;
  reportNumber: string;
  patientId: string;
  templateId: string;
  createdById: string;
  status: ReportStatus;
  collectedAt: string;
  reportedAt: string | null;
  notes: string | null;
  pdfUrl?: string | null;
  billAmount?: number | null;
  discountType?: DiscountType | null;
  discount?: number | null;
  amountPaid?: number | null;
  paymentStatus?: PaymentStatus | null;
  createdAt: string;
  updatedAt: string;
  patient: {
    id: string;
    patientCode: string;
    name: string;
    age: number;
    ageMonths?: number | null;
    gender: Gender;
    phone: string | null;
    refDoctor: string | null;
    doctorId: string | null;
    email?: string | null;
    address?: string | null;
    bloodGroup?: string | null;
    doctor?: {                        
      name: string;
      qualification: string | null;
      specialization: string | null;
    } | null;
  };
  template: {
    id: string;
    name: string;
    category: string;
    price?: number | null;
  };
  createdBy: { name: string };
  values: ReportValueWithField[];
};

export type PatientWithReports = Patient & {
  reports: ReportWithRelations[];
};

export type LabSettings = {
  id: string;
  labName: string;
  labAddress: string;
  labPhone: string;
  labEmail: string;
  labWebsite: string | null;
  logoUrl: string | null;
  signatureUrl: string | null;
  useSignature?: boolean;
  pathologistName: string;
  pathologistQual: string;
  reportNumberPrefix: string;
  reportCounter: number;
  reportFooter: string | null;
  accentColor: string;
};

export type CreatePatientInput = {
  name: string;
  age: number;
  ageMonths?: number;
  gender: Gender;
  phone?: string;
  email?: string;
  address?: string;
  refDoctor?: string;
  doctorId?: string;
  bloodGroup?: string;
};

export type CreateReportInput = {
  patientId: string;
  templateId: string;
  collectedAt: string;
  notes?: string;
  status?: "DRAFT" | "FINAL";
  billAmount?: number;
  discountType?: DiscountType;
  discount?: number;
  amountPaid?: number;
  paymentStatus?: PaymentStatus;
  values: Array<{ fieldId: string; value: string }>;
};

export type DashboardStats = {
  totalPatients: number;
  totalReports: number;
  reportsToday: number;
  reportsThisMonth: number;
  pendingDrafts: number;
  topTests: Array<{ name: string; count: number }>;
};
