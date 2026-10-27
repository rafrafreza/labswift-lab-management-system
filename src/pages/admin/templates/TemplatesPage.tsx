import { useEffect, useState } from "react";
import { Copy, Edit2, FlaskConical, Plus, ToggleLeft, ToggleRight } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { ErrorState, getLoadErrorMessage } from "@/components/shared/PageState";
import { listTemplates, updateTemplate } from "@/lib/services/templates";
import type { TemplateWithFields } from "@/types";

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<TemplateWithFields[]>([]);
  const [loading, setLoading] = useState(true);

  const [loadError, setLoadError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await listTemplates(false, true);
      setTemplates(data);
    } catch (err) {
      setLoadError(getLoadErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function toggleActive(template: TemplateWithFields) {
    try {
      await updateTemplate(template.id, {
        name: template.name,
        category: template.category,
        description: template.description || "",
        price: template.price != null ? String(template.price) : "",
        isActive: !template.isActive,
        fields: template.fields.map((field) => ({
          id: field.id,
          fieldName: field.fieldName,
          unit: field.unit || "",
          normalRangeText: field.normalRangeText || "",
          normalRangeMin: field.normalRangeMin != null ? String(field.normalRangeMin) : "",
          normalRangeMax: field.normalRangeMax != null ? String(field.normalRangeMax) : "",
          fieldType: field.fieldType,
          section: field.section || "",
          isBold: field.isBold,
        })),
      });
      toast.success(`Template ${template.isActive ? "deactivated" : "activated"}`);
      void load();
    } catch {
      toast.error("Failed to update template");
    }
  }

  const grouped = templates.reduce((groups, template) => {
    groups[template.category] ??= [];
    groups[template.category].push(template);
    return groups;
  }, {} as Record<string, TemplateWithFields[]>);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Test Templates</h1>
          <p className="page-subtitle">
            {templates.length} templates · {templates.filter((template) => template.isActive).length} active
          </p>
        </div>
        <Link to="/admin/templates/new" className="btn btn-primary">
          <Plus className="h-4 w-4" /> New Template
        </Link>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, index) => (
            <div key={index} className="card space-y-3 p-5">
              <div className="h-4 w-32 animate-pulse rounded bg-slate-100" />
              {[...Array(3)].map((_, itemIndex) => (
                <div key={itemIndex} className="h-14 animate-pulse rounded-lg bg-slate-50" />
              ))}
            </div>
          ))}
        </div>
      ) : loadError ? (
        <ErrorState title="Couldn't load templates" message={loadError} onRetry={() => void load()} />
      ) : Object.keys(grouped).length === 0 ? (
        <div className="card p-16 text-center">
          <FlaskConical className="mx-auto mb-4 h-12 w-12 text-slate-200" />
          <h2 className="mb-1 font-medium text-slate-500">No templates yet</h2>
          <p className="mb-5 text-sm text-slate-400">Create your first test template to start generating reports</p>
          <Link to="/admin/templates/new" className="btn btn-primary">
            <Plus className="h-4 w-4" /> Create Template
          </Link>
        </div>
      ) : (
        Object.entries(grouped).map(([category, items]) => (
          <div key={category} className="card overflow-hidden">
            <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-600">{category}</h2>
            </div>

            <div className="divide-y divide-slate-100">
              {items.map((template) => (
                <div
                  key={template.id}
                  className={`flex items-center gap-4 px-5 py-4 transition-colors ${!template.isActive ? "opacity-50" : "hover:bg-slate-50/50"}`}
                >
                  <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${template.isActive ? "bg-teal-100" : "bg-slate-100"}`}>
                    <FlaskConical className={`h-5 w-5 ${template.isActive ? "text-teal-700" : "text-slate-400"}`} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">{template.name}</span>
                      {!template.isActive && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-500">Inactive</span>}
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-slate-400">
                      <span>{template.fields.length} parameters</span>
                      {template.price && <span>Rs.{Number(template.price)}</span>}
                      {template._count?.reports != null && <span>{template._count.reports} report{template._count.reports !== 1 ? "s" : ""} generated</span>}
                    </div>
                  </div>

                  <div className="hidden max-w-xs flex-wrap items-center gap-1.5 lg:flex">
                    {template.fields.slice(0, 4).map((field) => (
                      <span key={field.id} className="max-w-24 truncate rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        {field.fieldName}
                      </span>
                    ))}
                    {template.fields.length > 4 && <span className="text-xs text-slate-400">+{template.fields.length - 4} more</span>}
                  </div>

                  <div className="flex flex-shrink-0 items-center gap-2">
                    <button onClick={() => void toggleActive(template)} title={template.isActive ? "Deactivate" : "Activate"} className="btn btn-ghost btn-icon btn-sm text-slate-400 hover:text-teal-700">
                      {template.isActive ? <ToggleRight className="h-5 w-5 text-teal-600" /> : <ToggleLeft className="h-5 w-5" />}
                    </button>
                    <Link to={`/admin/templates/new?duplicateId=${template.id}`} title="Duplicate as new template" className="btn btn-secondary btn-sm text-slate-600">
                      <Copy className="h-3.5 w-3.5" /> Duplicate
                    </Link>
                    <Link to={`/admin/templates/${template.id}/edit`} className="btn btn-secondary btn-sm">
                      <Edit2 className="h-3.5 w-3.5" /> Edit
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
