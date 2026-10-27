import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { preloadPdfEngine } from "@/lib/preload";
import { DRAFT_PDF_MESSAGE } from "@/lib/reportRules";
import { getReport } from "@/lib/services/reports";
import { getSettings } from "@/lib/services/settings";

type Props = {
  reportId: string;
  reportNumber: string;
  patientName: string;
  status?: "DRAFT" | "FINAL" | "SENT";
};

export default function ReportRowDownload({ reportId, reportNumber, patientName, status }: Props) {
  const [loading, setLoading] = useState(false);

  const isDraft = status === "DRAFT";

  async function handleDownload() {
    if (isDraft) {
      toast.error(DRAFT_PDF_MESSAGE);
      return;
    }
    setLoading(true);
    try {
      const [report, settings, { pdf }, { default: LabReportPDF }] = await Promise.all([
        getReport(reportId),
        getSettings(),
        import("@react-pdf/renderer"),
        import("@/components/shared/LabReportPDF"),
      ]);

      // The list may be stale: re-check the status of the report we actually fetched
      if (report.status === "DRAFT") {
        toast.error(DRAFT_PDF_MESSAGE);
        return;
      }

      const pdfSettings = {
        ...settings,
        labWebsite: settings.labWebsite ?? undefined,
        logoUrl: settings.logoUrl ?? undefined,
        signatureUrl: settings.signatureUrl ?? undefined,
        reportFooter: settings.reportFooter ?? undefined,
        useSignature: settings.useSignature,
      };
      const blob = await pdf(<LabReportPDF report={report} settings={pdfSettings} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${reportNumber}-${patientName.replace(/\s+/g, "-")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to generate PDF");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleDownload}
      onMouseEnter={isDraft ? undefined : preloadPdfEngine}
      disabled={loading}
      title={isDraft ? DRAFT_PDF_MESSAGE : "Download PDF"}
      className={`btn btn-ghost btn-icon btn-sm hover:text-blue-700 ${isDraft ? "text-slate-300" : "text-slate-400"}`}
    >
      {loading ? (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
      ) : (
        <Download className="h-3.5 w-3.5" />
      )}
    </button>
  );
}
