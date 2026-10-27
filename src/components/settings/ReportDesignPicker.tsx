import { useState, type ComponentProps } from "react";
import { Check, Eye } from "lucide-react";
import { toast } from "sonner";

import type LabReportPDF from "@/components/shared/LabReportPDF";
import { preloadPdfEngine } from "@/lib/preload";
import { REPORT_TEMPLATES, type ReportTemplateId } from "@/lib/reportTemplates";
import { getSampleReport } from "@/lib/sampleReport";
import { cn } from "@/lib/utils";

type PdfSettings = ComponentProps<typeof LabReportPDF>["settings"];

// ── Miniature page previews (pure CSS, tinted with the lab's accent colour) ───────────────

const Bar = ({ w, h = 3, color = "#cbd5e1", className }: { w: number | string; h?: number; color?: string; className?: string }) => (
  <div className={className} style={{ width: typeof w === "number" ? `${w}%` : w, height: h, background: color, borderRadius: 1 }} />
);

function Rows({ zebra, accent, border = "#e2e8f0", flag = true }: { zebra: string; accent?: string; border?: string; flag?: boolean }) {
  return (
    <div className="space-y-0">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex items-center gap-1 px-1 py-[3px]"
          style={{
            background: flag && i === 1 ? "#fff1f2" : i % 2 ? zebra : "#fff",
            borderBottom: `0.5px solid ${flag && i === 1 ? "#fecaca" : border}`,
          }}
        >
          <Bar w={38} h={2.5} color="#94a3b8" />
          <Bar w={14} h={2.5} color={flag && i === 1 ? "#dc2626" : "#475569"} className="ml-auto" />
          <Bar w={22} h={2.5} color="#cbd5e1" />
        </div>
      ))}
    </div>
  );
}

