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

function whenIdle(run: () => void, timeout: number) {
  const w = window as any;
  if (typeof w.requestIdleCallback === "function") {
    w.requestIdleCallback(run, { timeout });
  } else {
    setTimeout(run, 2000);
  }
}

/** Warm the pages staff use most, once the browser is idle. */
export function preloadCommonRoutes() {
  whenIdle(() => ["/reports", "/patients", "/reports/new", "/patients/new"].forEach(preloadRoute), 4000);
}

let pdfWarmed = false;

/** Download the (large) PDF engine and the report layout ahead of the first click. */
export function preloadPdfEngine() {
  if (pdfWarmed) return;
  pdfWarmed = true;
  import("@react-pdf/renderer").catch(() => { pdfWarmed = false; });
  import("@/components/shared/LabReportPDF").catch(() => { pdfWarmed = false; });
}

/** Same as preloadPdfEngine, but waits for the browser to be idle (for page-mount use). */
export function preloadPdfEngineWhenIdle() {
  whenIdle(preloadPdfEngine, 6000);
}
