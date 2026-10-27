import { createClient } from "@supabase/supabase-js";

import { markPasswordSetupPending } from "@/lib/passwordSetup";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables.");
}

// Supabase strips the auth params from the URL as soon as the client initialises,
// and the PASSWORD_RECOVERY event can fire before LoginPage subscribes, so capture them first.
const authHashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
export const authLinkType = authHashParams.get("type");
export const authLinkError = authHashParams.get("error_description");

// An invitation or reset link signs the browser in, so remember (persistently) that a password must still be chosen
if (authLinkType === "invite" || authLinkType === "recovery") {
  markPasswordSetupPending(authLinkType);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "labswift-auth",
  },
});

export const BUCKETS = {
  LAB_ASSETS: "lab-assets",
} as const;

export function getPublicUrl(bucket: string, path: string): string {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadFile(bucket: string, path: string, file: File): Promise<string> {
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: true,
  });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  return getPublicUrl(bucket, path);
}
