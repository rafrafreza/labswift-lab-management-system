import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const appUrl = Deno.env.get("APP_URL") ?? "http://localhost:5173";

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return new Response(JSON.stringify({ message: "Missing Supabase function secrets." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ message: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ message: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: adminProfile, error: adminProfileError } = await adminClient
      .from("profiles")
      .select("role, isActive")
      .eq("id", user.id)
      .single();

    if (adminProfileError || adminProfile?.role !== "ADMIN" || !adminProfile?.isActive) {
      return new Response(JSON.stringify({ message: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const name = String(body.name ?? "").trim();
    const role = body.role === "ADMIN" ? "ADMIN" : "STAFF";

    if (!email || !name) {
      return new Response(JSON.stringify({ message: "Email and name are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { name, role },
      redirectTo: `${appUrl}/login`,
    });

    if (inviteError) {
      const status = inviteError.message.includes("already") ? 409 : 400;
      return new Response(JSON.stringify({ message: inviteError.message }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (inviteData.user) {
      const { error: upsertError } = await adminClient.from("profiles").upsert(
        {
          id: inviteData.user.id,
          name,
          email,
          role,
          isActive: true,
        },
        { onConflict: "id" },
      );

      if (upsertError) {
        return new Response(JSON.stringify({ message: upsertError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ message: "Invitation sent" }), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        message: error instanceof Error ? error.message : "Unexpected error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
