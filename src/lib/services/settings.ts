import { cached, invalidate } from "@/lib/cache";
import { supabase } from "@/lib/supabase";
import { mapSettings } from "@/lib/services/helpers";

async function fetchSettings() {
  const { data, error } = await supabase.from("lab_settings").select("*").eq("id", "singleton").maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  if (data) {
    return mapSettings(data);
  }

  const { data: created, error: createError } = await supabase
    .from("lab_settings")
    .insert({ id: "singleton" })
    .select("*")
    .single();

  if (createError) {
    throw new Error(createError.message);
  }

  return mapSettings(created);
}

export function getSettings() {
  return cached("settings", 5 * 60 * 1000, fetchSettings);
}

export async function updateSettings(payload: Record<string, unknown>) {
  try {
    return await writeSettings(payload);
  } finally {
    invalidate("settings"); // after the write, so a read during the save can't re-cache the old values
  }
}

// Columns added by later migrations. If one is missing (migration not run yet, or PostgREST's schema cache is stale)
// the save is retried without it so the rest of the settings still persist.
const OPTIONAL_COLUMNS = ["useSignature", "showQrCode"] as const;

async function writeSettings(payload: Record<string, unknown>) {
  const attempt = (body: Record<string, unknown>) =>
    supabase.from("lab_settings").upsert({ id: "singleton", ...body }, { onConflict: "id" }).select("*").single();

  const { data, error } = await attempt(payload);

  if (error) {
    const text = `${error.message ?? ""} ${error.details ?? ""}`;
    const missing = OPTIONAL_COLUMNS.filter((col) => text.includes(col));
    if (missing.length) {
      const fallback = { ...payload };
      for (const col of missing) delete fallback[col];
      const retry = await attempt(fallback);
      if (retry.error) throw new Error(retry.error.message);
      const kept: Record<string, unknown> = {};
      for (const col of missing) kept[col] = payload[col];
      return mapSettings({ ...retry.data, ...kept });
    }
    throw new Error(error.message);
  }

  return mapSettings(data);
}
