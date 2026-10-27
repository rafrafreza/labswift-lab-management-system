import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";

// Maximum invitations per rolling hour (limits abuse of a stolen admin session)
const MAX_INVITES_PER_HOUR = 20;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function originOf(url: string) {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

serve(async (request) => {
  const configuredAppUrl = Deno.env.get("APP_URL") ?? "";
  const appUrl = configuredAppUrl || "http://localhost:5173";
  // When APP_URL is set, only that origin (plus ALLOWED_ORIGINS, comma separated) may call this function from a
  // browser. When it is NOT set we cannot know which site is yours, so any origin is accepted rather than breaking
  // invites; the admin check below is the real protection (a request needs an admin's access token either way).
  const strictOrigins = Boolean(configuredAppUrl);
  const allowedOrigins = new Set(
    [originOf(appUrl), ...(Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((o) => o.trim())].filter(Boolean),
  );
  const requestOrigin = request.headers.get("Origin") ?? "";
  const corsHeaders: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
  if (requestOrigin && (!strictOrigins || allowedOrigins.has(requestOrigin))) {
    corsHeaders["Access-Control-Allow-Origin"] = requestOrigin;
  }

  const reply = (status: number, message: string) =>
    new Response(JSON.stringify({ message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return reply(405, "Method not allowed");
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      console.error("invite-user: missing Supabase function secrets");
      return reply(500, "The invite service is not configured.");
    }

    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return reply(401, "Unauthorized");
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return reply(401, "Unauthorized");
    }

    const { data: adminProfile, error: adminProfileError } = await adminClient
      .from("profiles")
      .select("role, isActive")
      .eq("id", user.id)
      .single();

    if (adminProfileError || adminProfile?.role !== "ADMIN" || !adminProfile?.isActive) {
      return reply(403, "Admin access required");
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return reply(400, "Invalid request");
    }

    const email = String(body.email ?? "").trim().toLowerCase();
    const name = String(body.name ?? "").trim();
    const role = body.role === "ADMIN" ? "ADMIN" : "STAFF";

    if (!email || !name) {
      return reply(400, "Email and name are required");
    }
    if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
      return reply(400, "Enter a valid email address");
    }
    if (name.length > 100) {
      return reply(400, "Name is too long");
    }

    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await adminClient
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .gte("createdAt", since);
    if ((count ?? 0) >= MAX_INVITES_PER_HOUR) {
      return reply(429, "Too many invitations in the last hour. Try again later.");
    }

    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { name },
      // The invite email links back to the site the admin is using (or APP_URL when it is configured).
      // Supabase additionally only honours addresses on the project's Redirect URLs allow-list.
      redirectTo: `${(!strictOrigins && originOf(requestOrigin)) || originOf(appUrl) || appUrl}/login`,
    });

    if (inviteError) {
      const already = inviteError.message.toLowerCase().includes("already");
      console.error("invite-user: invite failed:", inviteError.message);
      return already ? reply(409, "A user with this email already exists") : reply(400, "Could not send the invitation");
    }

    if (inviteData.user) {
      // The new-user trigger always creates STAFF; this service-role write sets the requested role
      const { error: upsertError } = await adminClient.from("profiles").upsert(
        { id: inviteData.user.id, name, email, role, isActive: true },
        { onConflict: "id" },
      );

      if (upsertError) {
        console.error("invite-user: profile upsert failed:", upsertError.message);
        return reply(500, "The invitation was sent but the profile could not be saved.");
      }
    }

    return reply(201, "Invitation sent");
  } catch (error) {
    console.error("invite-user: unexpected error:", error);
    return reply(500, "Unexpected error");
  }
});
