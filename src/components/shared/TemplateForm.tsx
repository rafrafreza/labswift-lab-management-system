"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronUp, Copy, Plus, Save, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { createTemplate, updateTemplate } from "@/lib/services/templates";
import type { TemplateWithFields } from "@/types";

type FieldDraft = {
  id?: string;
  fieldName: string;
  unit: string;
  normalRangeText: string;
  normalRangeMin: string;
  normalRangeMax: string;
  normalRangeTextMale: string;
  normalRangeMinMale: string;
  normalRangeMaxMale: string;
  normalRangeTextFemale: string;
  normalRangeMinFemale: string;
  normalRangeMaxFemale: string;
  fieldType: "NUMBER" | "TEXT" | "SELECT" | "POSITIVE_NEGATIVE" | "REACTIVE" | "WIDAL" | "URINE_ROUTINE";
  section: string;
  isBold: boolean;
  showGender?: boolean;
};

type Props = {
  mode: "new" | "edit";
  initial?: TemplateWithFields & { isActive?: boolean };
};

function emptyField(): FieldDraft {
  return {
    fieldName: "",
    unit: "",
    normalRangeText: "",
    normalRangeMin: "",
    normalRangeMax: "",
    normalRangeTextMale: "",
    normalRangeMinMale: "",
    normalRangeMaxMale: "",
    normalRangeTextFemale: "",
    normalRangeMinFemale: "",
    normalRangeMaxFemale: "",
    fieldType: "NUMBER",
    section: "",
    isBold: false,
    showGender: false,
  };
}

