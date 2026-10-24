import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";

import { getSettings } from "@/lib/services/settings";
import type { ReportWithRelations } from "@/types";

type Props = { report: ReportWithRelations };

export default function PDFDownloadButton({ report }: Props) {
  const [PDFDownloadLink, setPDFDownloadLink] = useState<any>(null);
  const [LabReportPDF, setLabReportPDF] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all([
      import("@react-pdf/renderer").then((module) => {
        setPDFDownloadLink(() => module.PDFDownloadLink);
      }),
      import("@/components/shared/LabReportPDF").then((module) => {
        setLabReportPDF(() => module.default);
      }),
      getSettings().then(setSettings),
    ])
      .then(() => setReady(true))
      .catch(() => toast.error("Could not load PDF engine"));
  }, []);

  if (!ready || !PDFDownloadLink || !LabReportPDF || !settings) {
    return (
      <button disabled className="btn btn-primary opacity-60">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        Loading PDF...
      </button>
    );
  }

  const fileName = `${report.reportNumber}-${report.patient.name.replace(/\s+/g, "-")}.pdf`;

  return (
    <PDFDownloadLink document={<LabReportPDF report={report} settings={settings} />} fileName={fileName}>
      {({ loading }: { loading: boolean }) => (
        <button className="btn btn-primary" disabled={loading}>
          {loading ? (
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
      )}
    </PDFDownloadLink>
  );
}