function Thumb({ id, accent }: { id: ReportTemplateId; accent: string }) {
  const tint = `${accent}1f`;
  const faint = `${accent}0d`;

  let body: React.ReactNode;
  switch (id) {
    case "classic":
      body = (
        <div className="flex h-full flex-col px-2.5 pt-2.5">
          <div className="flex flex-col items-center gap-[3px]">
            <div className="h-3 w-3 rounded-full" style={{ background: accent }} />
            <Bar w={55} h={4} color="#0f172a" />
            <Bar w={70} h={2} />
          </div>
          <div className="mt-1.5" style={{ height: 1.5, background: accent }} />
          <div className="mt-[1.5px]" style={{ height: 0.5, background: accent }} />
          <div className="flex justify-between py-1" style={{ borderBottom: "0.5px solid #cbd5e1" }}>
            <Bar w={22} h={2} color="#475569" />
            <Bar w={22} h={2} color="#475569" />
            <Bar w={14} h={2} color={accent} />
          </div>
          <div className="mt-1.5 space-y-[3px] p-1.5" style={{ border: "0.75px solid #94a3b8" }}>
            <Bar w={60} h={2.5} color="#334155" />
            <Bar w={40} h={2} />
          </div>
          <div className="mx-auto mt-2 py-[2px]" style={{ width: "46%", borderTop: `1px solid ${accent}`, borderBottom: `1px solid ${accent}` }}>
            <Bar w={100} h={2.5} color="#0f172a" />
          </div>
          <div className="mt-1.5" style={{ border: "0.75px solid #94a3b8" }}>
            <div className="px-1 py-[3px]" style={{ background: "#eef2f7", borderBottom: "0.5px solid #94a3b8" }}>
              <Bar w={30} h={2.5} color="#0f172a" />
            </div>
            <Rows zebra="#fafbfc" border="#d5dde7" />
          </div>
        </div>
      );
      break;

    case "executive":
      body = (
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-1.5 px-2.5 py-2" style={{ background: accent }}>
            <div className="flex h-5 w-5 items-center justify-center rounded bg-white">
              <div className="h-2.5 w-2.5 rounded-full" style={{ background: accent }} />
            </div>
            <div className="flex-1 space-y-[3px]">
              <Bar w={62} h={4} color="#ffffff" />
              <Bar w={80} h={2} color="rgba(255,255,255,0.65)" />
            </div>
            <div className="space-y-[3px]">
              <Bar w={16} h={2} color="rgba(255,255,255,0.7)" className="ml-auto" />
              <div className="rounded-[2px] bg-white" style={{ width: 20, height: 5 }} />
            </div>
          </div>
          <div className="px-2.5 pt-2">
            <div className="space-y-[3px] rounded-[3px] p-1.5" style={{ background: tint, borderTop: `1.5px solid ${accent}` }}>
              <Bar w={58} h={2.5} color="#0f172a" />
              <Bar w={36} h={2} />
            </div>
            <div className="mx-auto mt-2" style={{ width: "44%" }}>
              <Bar w={100} h={3} color={accent} />
            </div>
            <div className="mt-1.5 overflow-hidden rounded-[3px]" style={{ border: `0.75px solid ${accent}55` }}>
              <div className="flex items-center gap-1 px-1 py-[3px]" style={{ background: accent }}>
                <Bar w={30} h={2} color="#ffffff" />
                <Bar w={14} h={2} color="rgba(255,255,255,0.8)" className="ml-auto" />
                <Bar w={22} h={2} color="rgba(255,255,255,0.8)" />
              </div>
              <Rows zebra={faint} border={`${accent}22`} />
            </div>
          </div>
          <div className="mt-auto" style={{ height: 3, background: accent }} />
        </div>
      );
      break;

    case "minimal":
      body = (
        <div className="flex h-full flex-col px-3 pt-3.5">
          <div className="flex items-start justify-between">
            <div className="space-y-[3px]" style={{ width: "55%" }}>
              <Bar w={85} h={4} color="#0f172a" />
              <Bar w={70} h={2} />
            </div>
            <div className="space-y-[3px]">
              <Bar w={22} h={2.5} color="#0f172a" className="ml-auto" />
              <Bar w={26} h={2} />
            </div>
          </div>
          <div className="mt-2" style={{ height: 0.75, background: "#0f172a" }} />
          <div className="mt-2 space-y-[3px] py-1.5" style={{ borderTop: "0.5px solid #cbd5e1", borderBottom: "0.5px solid #cbd5e1" }}>
            <Bar w={50} h={2.5} color="#0f172a" />
            <Bar w={34} h={2} color="#94a3b8" />
          </div>
          <div className="mt-2">
            <Bar w={28} h={3} color={accent} />
          </div>
          <div className="mt-1.5 pb-[3px]" style={{ borderBottom: "0.75px solid #0f172a" }}>
            <Bar w={26} h={2.5} color="#0f172a" />
          </div>
          <Rows zebra="#ffffff" border="#e5e7eb" />
        </div>
      );
      break;

    default:
      body = (
        <div className="relative flex h-full flex-col px-2.5 pt-2.5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-1.5">
              <div className="h-4 w-4 rounded-full" style={{ background: accent }} />
              <div className="space-y-[3px]">
                <Bar w={42} h={4} color={accent} />
                <Bar w={52} h={2} />
              </div>
            </div>
            <div className="space-y-[3px]">
              <Bar w={22} h={2} color="#94a3b8" className="ml-auto" />
              <div className="rounded-[2px]" style={{ width: 22, height: 5, background: accent }} />
            </div>
          </div>
          <div className="mt-1.5" style={{ height: 1.5, background: accent }} />
          <div className="mt-2 space-y-[3px] rounded-[3px] bg-slate-50 p-1.5" style={{ borderLeft: `2px solid ${accent}` }}>
            <Bar w={56} h={2.5} color="#0f172a" />
            <Bar w={36} h={2} />
          </div>
          <div className="mx-auto mt-2 pb-[2px]" style={{ width: "42%", borderBottom: `1px solid ${accent}` }}>
            <Bar w={100} h={2.5} color="#0f172a" />
          </div>
          <div className="mt-1.5 overflow-hidden rounded-[4px]" style={{ border: "0.75px solid #dbe4ee" }}>
            <div className="flex items-center gap-1 px-1 py-[3px]" style={{ background: "#f8fafc", borderBottom: "0.5px solid #dbe4ee" }}>
              <div style={{ width: 2, height: 7, background: accent, borderRadius: 1 }} />
              <Bar w={30} h={2.5} color="#0f172a" />
            </div>
            <Rows zebra="#f8fafc" />
          </div>
          <div className="absolute bottom-0 left-0" style={{ width: 0, height: 0, borderBottom: `22px solid ${accent}33`, borderRight: "34px solid transparent" }} />
          <div className="absolute bottom-0 right-0" style={{ width: 0, height: 0, borderBottom: `26px solid ${accent}33`, borderLeft: "44px solid transparent" }} />
        </div>
      );
  }

  return (
    <div className="relative w-full overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm" style={{ aspectRatio: "3 / 4" }}>
      {body}
    </div>
  );
}

