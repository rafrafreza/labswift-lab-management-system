import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { ProtectedRoute } from "@/components/routing/ProtectedRoute";

const AnalyticsPage     = lazy(() => import("@/pages/admin/AnalyticsPage"));
const DoctorsPage       = lazy(() => import("@/pages/admin/DoctorsPage"));
const IncentivesPage    = lazy(() => import("@/pages/admin/IncentivesPage"));
const SettingsPage      = lazy(() => import("@/pages/admin/SettingsPage"));
const EditTemplatePage  = lazy(() => import("@/pages/admin/templates/EditTemplatePage"));
const NewTemplatePage   = lazy(() => import("@/pages/admin/templates/NewTemplatePage"));
const TemplatesPage     = lazy(() => import("@/pages/admin/templates/TemplatesPage"));
const UsersPage         = lazy(() => import("@/pages/admin/UsersPage"));
const LoginPage         = lazy(() => import("@/pages/LoginPage"));
const NotFoundPage      = lazy(() => import("@/pages/NotFoundPage"));
const DashboardPage     = lazy(() => import("@/pages/DashboardPage"));
const RootRedirect      = lazy(() => import("@/pages/RootRedirect"));
const EditPatientPage   = lazy(() => import("@/pages/patients/EditPatientPage"));
const NewPatientPage    = lazy(() => import("@/pages/patients/NewPatientPage"));
const PatientDetailPage = lazy(() => import("@/pages/patients/PatientDetailPage"));
const PatientsPage      = lazy(() => import("@/pages/patients/PatientsPage"));
const EditReportPage    = lazy(() => import("@/pages/reports/EditReportPage"));
const NewReportPage     = lazy(() => import("@/pages/reports/NewReportPage"));
const ReportDetailPage  = lazy(() => import("@/pages/reports/ReportDetailPage"));
const ReportsPage       = lazy(() => import("@/pages/reports/ReportsPage"));

// Full-screen dark fallback matching your app's background
const PageLoader = () => (
  <div className="min-h-screen bg-[#0a1628]" />
);

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/patients" element={<PatientsPage />} />
            <Route path="/patients/new" element={<NewPatientPage />} />
            <Route path="/patients/:id" element={<PatientDetailPage />} />
            <Route path="/patients/:id/edit" element={<EditPatientPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/reports/new" element={<NewReportPage />} />
            <Route path="/reports/:id" element={<ReportDetailPage />} />
            <Route path="/reports/:id/edit" element={<EditReportPage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute adminOnly />}>
          <Route element={<DashboardLayout />}>
            <Route path="/admin/templates" element={<TemplatesPage />} />
            <Route path="/admin/templates/new" element={<NewTemplatePage />} />
            <Route path="/admin/templates/:id/edit" element={<EditTemplatePage />} />
            <Route path="/admin/users" element={<UsersPage />} />
            <Route path="/admin/analytics" element={<AnalyticsPage />} />
            <Route path="/admin/settings" element={<SettingsPage />} />
            <Route path="/admin/doctors" element={<DoctorsPage />} />
            <Route path="/admin/incentives" element={<IncentivesPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}