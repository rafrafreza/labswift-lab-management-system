import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "@/hooks/useAuth";
import { isPasswordSetupPending } from "@/lib/passwordSetup";

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
        <p className="text-sm text-slate-500">Loading LabSwift...</p>
      </div>
    </div>
  );
}

export function ProtectedRoute({ adminOnly = false }: { adminOnly?: boolean }) {
  const location = useLocation();
  const { user, profile, loading, isAdmin } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!profile) {
    return (
      <Navigate
        to={`/login?callbackUrl=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    );
  }

  // Arrived through an invitation / reset link and has not chosen a password yet: the login page handles that
  if (isPasswordSetupPending(user)) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
