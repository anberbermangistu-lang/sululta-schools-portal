import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Supabase credentials missing. Check your .env.local file.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
    }
});

const publicPaths = new Set([
    "/",
    "/index.html",
    "/login.html",
    "/forgot-password.html",
    "/reset-password.html"
]);
const pathname = window.location.pathname;

if (!publicPaths.has(pathname)) {
    const requiredRole = pathname.startsWith("/teacher/")
        ? "teacher"
        : pathname.startsWith("/student/")
            ? "student"
            : "admin";
    const dashboards = {
        admin: "/admin/dashboard.html",
        teacher: "/teacher/dashboard.html",
        student: "/student/dashboard.html"
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

            const role = String(profile?.role || "").trim().toLowerCase();
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
