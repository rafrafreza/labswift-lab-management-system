import { useEffect, useState } from "react";
import { Download, ExternalLink, FileText, ShieldAlert } from "lucide-react";
import { useParams } from "react-router-dom";

import { getPublicReport } from "@/lib/publicReport";
import type { LabSettings, ReportWithRelations } from "@/types";

type View =
  | { state: "loading" }
  | { state: "missing" }
  | { state: "error"; message: string }
  | { state: "ready"; report: ReportWithRelations; settings: LabSettings; pdfUrl: string; fileName: string };

/**
 * Opened by scanning the QR code printed on a report. No login: the long random token in the address is the
 * credential, and the database only releases FINAL/SENT reports for it (get_public_report, 20.sql).
 * The PDF is built here in the browser from the same renderer the staff use, so it is always the current version.
 */
export default function PublicReportPage() {
  const { token = "" } = useParams();
  const [view, setView] = useState<View>({ state: "loading" });

  // Keep these private links out of search engines
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setView({ state: "loading" });

    (async () => {
      try {
        const found = await getPublicReport(token);
        if (cancelled) return;
        if (!found) {
          setView({ state: "missing" });
          return;
        }

        const [{ pdf }, { default: LabReportPDF }] = await Promise.all([
          import("@react-pdf/renderer"),
          import("@/components/shared/LabReportPDF"),
        ]);
        const { report, settings } = found;
        const blob = await pdf(
          <LabReportPDF
            report={report}
            settings={{
              ...settings,
              labWebsite: settings.labWebsite ?? undefined,
              logoUrl: settings.logoUrl ?? undefined,
              signatureUrl: settings.signatureUrl ?? undefined,
              reportFooter: settings.reportFooter ?? undefined,
            }}
          />,
        ).toBlob();
        if (cancelled) return;

        objectUrl = URL.createObjectURL(blob);
        setView({
          state: "ready",
          report,
          settings,
          pdfUrl: objectUrl,
          fileName: `${report.reportNumber}-${report.patient.name.replace(/\s+/g, "-")}.pdf`,
        });
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setView({ state: "error", message: "We couldn't prepare this report. Please check your connection and try again." });
        }
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
        {view.state === "loading" && (
          <div className="space-y-4 py-6" role="status">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
            <p className="text-sm font-medium text-slate-700">Preparing your report...</p>
            <p className="text-xs text-slate-400">This takes a few seconds.</p>
          </div>
        )}

        {view.state === "missing" && (
          <div className="space-y-3 py-4">
            <ShieldAlert className="mx-auto h-10 w-10 text-amber-500" />
            <h1 className="text-lg font-semibold text-slate-800">Report not available</h1>
            <p className="text-sm text-slate-500">
              This link is not valid, or the report is not ready yet. Please contact the lab that issued it.
            </p>
          </div>
        )}

        {view.state === "error" && (
          <div className="space-y-4 py-4">
            <ShieldAlert className="mx-auto h-10 w-10 text-red-500" />
            <h1 className="text-lg font-semibold text-slate-800">Something went wrong</h1>
            <p className="text-sm text-slate-500">{view.message}</p>
            <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
              Try again
            </button>
          </div>
        )}

        {view.state === "ready" && (
          <div className="space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">{view.settings.labName}</p>
              <FileText className="mx-auto mt-4 h-12 w-12 text-teal-600" />
              <h1 className="mt-3 text-lg font-semibold text-slate-900">Your report is ready</h1>
            </div>

            <dl className="space-y-1.5 rounded-xl bg-slate-50 p-4 text-left text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Patient</dt>
                <dd className="text-right font-medium text-slate-800">{view.report.patient.name}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Test</dt>
                <dd className="text-right font-medium text-slate-800">{view.report.template.name}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Report no.</dt>
                <dd className="text-right font-mono font-medium text-slate-800">{view.report.reportNumber}</dd>
              </div>
            </dl>

            <div className="flex flex-col gap-2">
              <a href={view.pdfUrl} download={view.fileName} className="btn btn-primary justify-center">
                <Download className="h-4 w-4" /> Download PDF
              </a>
              <a
                href={view.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary justify-center"
              >
                <ExternalLink className="h-4 w-4" /> View in browser
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
