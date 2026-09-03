import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      { error: "Method not allowed." },
      405
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return jsonResponse(
        { error: "Supabase environment variables are missing." },
        500
      );
    }

    const authorization = req.headers.get("Authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return jsonResponse(
        { error: "Authentication required." },
        401
      );
    }

    const accessToken = authorization.replace("Bearer ", "").trim();

    const supabaseAuth = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      }
    );

    const {
      data: { user },
      error: userError
    } = await supabaseAuth.auth.getUser();

    if (userError || !user) {
      return jsonResponse(
        { error: "Invalid authentication." },
        401
      );
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey
    );

    const {
      data: adminProfile,
      error: adminProfileError
    } = await supabaseAdmin
      .from("profiles")
      .select("id, role, status")
      .eq("id", user.id)
      .single();

    if (
      adminProfileError ||
      !adminProfile ||
      adminProfile.role !== "admin" ||
      adminProfile.status !== "active"
    ) {
      return jsonResponse(
        { error: "Only active administrators can reset passwords." },
        403
      );
    }

    const body = await req.json();

    const userId = String(body.user_id || "").trim();
    const password = String(body.password || "");

    if (!userId || !password) {
      return jsonResponse(
        { error: "User ID and new password are required." },
        400
      );
    }

    if (password.length < 6) {
      return jsonResponse(
        { error: "Password must be at least 6 characters." },
        400
      );
    }

    if (userId === user.id) {
      return jsonResponse(
        { error: "Use the password reset process to change your own password." },
        400
      );
    }

    const {
      data: targetProfile,
      error: targetProfileError
    } = await supabaseAdmin
      .from("profiles")
      .select("id, email, role, status")
      .eq("id", userId)
      .maybeSingle();

    if (targetProfileError) {
      return jsonResponse(
        { error: targetProfileError.message },
        500
      );
    }

    if (!targetProfile) {
      return jsonResponse(
        { error: "User account not found." },
        404
      );
    }

    const {
      error: updateError
    } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      {
        password
      }
    );

    if (updateError) {
      return jsonResponse(
        { error: updateError.message },
        400
      );
    }

    return jsonResponse({
      success: true,
      message: "User password reset successfully."
    });
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error
          ? error.message
          : "An unexpected error occurred."
      },
      500
    );
  }
});