export default function TemplateForm({ mode, initial }: Props) {
  const navigate = useNavigate();

  // ✅ Unique key per template (new vs edit) so drafts don't mix
  const DRAFT_KEY = initial?.id && mode === "edit" ? `template-draft-${initial.id}` : `template-draft-new`;

  // ✅ All state reads from sessionStorage first, falls back to initial/empty
  const [name, setName] = useState(() => {
    const draft = sessionStorage.getItem(DRAFT_KEY);
    if (draft) return JSON.parse(draft).name;
    if (initial) {
      return mode === "new" ? `${initial.name} (Copy)` : initial.name;
    }
    return "";
  });

  const [category, setCategory] = useState(() => {
    const draft = sessionStorage.getItem(DRAFT_KEY);
    return draft ? JSON.parse(draft).category : (initial?.category || "");
  });

  const [desc, setDesc] = useState(() => {
    const draft = sessionStorage.getItem(DRAFT_KEY);
    return draft ? JSON.parse(draft).desc : (initial?.description || "");
  });

  const [price, setPrice] = useState(() => {
    const draft = sessionStorage.getItem(DRAFT_KEY);
    return draft ? JSON.parse(draft).price : (initial?.price != null ? String(initial.price) : "");
  });

  const [isActive, setIsActive] = useState(() => {
    const draft = sessionStorage.getItem(DRAFT_KEY);
    return draft ? JSON.parse(draft).isActive : (initial?.isActive ?? true);
  });

  const [fields, setFields] = useState<FieldDraft[]>(() => {
    const draft = sessionStorage.getItem(DRAFT_KEY);
    if (draft) return JSON.parse(draft).fields;
    return initial?.fields.map((field) => ({
      id: mode === "edit" ? field.id : undefined,
      fieldName: field.fieldName,
      unit: field.unit || "",
      normalRangeText: field.normalRangeText || "",
      normalRangeMin: field.normalRangeMin != null ? String(field.normalRangeMin) : "",
      normalRangeMax: field.normalRangeMax != null ? String(field.normalRangeMax) : "",
      normalRangeTextMale: field.normalRangeTextMale || "",
      normalRangeMinMale: field.normalRangeMinMale != null ? String(field.normalRangeMinMale) : "",
      normalRangeMaxMale: field.normalRangeMaxMale != null ? String(field.normalRangeMaxMale) : "",
      normalRangeTextFemale: field.normalRangeTextFemale || "",
      normalRangeMinFemale: field.normalRangeMinFemale != null ? String(field.normalRangeMinFemale) : "",
      normalRangeMaxFemale: field.normalRangeMaxFemale != null ? String(field.normalRangeMaxFemale) : "",
      fieldType: field.fieldType,
      section: field.section || "",
      isBold: field.isBold,
      showGender: !!(field.normalRangeTextMale || field.normalRangeTextFemale || field.normalRangeMinMale || field.normalRangeMinFemale),
    })) || [emptyField()];
  });

  const [saving, setSaving] = useState(false);

  // ✅ Auto-save draft to sessionStorage on every change
  useEffect(() => {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ name, category, desc, price, isActive, fields }));
  }, [name, category, desc, price, isActive, fields]);

  function addField() {
    setFields((prev) => [...prev, emptyField()]);
    setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }), 50);
  }

  function removeField(index: number) {
    setFields((prev) => prev.filter((_, i) => i !== index));
  }

  function updateField(index: number, key: keyof FieldDraft, value: string | boolean) {
    setFields((prev) => prev.map((field, i) => (i === index ? { ...field, [key]: value } : field)));
  }

  function toggleGender(index: number) {
    setFields((prev) => prev.map((field, i) => i === index ? { ...field, showGender: !field.showGender } : field));
  }

  function moveField(index: number, direction: "up" | "down") {
    const next = [...fields];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= next.length) return;
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    setFields(next);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!name.trim() || !category.trim()) {
      toast.error("Template name and category are required");
      return;
    }
    if (fields.some((f) => !f.fieldName.trim())) {
      toast.error("All fields must have a name");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name, category, description: desc, price, isActive,
        fields: fields.map((f) => ({
          id: f.id,
          fieldName: f.fieldName,
          unit: f.unit,
          normalRangeText: f.normalRangeText,
          normalRangeMin: f.normalRangeMin,
          normalRangeMax: f.normalRangeMax,
          normalRangeTextMale: f.normalRangeTextMale || undefined,
          normalRangeMinMale: f.normalRangeMinMale || undefined,
          normalRangeMaxMale: f.normalRangeMaxMale || undefined,
          normalRangeTextFemale: f.normalRangeTextFemale || undefined,
          normalRangeMinFemale: f.normalRangeMinFemale || undefined,
          normalRangeMaxFemale: f.normalRangeMaxFemale || undefined,
          fieldType: f.fieldType,
          section: f.section,
          isBold: f.isBold,
        })),
      };

      if (mode === "new") {
        await createTemplate(payload);
        toast.success("Template created");
      } else if (initial) {
        await updateTemplate(initial.id, payload);
        toast.success("Template updated");
      }

      // ✅ Clear draft after successful save
      sessionStorage.removeItem(DRAFT_KEY);
      navigate("/admin/templates");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save template");
    } finally {
      setSaving(false);
    }
  }

  const categories = ["Haematology","Biochemistry","Microbiology","Immunology","Serology","Urine Analysis","Hormone","Other"];

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Template meta */}
      <div className="card p-6">
        <h2 className="mb-4 border-b border-slate-100 pb-2 text-sm font-semibold text-slate-800">
          Template Details
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 sm:col-span-1">
            <label className="form-label">Test Name <span className="text-red-500">*</span></label>
            <input type="text" className="form-input" value={name}
              onChange={(e) => setName(e.target.value)} placeholder="e.g. Complete Blood Count (CBC)" />
          </div>
          <div>
            <label className="form-label">Category <span className="text-red-500">*</span></label>
            <input list="categories" className="form-input" value={category}
              onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Haematology" />
            <datalist id="categories">
              {categories.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
          <div>
            <label className="form-label">Price (Rs.)</label>
            <input type="number" min="0" step="0.01" className="form-input" value={price}
              onChange={(e) => setPrice(e.target.value)} placeholder="e.g. 250" />
          </div>
          <div className="col-span-2">
            <label className="form-label">Description (optional)</label>
            <input type="text" className="form-input" value={desc}
              onChange={(e) => setDesc(e.target.value)} placeholder="Brief description of this test" />
          </div>
          {mode === "edit" && (
            <div className="col-span-2 flex items-center gap-3">
              <label className="text-sm font-medium text-slate-700">Active</label>
              <button type="button" onClick={() => setIsActive(!isActive)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isActive ? "bg-teal-600" : "bg-slate-200"}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${isActive ? "translate-x-6" : "translate-x-1"}`} />
              </button>
              <span className="text-xs text-slate-500">
                {isActive ? "Visible to staff for new reports" : "Hidden from report creation"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Fields */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Test Parameters</h2>
            <p className="mt-0.5 text-xs text-slate-400">
              {fields.length} field{fields.length !== 1 ? "s" : ""} · Use the gender toggle per field to set gender-specific ranges
            </p>
          </div>
          <button type="button" onClick={addField} className="btn btn-secondary btn-sm">
            <Plus className="h-3.5 w-3.5" /> Add Field
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {fields.map((field, index) => (
            <div key={`${field.id ?? "new"}-${index}`} className="px-5 py-3 hover:bg-slate-50/30">
              <div className="grid grid-cols-12 items-center gap-2">
                <div className="col-span-1 flex items-center gap-1">
                  <div className="flex flex-col gap-0.5">
                    <button type="button" onClick={() => moveField(index, "up")} disabled={index === 0}
                      className="p-0.5 text-slate-300 hover:text-slate-600 disabled:opacity-20">
                      <ChevronUp className="h-3 w-3" />
                    </button>
                    <button type="button" onClick={() => moveField(index, "down")} disabled={index === fields.length - 1}
                      className="p-0.5 text-slate-300 hover:text-slate-600 disabled:opacity-20">
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </div>
                  <span className="w-4 text-right text-xs text-slate-300">{index + 1}</span>
                </div>

                <div className="col-span-3">
                  <input type="text" className="form-input py-1.5 text-sm" value={field.fieldName}
                    onChange={(e) => updateField(index, "fieldName", e.target.value)}
                    placeholder="e.g. Haemoglobin" />
                </div>

                <div className="col-span-1">
                  <input type="text" className="form-input py-1.5 text-sm" value={field.unit}
                    onChange={(e) => updateField(index, "unit", e.target.value)} placeholder="g/dL" />
                </div>

                <div className="col-span-2">
                  <select className="form-input py-1.5 text-xs" value={field.fieldType}
                    onChange={(e) => updateField(index, "fieldType", e.target.value)}>
                    <option value="NUMBER">Number</option>
                    <option value="TEXT">Text</option>
                    <option value="SELECT">Select</option>
                    <option value="POSITIVE_NEGATIVE">+/− (Pos/Neg)</option>
                    <option value="REACTIVE">Reactive/Non</option>
                    <option value="WIDAL">Widal Grid</option>
                  </select>
                </div>

                {!["WIDAL", "POSITIVE_NEGATIVE", "REACTIVE"].includes(field.fieldType) && (
                  <div className="col-span-2">
                    <input type="text" className="form-input py-1.5 text-sm" value={field.normalRangeText}
                      onChange={(e) => updateField(index, "normalRangeText", e.target.value)}
                      placeholder="e.g. 13.0-17.0" />
                  </div>
                )}
                {["POSITIVE_NEGATIVE", "REACTIVE"].includes(field.fieldType) && (
                  <div className="col-span-2">
                    <input type="text" className="form-input py-1.5 text-sm" value={field.normalRangeText}
                      onChange={(e) => updateField(index, "normalRangeText", e.target.value)}
                      placeholder={field.fieldType === "REACTIVE" ? "NON-REACTIVE" : "NEGATIVE"} />
                  </div>
                )}
                {field.fieldType === "WIDAL" && (
                  <div className="col-span-2 flex items-center">
                    <span className="text-xs text-slate-400 italic">Grid — no range</span>
                  </div>
                )}

                <div className="col-span-1">
                  <input type="number" step="any" className="form-input py-1.5 text-sm" value={field.normalRangeMin}
                    onChange={(e) => updateField(index, "normalRangeMin", e.target.value)} placeholder="-" />
                </div>

                <div className="col-span-1">
                  <input type="number" step="any" className="form-input py-1.5 text-sm" value={field.normalRangeMax}
                    onChange={(e) => updateField(index, "normalRangeMax", e.target.value)} placeholder="-" />
                </div>

                <div className="col-span-1">
                  <input type="text" className="form-input py-1.5 text-sm" value={field.section}
                    onChange={(e) => updateField(index, "section", e.target.value)} placeholder="Group" />
                </div>

                <div className="col-span-2 flex items-center justify-end gap-2">
                  <button type="button" onClick={() => updateField(index, "isBold", !field.isBold)}
                    className={`flex h-5 w-5 items-center justify-center rounded border-2 transition-colors ${field.isBold ? "border-teal-600 bg-teal-600" : "border-slate-300"}`}
                    title="Bold parameter name in report">
                    {field.isBold && <span className="text-xs font-bold leading-none text-white">B</span>}
                  </button>

                  <button type="button" onClick={() => toggleGender(index)}
                    className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${field.showGender ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                    title="Set gender-specific normal ranges">
                    M/F
                  </button>

                  <button type="button" onClick={() => removeField(index)}
                    className="text-slate-300 hover:text-red-500">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {field.showGender && (
                <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/50 p-3">
                  <p className="mb-3 text-xs font-semibold text-blue-700">
                    Gender-Specific Ranges
                    <span className="ml-2 font-normal text-blue-500">
                      — leave blank to use the generic range above
                    </span>
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Male</div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-3">
                          <input type="text" className="form-input py-1.5 text-xs"
                            placeholder="Display text e.g. 13.0–17.0"
                            value={field.normalRangeTextMale}
                            onChange={(e) => updateField(index, "normalRangeTextMale", e.target.value)} />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-slate-400">Min</label>
                          <input type="number" step="any" className="form-input py-1.5 text-xs"
                            placeholder="-" value={field.normalRangeMinMale}
                            onChange={(e) => updateField(index, "normalRangeMinMale", e.target.value)} />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-slate-400">Max</label>
                          <input type="number" step="any" className="form-input py-1.5 text-xs"
                            placeholder="-" value={field.normalRangeMaxMale}
                            onChange={(e) => updateField(index, "normalRangeMaxMale", e.target.value)} />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Female</div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-3">
                          <input type="text" className="form-input py-1.5 text-xs"
                            placeholder="Display text e.g. 12.0–15.0"
                            value={field.normalRangeTextFemale}
                            onChange={(e) => updateField(index, "normalRangeTextFemale", e.target.value)} />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-slate-400">Min</label>
                          <input type="number" step="any" className="form-input py-1.5 text-xs"
                            placeholder="-" value={field.normalRangeMinFemale}
                            onChange={(e) => updateField(index, "normalRangeMinFemale", e.target.value)} />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-slate-400">Max</label>
                          <input type="number" step="any" className="form-input py-1.5 text-xs"
                            placeholder="-" value={field.normalRangeMaxFemale}
                            onChange={(e) => updateField(index, "normalRangeMaxFemale", e.target.value)} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {fields.length === 0 && (
          <div className="py-10 text-center text-slate-400">
            <p className="text-sm">No fields yet.</p>
            <button type="button" onClick={addField} className="mt-2 text-sm text-teal-700 hover:underline">
              Add first field →
            </button>
          </div>
        )}

        <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-3">
          <button type="button" onClick={addField} className="btn btn-ghost btn-sm text-teal-700">
            <Plus className="h-3.5 w-3.5" /> Add another field
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Link to="/admin/templates" className="btn btn-secondary">
          <ArrowLeft className="h-4 w-4" /> Cancel
        </Link>
        <div className="flex items-center gap-2">
          {mode === "edit" && initial && (
            <Link
              to={`/admin/templates/new?duplicateId=${initial.id}`}
              className="btn btn-secondary text-slate-700"
              title="Clone this template into a new one"
            >
              <Copy className="h-4 w-4" /> Duplicate as New
            </Link>
          )}
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? (
              <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Saving...</>
            ) : (
              <><Save className="h-4 w-4" /> {mode === "new" ? "Create Template" : "Save Changes"}</>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}