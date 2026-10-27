import { cached, invalidate } from "@/lib/cache";
import { supabase } from "@/lib/supabase";
import { mapTemplate, requireUserId } from "@/lib/services/helpers";
import type { TemplateWithFields } from "@/types";

export type TemplatePayload = {
  name: string;
  category: string;
  description?: string;
  price?: string;
  isActive?: boolean;
  fields: Array<{
    id?: string;
    fieldName: string;
    unit?: string;
    normalRangeText?: string;
    normalRangeMin?: string;
    normalRangeMax?: string;
    normalRangeTextMale?: string;
    normalRangeMinMale?: string;
    normalRangeMaxMale?: string;
    normalRangeTextFemale?: string;
    normalRangeMinFemale?: string;
    normalRangeMaxFemale?: string;
    fieldType: "NUMBER" | "TEXT" | "SELECT" | "POSITIVE_NEGATIVE" | "REACTIVE" | "WIDAL" | "URINE_ROUTINE";
    section?: string;
    isBold?: boolean;
  }>;
};

const TEMPLATE_SELECT = `
  *,
  fields:template_fields (*)
`;

// Adds a per-template report count (aggregated by the database, not a list of ids)
const TEMPLATE_SELECT_WITH_COUNTS = `
  *,
  fields:template_fields (*),
  reports (count)
`;

const TEMPLATES_TTL_MS = 2 * 60 * 1000;

function buildFieldRecord(field: TemplatePayload["fields"][number], extra: { templateId?: string; sortOrder: number }) {
  return {
    ...(extra.templateId ? { templateId: extra.templateId } : {}),
    fieldName: field.fieldName.trim(),
    unit: field.unit?.trim() || null,
    normalRangeText: field.normalRangeText?.trim() || null,
    normalRangeMin: field.normalRangeMin ? Number(field.normalRangeMin) : null,
    normalRangeMax: field.normalRangeMax ? Number(field.normalRangeMax) : null,
    normalRangeTextMale: field.normalRangeTextMale?.trim() || null,
    normalRangeMinMale: field.normalRangeMinMale ? Number(field.normalRangeMinMale) : null,
    normalRangeMaxMale: field.normalRangeMaxMale ? Number(field.normalRangeMaxMale) : null,
    normalRangeTextFemale: field.normalRangeTextFemale?.trim() || null,
    normalRangeMinFemale: field.normalRangeMinFemale ? Number(field.normalRangeMinFemale) : null,
    normalRangeMaxFemale: field.normalRangeMaxFemale ? Number(field.normalRangeMaxFemale) : null,
    fieldType: field.fieldType,
    section: field.section?.trim() || null,
    sortOrder: extra.sortOrder,
    isBold: field.isBold ?? false,
  };
}

async function fetchTemplates(activeOnly: boolean, withCounts: boolean) {
  let query = supabase
    .from("test_templates")
    .select(withCounts ? TEMPLATE_SELECT_WITH_COUNTS : TEMPLATE_SELECT)
    .order("category")
    .order("name");
  if (activeOnly) query = query.eq("isActive", true);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapTemplate);
}

/** The picker list (active, no counts) is cached; pass withCounts for the admin Templates page. */
export function listTemplates(activeOnly = true, withCounts = false) {
  if (activeOnly && !withCounts) {
    return cached("templates:active", TEMPLATES_TTL_MS, () => fetchTemplates(true, false));
  }
  return fetchTemplates(activeOnly, withCounts);
}

export async function getTemplate(id: string) {
  const { data, error } = await supabase
    .from("test_templates")
    .select(TEMPLATE_SELECT)
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return mapTemplate(data);
}

export async function createTemplate(payload: TemplatePayload) {
  const userId = await requireUserId();
  const { data: template, error } = await supabase
    .from("test_templates")
    .insert({
      name: payload.name.trim(),
      category: payload.category.trim(),
      description: payload.description?.trim() || null,
      price: payload.price ? Number(payload.price) : null,
      createdById: userId,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  invalidate("templates");

  if (payload.fields.length) {
    const { error: fieldsError } = await supabase.from("template_fields").insert(
      payload.fields.map((field, index) =>
        buildFieldRecord(field, { templateId: template.id, sortOrder: index }),
      ),
    );
    if (fieldsError) throw new Error(fieldsError.message);
  }

  return getTemplate(template.id);
}

export async function updateTemplate(id: string, payload: TemplatePayload) {
  const { error } = await supabase
    .from("test_templates")
    .update({
      name: payload.name.trim(),
      category: payload.category.trim(),
      description: payload.description?.trim() || null,
      price: payload.price ? Number(payload.price) : null,
      isActive: payload.isActive ?? true,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  invalidate("templates");

  const existing = await getTemplate(id);
  const nextIds = payload.fields.filter((f) => f.id).map((f) => f.id as string);
  const removedIds = existing.fields.filter((f) => !nextIds.includes(f.id)).map((f) => f.id);

  if (removedIds.length) {
    // Check if any removed fields are referenced by existing reports
    const { data: usedRows } = await supabase
      .from("report_values")
      .select("fieldId")
      .in("fieldId", removedIds);

    const usedFieldIds = new Set((usedRows ?? []).map((r: any) => r.fieldId));
    const safeToDelete = removedIds.filter((fId) => !usedFieldIds.has(fId));
    const mustKeep = removedIds.filter((fId) => usedFieldIds.has(fId));

    if (safeToDelete.length) {
      const { error: deleteError } = await supabase.from("template_fields").delete().in("id", safeToDelete);
      if (deleteError) console.warn("Failed to delete unused template fields:", deleteError.message);
    }

    if (mustKeep.length) {
      // Soft-deactivate fields that belong to past reports so past reports retain their data
      const { error: deactError } = await supabase
        .from("template_fields")
        .update({ isActive: false })
        .in("id", mustKeep);
      if (deactError) console.warn("Failed to deactivate used template fields:", deactError.message);
    }
  }

  for (const [index, field] of payload.fields.entries()) {
    const record = buildFieldRecord(field, { sortOrder: index });
    if (field.id) {
      const { error: updateError } = await supabase.from("template_fields").update(record).eq("id", field.id);
      if (updateError) throw new Error(updateError.message);
    } else {
      const { error: insertError } = await supabase.from("template_fields").insert({ ...record, templateId: id });
      if (insertError) throw new Error(insertError.message);
    }
  }

  invalidate("templates");
  return getTemplate(id);
}

export async function deleteTemplate(template: TemplateWithFields) {
  const reportCount = template._count?.reports ?? 0;
  invalidate("templates");
  if (reportCount > 0) {
    const { error } = await supabase.from("test_templates").update({ isActive: false }).eq("id", template.id);
    if (error) throw new Error(error.message);
    return { deactivated: true };
  }
  const { error } = await supabase.from("test_templates").delete().eq("id", template.id);
  if (error) throw new Error(error.message);
  return { deactivated: false };
}