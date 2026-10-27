import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";

import { preloadPdfEngine, preloadPdfEngineWhenIdle } from "@/lib/preload";
import { DRAFT_PDF_MESSAGE } from "@/lib/reportRules";
import { getSettings } from "@/lib/services/settings";
import type { ReportWithRelations } from "@/types";

type Props = { report: ReportWithRelations };

// The PDF is built when the button is clicked, not when the page opens: rendering it eagerly
// blocked the page for every report view even when nobody downloaded anything.
export default function PDFDownloadButton({ report }: Props) {
  const [generating, setGenerating] = useState(false);

  const isDraft = report.status === "DRAFT";

  useEffect(() => {
    if (isDraft) return; // nothing will be generated, so don't download the PDF engine
    // Fetch the engine and settings in the background so the first click is fast
    preloadPdfEngineWhenIdle();
    void getSettings().catch(() => {});
  }, []);

  async function handleDownload() {
    if (isDraft) {
      toast.error(DRAFT_PDF_MESSAGE);
      return;
    }
    setGenerating(true);
    try {
      const [settings, { pdf }, { default: LabReportPDF }] = await Promise.all([
        getSettings(),
        import("@react-pdf/renderer"),
        import("@/components/shared/LabReportPDF"),
      ]);

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
      a.download = `${report.reportNumber}-${report.patient.name.replace(/\s+/g, "-")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate PDF");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <button
      className={`btn btn-primary ${isDraft ? "opacity-60" : ""}`}
      disabled={generating}
      onClick={handleDownload}
      onMouseEnter={isDraft ? undefined : preloadPdfEngine}
      onFocus={isDraft ? undefined : preloadPdfEngine}
      title={isDraft ? DRAFT_PDF_MESSAGE : undefined}
    >
      {generating ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          Generating...
        </>
      ) : (
        <>
          <Download className="h-4 w-4" />
          Download PDF
        </>
      )}
    </button>
  );
}
