export { publicReportUrl } from "@/lib/publicReportUrl";

import { supabase } from "@/lib/supabase";
import { mapReport, mapSettings } from "@/lib/services/helpers";
import type { LabSettings, ReportWithRelations } from "@/types";

/**
 * Loads a FINAL/SENT report by its QR token, no login needed (database function get_public_report, see 20.sql).
 * Resolves to null when the link is unknown, belongs to a draft, or was revoked.
 */
export async function getPublicReport(
  token: string,
): Promise<{ report: ReportWithRelations; settings: LabSettings } | null> {
  const { data, error } = await supabase.rpc("get_public_report", { p_token: token });
  if (error) throw new Error(error.message);
  if (!data || !data.report) return null;
  return { report: mapReport(data.report), settings: mapSettings(data.settings ?? {}) };
}
