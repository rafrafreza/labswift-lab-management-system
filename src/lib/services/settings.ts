import { supabase } from "@/lib/supabase";
import { mapSettings } from "@/lib/services/helpers";

export async function getSettings() {
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

export async function updateSettings(payload: Record<string, unknown>) {
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
