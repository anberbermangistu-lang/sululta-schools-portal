import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const appUrl = Deno.env.get("APP_URL");

if (!supabaseUrl || !anonKey || !serviceRoleKey || !appUrl) {
    throw new Error("Missing required Supabase function environment variables.");
}

const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") || appUrl)
    .split(",")
    .map(origin => origin.trim())
    .filter(Boolean);

function response(
    request: Request,
    body: Record<string, unknown>,
    status = 200
) {
    const origin = request.headers.get("Origin") || "";
    const headers = new Headers({
        "Content-Type": "application/json",
        "Vary": "Origin"
    });

    if (allowedOrigins.includes(origin)) {
        headers.set("Access-Control-Allow-Origin", origin);
        headers.set("Access-Control-Allow-Headers", "authorization, apikey, content-type, x-client-info");
        headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    }

    return new Response(JSON.stringify(body), { status, headers });
}

async function rollbackInvitedUser(serviceClient: ReturnType<typeof createClient>, userId: string) {
    const { error } = await serviceClient.auth.admin.deleteUser(userId);
    if (error) {
        console.error("Could not roll back invited Auth user:", error);
        throw new Error("Account setup failed and cleanup was unsuccessful. Contact the Supabase administrator.");
    }
}

Deno.serve(async request => {
    if (!allowedOrigins.includes(request.headers.get("Origin") || "")) {
        return response(request, { error: "Origin is not allowed." }, 403);
    }

    if (request.method === "OPTIONS") {
        return response(request, {}, 200);
    }

    if (request.method !== "POST") {
        return response(request, { error: "Method not allowed." }, 405);
    }

    const accessToken = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!accessToken) {
        return response(request, { error: "Authentication is required." }, 401);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false }
    });
    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false }
    });

    try {
        const { data: { user: actor }, error: authError } =
            await userClient.auth.getUser(accessToken);

        if (authError || !actor) {
            return response(request, { error: "Your session is invalid or expired." }, 401);
        }

        const { data: actorProfile, error: actorProfileError } =
            await serviceClient
                .from("profiles")
                .select("role, status")
                .eq("id", actor.id)
                .maybeSingle();

        if (actorProfileError) throw actorProfileError;
        if (
            String(actorProfile?.role || "").toLowerCase() !== "admin" ||
            String(actorProfile?.status || "").toLowerCase() !== "active"
        ) {
            return response(request, { error: "Administrator access is required." }, 403);
        }

        const payload = await request.json();
        const firstName = String(payload.first_name || "").trim();
        const lastName = String(payload.last_name || "").trim();
        const email = String(payload.email || "").trim().toLowerCase();
        const username = String(payload.username || "").trim();
        const phone = String(payload.phone || "").trim();
        const role = String(payload.role || "").trim().toLowerCase();
        const recordId = payload.record_id == null ? null : Number(payload.record_id);

        if (
            !firstName ||
            !lastName ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
            !["admin", "teacher", "student"].includes(role) ||
            (role !== "admin" &&
                (recordId === null || !Number.isSafeInteger(recordId) || recordId < 1))
        ) {
            return response(request, { error: "Provide valid account details and a school record for teacher or student accounts." }, 400);
        }

        let teacherRecord:
            | { id: number; user_id: string | null; status: string | null }
            | null = null;
        if (role === "teacher" && recordId !== null) {
            const { data, error: recordError } = await serviceClient
                .from("teachers")
                .select("id, user_id, status")
                .eq("id", recordId)
                .maybeSingle();

            if (recordError) throw recordError;
            teacherRecord = data;
            if (
                !teacherRecord ||
                teacherRecord.user_id ||
                String(teacherRecord.status || "").toLowerCase() !== "active"
            ) {
                return response(request, { error: "The selected school record is missing, inactive, or already linked to an account." }, 409);
            }
        }

        if (role === "student" && recordId !== null) {
            const { data: schoolRecord, error: recordError } = await serviceClient
                .from("students")
                .select("id, status")
                .eq("id", recordId)
                .maybeSingle();

            if (recordError) throw recordError;
            if (
                !schoolRecord ||
                String(schoolRecord.status || "").toLowerCase() !== "active"
            ) {
                return response(request, { error: "The selected school record is missing or inactive." }, 409);
            }

            const { data: linkedProfile, error: profileLookupError } = await serviceClient
                .from("profiles")
                .select("id")
                .eq("student_id", recordId)
                .maybeSingle();

            if (profileLookupError) throw profileLookupError;
            if (linkedProfile) {
                return response(request, { error: "The selected student already has an account." }, 409);
            }
        }

        const redirectTo = new URL("/reset-password.html", appUrl).toString();
        const { data: inviteData, error: inviteError } =
            await serviceClient.auth.admin.inviteUserByEmail(email, {
                data: { first_name: firstName, last_name: lastName, role },
                redirectTo
            });

        if (inviteError) throw inviteError;
        const invitedUser = inviteData.user;
        if (!invitedUser) throw new Error("Supabase did not return the invited user.");

        const profile = {
            id: invitedUser.id,
            first_name: firstName,
            last_name: lastName,
            full_name: `${firstName} ${lastName}`,
            email,
            username: username || null,
            phone: phone || null,
            role,
            status: "active",
            ...(role === "student" && recordId !== null ? { student_id: recordId } : {})
        };

        const { error: profileError } =
            await serviceClient.from("profiles").insert(profile);

        if (profileError) {
            await rollbackInvitedUser(serviceClient, invitedUser.id);
            throw profileError;
        }

        if (teacherRecord && recordId !== null) {
            const { data: linkedRecord, error: linkError } = await serviceClient
                .from("teachers")
                .update({ user_id: invitedUser.id, email })
                .eq("id", recordId)
                .is("user_id", null)
                .select("id")
                .maybeSingle();

            if (linkError || !linkedRecord) {
                await rollbackInvitedUser(serviceClient, invitedUser.id);
                if (linkError) throw linkError;
                throw new Error("The school record was linked by another administrator. Please retry.");
            }
        }

        return response(request, { success: true }, 200);
    } catch (error) {
        console.error("admin-invite-user failed:", error);
        return response(request, { error: error instanceof Error ? error.message : "Invitation failed." }, 400);
    }
});
