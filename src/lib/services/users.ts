import { supabase } from "@/lib/supabase";
import { mapProfile } from "@/lib/services/helpers";
import type { Role } from "@/types";

export async function listUsers() {
  const { data, error } = await supabase.from("profiles").select("*").order("role").order("name");
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []).map(mapProfile);
}

export async function updateUser(userId: string, payload: { role?: Role; isActive?: boolean }) {
  const { data, error } = await supabase.from("profiles").update(payload).eq("id", userId).select("*").single();
  if (error) {
    throw new Error(error.message);
  }
  return mapProfile(data);
}

export async function inviteUser(payload: { email: string; name: string; role: Role }) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { data, error } = await supabase.functions.invoke("invite-user", {
    body: payload,
    headers: session?.access_token
      ? {
          Authorization: `Bearer ${session.access_token}`,
        }
      : undefined,
  });

  if (error) {
    const lower = error.message.toLowerCase();
    const message = lower.includes("network request failed") || lower.includes("failed to fetch") || lower.includes("cors")
      ? "Invite function is not deployed or not accessible. Deploy the Supabase Edge Function and configure CORS for your app."
      : error.message;
    throw new Error(message);
  }

  if (data?.message) {
    return data;
  }

  return { message: "Invitation sent" };
}
