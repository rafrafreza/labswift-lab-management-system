// The selectable PDF report designs. The id is stored in lab_settings."reportTemplate".
// Layout/styling for each id lives in components/shared/LabReportPDF.tsx.

export const REPORT_TEMPLATES = [
  {
    id: "modern",
    name: "Modern",
    summary: "Clean cards with an accent-colour frame",
    description:
      "Soft rounded panels, an accent-coloured header rule and a subtle geometric footer. A contemporary look that suits most labs.",
  },
  {
    id: "classic",
    name: "Classic Clinical",
    summary: "Traditional hospital-style letterhead",
    description:
      "Centred letterhead with a double rule, serif headings and ruled tables. The familiar, formal layout doctors and patients expect.",
  },
  {
    id: "executive",
    name: "Executive Band",
    summary: "Bold full-width coloured header",
    description:
      "A strong brand-coloured header band, tinted panels and a coloured table header. Confident and corporate, ideal for diagnostic chains.",
  },
  {
    id: "minimal",
    name: "Minimal",
    summary: "Refined, spacious and ink-friendly",
    description:
      "Hairline rules, generous white space and no heavy fills. Elegant on screen, and economical when printed in black and white.",
  },
] as const;

export type ReportTemplateId = (typeof REPORT_TEMPLATES)[number]["id"];

export const DEFAULT_REPORT_TEMPLATE: ReportTemplateId = "modern";

export function normalizeReportTemplate(value: unknown): ReportTemplateId {
  return REPORT_TEMPLATES.some((t) => t.id === value) ? (value as ReportTemplateId) : DEFAULT_REPORT_TEMPLATE;
}
