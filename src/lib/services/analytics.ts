import { startOfDay, startOfMonth } from "date-fns";

import { supabase } from "@/lib/supabase";
import { mapDashboardStats } from "@/lib/services/helpers";

export async function getDashboardStats() {
  const todayStart = startOfDay(new Date()).toISOString();
  const monthStart = startOfMonth(new Date()).toISOString();

  const [
    totalPatientsRes,
    totalReportsRes,
    reportsTodayRes,
    reportsMonthRes,
    draftsRes,
    templateUsageRes,
  ] = await Promise.all([
    supabase.from("patients").select("id", { count: "exact", head: true }),
    supabase.from("reports").select("id", { count: "exact", head: true }),
    supabase.from("reports").select("id", { count: "exact", head: true }).gte("createdAt", todayStart),
    supabase.from("reports").select("id", { count: "exact", head: true }).gte("createdAt", monthStart),
    supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "DRAFT"),
    supabase.from("test_templates").select("id, name, reports(count)"),
  ]);

  const errors = [
    totalPatientsRes.error,
    totalReportsRes.error,
    reportsTodayRes.error,
    reportsMonthRes.error,
    draftsRes.error,
    templateUsageRes.error,
  ].filter(Boolean);

  if (errors.length > 0) {
    throw new Error(errors[0]?.message ?? "Failed to load analytics.");
  }

  const topTests = (templateUsageRes.data ?? [])
    .map((t: any) => ({ name: t.name as string, count: Number(t.reports?.[0]?.count ?? 0) }))
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

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
