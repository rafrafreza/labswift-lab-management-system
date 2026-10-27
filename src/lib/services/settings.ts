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

async function writeSettings(payload: Record<string, unknown>) {
  let { data, error } = await supabase
    .from("lab_settings")
    .upsert({ id: "singleton", ...payload }, { onConflict: "id" })
    .select("*")
    .single();

  if (error && (error.message?.includes("useSignature") || error.details?.includes("useSignature"))) {
    const fallbackPayload = { ...payload };
    delete fallbackPayload.useSignature;
    const retry = await supabase
      .from("lab_settings")
      .upsert({ id: "singleton", ...fallbackPayload }, { onConflict: "id" })
      .select("*")
      .single();
    if (retry.error) throw new Error(retry.error.message);
    return mapSettings({
      ...retry.data,
      useSignature: payload.useSignature,
    });
  }

  if (error) {
    throw new Error(error.message);
  }

  return mapSettings(data);
}
