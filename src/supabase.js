import { createClient } from "@supabase/supabase-js";

// Production and local default configuration for Sululta Secondary School Portal
const DEFAULT_SUPABASE_URL = "https://rbkrezomrouycmxfiuzh.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "sb_publishable_Oty_iLtW8mhEKoNEwhkP2A_KeCsrAl9";

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL || "").trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY || "").trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

let client = null;
if (isSupabaseConfigured) {
    try {
        client = createClient(supabaseUrl, supabaseAnonKey, {
            auth: {
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: true
            }
        });
    } catch (err) {
        console.error("[supabase] Failed to initialize Supabase client:", err);
    }
} else {
    console.error("[supabase] Supabase credentials missing. Check .env configuration.");
}

export const supabase = client;

const publicPaths = new Set([
    "/",
    "/index.html",
    "/login.html",
    "/forgot-password.html",
    "/reset-password.html"
]);
const pathname = window.location.pathname;

if (!publicPaths.has(pathname) && supabase) {
    const requiredRole = pathname.startsWith("/teacher/")
        ? "teacher"
        : pathname.startsWith("/student/")
            ? "student"
            : pathname.startsWith("/parent/")
                ? "parent"
                : "admin";

    const dashboards = {
        admin: "/admin/dashboard.html",
        administrator: "/admin/dashboard.html",
        teacher: "/teacher/dashboard.html",
        student: "/student/dashboard.html",
        parent: "/parent/dashboard.html"
    };

    document.documentElement.style.visibility = "hidden";

    void (async () => {
        try {
            const { data: { user }, error: authError } =
                await supabase.auth.getUser();
            if (authError) throw authError;
            if (!user) {
                window.location.replace("/login.html");
                return;
            }

            const { data: profile, error: profileError } = await supabase
                .from("profiles")
                .select("role, status")
                .eq("id", user.id)
                .maybeSingle();
            if (profileError) throw profileError;

            let role = String(profile?.role || "").trim().toLowerCase();
            if (role === "administrator") role = "admin";
            const status = String(profile?.status || "").trim().toLowerCase();

            if (status !== "active" || !dashboards[role]) {
                await supabase.auth.signOut();
                window.location.replace("/login.html");
                return;
            }

            if (role !== requiredRole) {
                window.location.replace(dashboards[role]);
                return;
            }

            document.documentElement.style.visibility = "";
        } catch (error) {
            console.error("[auth] Protected-route check failed:", error);
            window.location.replace("/login.html");
        }
    })();
}
