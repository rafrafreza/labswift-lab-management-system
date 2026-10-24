import { FlaskConical } from "lucide-react";
import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-100">
          <FlaskConical className="h-8 w-8 text-teal-700" />
        </div>
        <h1 className="mb-2 text-4xl font-bold text-slate-900">404</h1>
        <p className="mb-6 text-slate-500">Page not found</p>
        <Link to="/dashboard" className="btn btn-primary">
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
