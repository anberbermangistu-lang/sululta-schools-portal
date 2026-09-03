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
        { error: "Only active administrators can create user accounts." },
        403
      );
    }

    const body = await req.json();

    const firstName = String(body.first_name || "").trim();
    const lastName = String(body.last_name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const username = body.username
      ? String(body.username).trim()
      : null;
    const phone = body.phone
      ? String(body.phone).trim()
      : null;
    const role = String(body.role || "").trim().toLowerCase();
    const password = String(body.password || "");
    const studentId = body.student_id;

    const allowedRoles = [
      "admin",
      "teacher",
      "student",
      "parent"
    ];

    if (!firstName || !lastName || !email || !role || !password) {
      return jsonResponse(
        { error: "Please fill in all required fields." },
        400
      );
    }

    if (!allowedRoles.includes(role)) {
      return jsonResponse(
        { error: "Invalid user role." },
        400
      );
    }

    if (password.length < 6) {
      return jsonResponse(
        { error: "Password must be at least 6 characters." },
        400
      );
    }

    if (role === "student") {
      if (
        studentId === null ||
        studentId === undefined ||
        studentId === "" ||
        !Number.isInteger(Number(studentId))
      ) {
        return jsonResponse(
          { error: "Please select a student." },
          400
        );
      }

      const {
        data: student,
        error: studentError
      } = await supabaseAdmin
        .from("students")
        .select("id")
        .eq("id", Number(studentId))
        .single();

      if (studentError || !student) {
        return jsonResponse(
          { error: "Selected student was not found." },
          400
        );
      }
    }
const {
  data: existingProfile,
  error: existingProfileError
} = await supabaseAdmin
  .from("profiles")
  .select("id")
  .eq("email", email)
  .maybeSingle();

if (existingProfileError) {
  return jsonResponse(
    { error: existingProfileError.message },
    500
  );
}

if (existingProfile) {
  return jsonResponse(
    { error: "A profile with this email already exists." },
    409
  );
}

if (username) {
  const {
    data: existingUsername,
    error: existingUsernameError
  } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (existingUsernameError) {
    return jsonResponse(
      { error: existingUsernameError.message },
      500
    );
  }

  if (existingUsername) {
    return jsonResponse(
      { error: "This username is already in use. Please choose another username." },
      409
    );
  }
}

    if (existingProfileError) {
      return jsonResponse(
        { error: existingProfileError.message },
        500
      );
    }

    if (existingProfile) {
      return jsonResponse(
        { error: "A profile with this email already exists." },
        409
      );
    }

    const {
      data: createdAuth,
      error: authError
    } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        username,
        phone,
        role
      }
    });

    if (authError || !createdAuth.user) {
      return jsonResponse(
        { error: authError?.message || "Failed to create authentication account." },
        400
      );
    }

    const authUserId = createdAuth.user.id;

    const {
      data: profile,
      error: profileError
    } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: authUserId,
        first_name: firstName,
        last_name: lastName,
        email,
        username,
        role,
        phone,
        status: "active",
        student_id: role === "student"
          ? Number(studentId)
          : null
      })
      .select()
      .single();

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(authUserId);

      return jsonResponse(
        { error: profileError.message },
        400
      );
    }

    return jsonResponse({
      success: true,
      message: "User account created successfully.",
      user: {
        id: authUserId,
        email,
        role
      },
      profile
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