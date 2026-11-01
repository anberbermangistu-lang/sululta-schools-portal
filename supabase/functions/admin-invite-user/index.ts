import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const appUrl = Deno.env.get("APP_URL");

if (!supabaseUrl || !anonKey || !serviceRoleKey || !appUrl) {
    throw new Error("Missing required Supabase function environment variables.");
}

const configuredOrigins = (Deno.env.get("ALLOWED_ORIGINS") || appUrl)
    .split(",")
    .map(origin => origin.trim())
    .filter(Boolean);
const allowedOrigins = [...new Set([
    ...configuredOrigins,
    "https://sululta-schools-portal.vercel.app",
    "https://sululta-school-portal.vercel.app"
])];

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
    let createdUserId: string | null = null;
    let createdProfileId: string | null = null;

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
        if (payload.mode === "reset-password") {
            const userId = String(payload.user_id || "").trim();
            if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
                return response(request, { error: "Select a valid account." }, 400);
            }

            const { data: targetProfile, error: targetError } = await serviceClient
                .from("profiles")
                .select("email, role")
                .eq("id", userId)
                .maybeSingle();

            if (targetError) throw targetError;
            if (
                !targetProfile ||
                !["teacher", "student"].includes(String(targetProfile.role || "").toLowerCase()) ||
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(targetProfile.email || ""))
            ) {
                return response(request, { error: "The selected teacher or student account has no valid email address." }, 404);
            }

            const redirectTo = new URL("/reset-password.html", appUrl).toString();
            const { error: resetError } = await serviceClient.auth.resetPasswordForEmail(
                String(targetProfile.email).trim().toLowerCase(),
                { redirectTo }
            );
            if (resetError) throw resetError;

            return response(request, { success: true, email: targetProfile.email }, 200);
        }

        const firstName = String(payload.first_name || "").trim();
        const lastName = String(payload.last_name || "").trim();
        const email = String(payload.email || "").trim().toLowerCase();
        const username = String(payload.username || "").trim();
        const phone = String(payload.phone || "").trim();
        const role = String(payload.role || "").trim().toLowerCase();
        const recordId = payload.record_id == null ? null : Number(payload.record_id);
        const temporaryPassword = payload.temporary_password ?? "";

        if (typeof temporaryPassword !== "string") {
            return response(request, { error: "Temporary password must be text." }, 400);
        }
        if (temporaryPassword && temporaryPassword.length < 8) {
            return response(request, { error: "Use at least 8 characters for a temporary password, or leave it blank to send a password setup invitation." }, 400);
        }

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
        const accountResult = temporaryPassword
            ? await serviceClient.auth.admin.createUser({
                email,
                password: temporaryPassword,
                email_confirm: true,
                user_metadata: { first_name: firstName, last_name: lastName, role }
            })
            : await serviceClient.auth.admin.inviteUserByEmail(email, {
                data: { first_name: firstName, last_name: lastName, role },
                redirectTo
            });

        if (accountResult.error) throw accountResult.error;
        const invitedUser = accountResult.data.user;
        if (!invitedUser) throw new Error("Supabase did not return the created user.");
        createdUserId = invitedUser.id;

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

        if (profileError) throw profileError;
        createdProfileId = invitedUser.id;

        if (teacherRecord && recordId !== null) {
            const { data: linkedRecord, error: linkError } = await serviceClient
                .from("teachers")
                .update({ user_id: invitedUser.id, email })
                .eq("id", recordId)
                .is("user_id", null)
                .select("id")
                .maybeSingle();

            if (linkError || !linkedRecord) {
                if (linkError) throw linkError;
                throw new Error("The school record was linked by another administrator. Please retry.");
            }
        }

        return response(request, {
            success: true,
            email,
            invitation_sent: !temporaryPassword,
            temporary_password_set: Boolean(temporaryPassword)
        }, 200);
    } catch (error) {
        console.error("admin-invite-user failed:", error);
        if (createdProfileId) {
            const { error: profileCleanupError } = await serviceClient
                .from("profiles")
                .delete()
                .eq("id", createdProfileId);
            if (profileCleanupError) {
                console.error("Could not roll back invited user's profile:", profileCleanupError.message);
                return response(request, { error: "Account setup failed and profile cleanup was unsuccessful. Contact the Supabase administrator." }, 500);
            }
        }
        if (createdUserId) {
            try {
                await rollbackInvitedUser(serviceClient, createdUserId);
            } catch (cleanupError) {
                return response(request, {
                    error: cleanupError instanceof Error ? cleanupError.message : "Account setup cleanup failed."
                }, 500);
            }
        }
        return response(request, { error: error instanceof Error ? error.message : "Invitation failed." }, 400);
    }
});
