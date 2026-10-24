import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

import TemplateForm from "@/components/shared/TemplateForm";
import { getTemplate } from "@/lib/services/templates";
import type { TemplateWithFields } from "@/types";

export default function NewTemplatePage() {
  const [searchParams] = useSearchParams();
  const duplicateId = searchParams.get("duplicateId");
  const [sourceTemplate, setSourceTemplate] = useState<TemplateWithFields | null>(null);
  const [loading, setLoading] = useState(Boolean(duplicateId));

  useEffect(() => {
    if (!duplicateId) {
      setLoading(false);
      return;
    }
    getTemplate(duplicateId)
      .then(setSourceTemplate)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [duplicateId]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex items-center gap-4">
        <Link to="/admin/templates" className="btn btn-ghost btn-icon">
          <ArrowLeft className="h-4 w-4 text-slate-500" />
        </Link>
        <div>
          <h1 className="page-title">{sourceTemplate ? `Duplicate: ${sourceTemplate.name}` : "New Test Template"}</h1>
          <p className="page-subtitle">
            {sourceTemplate
              ? "Customize this copy and save as a new template"
              : "Define the test name, category, and all result fields"}
          </p>
        </div>
      </div>
      <TemplateForm mode="new" initial={sourceTemplate ?? undefined} />
    </div>
  );
}