// ── Picker ────────────────────────────────────────────────────────────────────────────────

type Props = {
  value: string;
  onChange: (id: ReportTemplateId) => void;
  accent: string;
  /** Lab details as currently entered (saved or not), used for the sample preview */
  pdfSettings: Omit<PdfSettings, "reportTemplate">;
};

export default function ReportDesignPicker({ value, onChange, accent, pdfSettings }: Props) {
  const [previewing, setPreviewing] = useState(false);
  const selected = REPORT_TEMPLATES.find((t) => t.id === value) ?? REPORT_TEMPLATES[0];

  async function handlePreview() {
    // Open the tab synchronously (inside the click) so browsers don't block it as a popup
    const win = window.open("", "_blank");
    setPreviewing(true);
    try {
      const [{ pdf }, { default: Pdf }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/components/shared/LabReportPDF"),
      ]);
      const blob = await pdf(
        <Pdf report={getSampleReport()} settings={{ ...pdfSettings, reportTemplate: selected.id }} />,
      ).toBlob();
      const url = URL.createObjectURL(blob);
      if (win) {
        win.location.href = url;
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = `sample-${selected.id}-report.pdf`;
        a.click();
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      win?.close();
      console.error(err);
      toast.error("Could not generate the preview");
    } finally {
      setPreviewing(false);
    }
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" role="radiogroup" aria-label="Report design">
        {REPORT_TEMPLATES.map((t) => {
          const active = t.id === selected.id;
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(t.id)}
              className={cn(
                "group relative rounded-xl border p-2 text-left transition-all",
                active
                  ? "border-teal-600 bg-teal-50/40 ring-2 ring-teal-600/30"
                  : "border-slate-200 hover:border-slate-300 hover:bg-slate-50",
              )}
            >
              <Thumb id={t.id} accent={accent} />
              <div className="mt-2 flex items-center gap-1.5 px-0.5">
                <span className="text-[13px] font-semibold text-slate-800">{t.name}</span>
                {active && (
                  <span className="ml-auto flex h-4 w-4 items-center justify-center rounded-full bg-teal-600 text-white">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                )}
              </div>
              <p className="px-0.5 pb-0.5 text-[11px] leading-snug text-slate-500">{t.summary}</p>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
        <p className="max-w-md text-xs leading-relaxed text-slate-600">
          <span className="font-semibold text-slate-800">{selected.name}:</span> {selected.description}
        </p>
        <button
          type="button"
          onClick={handlePreview}
          onMouseEnter={preloadPdfEngine}
          disabled={previewing}
          className="btn btn-secondary btn-sm flex-shrink-0"
        >
          {previewing ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
          ) : (
            <Eye className="h-3.5 w-3.5" />
          )}
          Preview sample report
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-400">
        The preview uses the details on this page (even if not saved yet) with a fictional patient. Remember to click
        Save Settings to apply the design to your reports.
      </p>
    </div>
  );
}
