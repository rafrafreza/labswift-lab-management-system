import { startOfDay, startOfMonth } from "date-fns";

import { supabase } from "@/lib/supabase";
import { mapDashboardStats } from "@/lib/services/helpers";
import { listTemplates } from "@/lib/services/templates";

export async function getDashboardStats() {
  const todayStart = startOfDay(new Date()).toISOString();
  const monthStart = startOfMonth(new Date()).toISOString();

  const [
    totalPatientsRes,
    totalReportsRes,
    reportsTodayRes,
    reportsMonthRes,
    draftsRes,
    reportsForTopTestsRes,
  ] = await Promise.all([
    supabase.from("patients").select("id", { count: "exact", head: true }),
    supabase.from("reports").select("id", { count: "exact", head: true }),
    supabase.from("reports").select("id", { count: "exact", head: true }).gte("createdAt", todayStart),
    supabase.from("reports").select("id", { count: "exact", head: true }).gte("createdAt", monthStart),
    supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "DRAFT"),
    supabase.from("reports").select("templateId"),
  ]);

  const errors = [
    totalPatientsRes.error,
    totalReportsRes.error,
    reportsTodayRes.error,
    reportsMonthRes.error,
    draftsRes.error,
    reportsForTopTestsRes.error,
  ].filter(Boolean);

  if (errors.length > 0) {
    throw new Error(errors[0]?.message ?? "Failed to load analytics.");
  }

  const templates = await listTemplates(false);
  const nameMap = new Map(templates.map((template) => [template.id, template.name]));
  const counts = new Map<string, number>();

  for (const row of reportsForTopTestsRes.data ?? []) {
    counts.set(row.templateId, (counts.get(row.templateId) ?? 0) + 1);
  }

  const topTests = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([templateId, count]) => ({
      name: nameMap.get(templateId) ?? "Unknown",
      count,
    }));

  return mapDashboardStats({
    totalPatients: totalPatientsRes.count,
    totalReports: totalReportsRes.count,
    reportsToday: reportsTodayRes.count,
    reportsThisMonth: reportsMonthRes.count,
    pendingDrafts: draftsRes.count,
    topTests,
  });
}

export async function exportBackup() {
  const [patients, reports, templates, settings, profiles] = await Promise.all([
    supabase.from("patients").select("*").order("createdAt"),
    supabase.from("reports").select("*, values:report_values(*)").order("createdAt"),
    supabase.from("test_templates").select("*, fields:template_fields(*)").order("category").order("name"),
    supabase.from("lab_settings").select("*"),
    supabase.from("profiles").select("*").order("name"),
  ]);

  const firstError =
    patients.error ?? reports.error ?? templates.error ?? settings.error ?? profiles.error;

  if (firstError) {
    throw new Error(firstError.message);
  }

  return {
    exportedAt: new Date().toISOString(),
    patients: patients.data ?? [],
    reports: reports.data ?? [],
    templates: templates.data ?? [],
    settings: settings.data ?? [],
    profiles: profiles.data ?? [],
  };
}
