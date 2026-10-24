import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";

import TemplateForm from "@/components/shared/TemplateForm";
import { getTemplate } from "@/lib/services/templates";
import type { TemplateWithFields } from "@/types";

export default function EditTemplatePage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [template, setTemplate] = useState<TemplateWithFields | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTemplate(id)
      .then(setTemplate)
      .catch(() => navigate("/admin/templates", { replace: true }))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
      </div>
    );
  }

  if (!template) {
    return null;
  }

  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex items-center gap-4">
        <Link to="/admin/templates" className="btn btn-ghost btn-icon">
          <ArrowLeft className="h-4 w-4 text-slate-500" />
        </Link>
        <div>
          <h1 className="page-title">Edit Template</h1>
          <p className="page-subtitle">
            {template.name} · {template.fields.length} fields
          </p>
        </div>
      </div>
      <TemplateForm mode="edit" initial={template} />
    </div>
  );
}
