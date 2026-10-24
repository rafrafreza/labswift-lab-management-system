import { supabase } from "@/lib/supabase";
import { mapProfile } from "@/lib/services/helpers";

export async function getProfile(userId: string) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (error) {
    throw new Error(error.message);
  }
  return mapProfile(data);
}
