// Starts downloading a page's code before the user navigates to it, so the click feels instant.
// These import() calls resolve to the same chunks as the lazy() routes in App.tsx.
const loaders: Record<string, () => Promise<unknown>> = {
  "/dashboard": () => import("@/pages/DashboardPage"),
  "/patients": () => import("@/pages/patients/PatientsPage"),
  "/reports": () => import("@/pages/reports/ReportsPage"),
  "/reports/new": () => import("@/pages/reports/NewReportPage"),
  "/patients/new": () => import("@/pages/patients/NewPatientPage"),
  "/admin/templates": () => import("@/pages/admin/templates/TemplatesPage"),
  "/admin/doctors": () => import("@/pages/admin/DoctorsPage"),
  "/admin/financials": () => import("@/pages/admin/FinancialsPage"),
  "/admin/incentives": () => import("@/pages/admin/IncentivesPage"),
  "/admin/users": () => import("@/pages/admin/UsersPage"),
  "/admin/analytics": () => import("@/pages/admin/AnalyticsPage"),
  "/admin/settings": () => import("@/pages/admin/SettingsPage"),
};

const started = new Set<string>();

export function preloadRoute(href: string) {
  if (started.has(href)) return;
  const load = loaders[href];
  if (!load) return;
  started.add(href);
  load().catch(() => started.delete(href)); // allow a retry if the network failed
}

/** Warm the pages staff use most, once the browser is idle. */
export function preloadCommonRoutes() {
  const run = () => ["/reports", "/patients", "/reports/new", "/patients/new"].forEach(preloadRoute);
  const w = window as any;
  if (typeof w.requestIdleCallback === "function") {
    w.requestIdleCallback(run, { timeout: 4000 });
  } else {
    setTimeout(run, 2000);
  }
}
