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
                detectSessionInUrl: true,
                storage: window.localStorage
            }
        });
    } catch (err) {
        console.error("[supabase] Failed to initialize Supabase client:", err);
    }
} else {
    console.error("[supabase] Supabase credentials missing. Check .env configuration.");
}

export const supabase = client;

/**
 * Returns the active session safely, waiting for initialization and local token restoration.
 * Does not throw on network latency.
 */
export async function getSession() {
    if (!supabase) return null;

    try {
        // 1. Direct session query (reads memory/localStorage cache)
        const { data: { session }, error } = await supabase.auth.getSession();
        if (session && !error) {
            return session;
        }

        // 2. If session is not ready yet, check if an auth token exists in localStorage
        const hasStoredToken = Object.keys(localStorage).some(
            k => k.startsWith("sb-") && k.endsWith("-auth-token")
        );

        if (hasStoredToken) {
            // Wait for auth state recovery (INITIAL_SESSION or TOKEN_REFRESHED)
            // Increased timeout to 3000ms to allow full session restoration
            const recovered = await new Promise(resolve => {
                const timer = setTimeout(() => resolve(null), 3000);
                const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
                    if (s) {
                        clearTimeout(timer);
                        subscription?.unsubscribe();
                        resolve(s);
                    }
                });
            });
            if (recovered) return recovered;
        }

        // 3. Fallback: query getUser to verify if session can be verified
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                // Force a session refresh after getting user
                const { data: { session: refreshedSession } } = await supabase.auth.refreshSession();
                if (refreshedSession) return refreshedSession;
                
                // If refresh fails, try getSession again
                const { data: { session: currentSession } } = await supabase.auth.getSession();
                return currentSession || { user };
            }
        } catch (_) {}

        return null;
    } catch (err) {
        console.warn("[supabase] getSession error:", err);
        return null;
    }
}

/**
 * Retrieves the user profile record safely
 */
export async function getUserProfile(userId) {
    if (!supabase || !userId) return null;
    try {
        const { data, error } = await supabase
            .from("profiles")
            .select("id, role, status, first_name, last_name, avatar_url, student_id")
            .eq("id", userId)
            .maybeSingle();

        if (!error && data) return data;
    } catch (e) {
        console.warn("[supabase] Profile lookup warning:", e);
    }
    return null;
}

/**
 * Maps a role string to its primary dashboard URL
 */
export function getRoleDashboard(role) {
    const r = String(role || "").trim().toLowerCase();
    switch (r) {
        case "teacher":
            return "/teacher/dashboard.html";
        case "student":
            return "/student/dashboard.html";
        case "parent":
            return "/parent/dashboard.html";
        case "admin":
        case "administrator":
            return "/admin/dashboard.html";
        default:
            return null;
    }
}

/* ──────────────────────────────────────────────────────────────
   CENTRALIZED PROTECTED ROUTE GUARD
────────────────────────────────────────────────────────────── */
const publicPaths = new Set([
    "/",
    "/index.html",
    "/login.html",
    "/forgot-password.html",
    "/reset-password.html"
]);

const pathname = window.location.pathname;

if (supabase) {
    if (publicPaths.has(pathname)) {
        // If on login or index, auto-redirect logged-in users to their dashboard
        if ((pathname === "/login.html" || pathname === "/" || pathname === "/index.html") && !window.location.search.includes("logout")) {
            void (async () => {
                try {
                    const session = await getSession();
                    if (session?.user) {
                        const profile = await getUserProfile(session.user.id);
                        let role = String(profile?.role || "").trim().toLowerCase();
                        if (role === "administrator") role = "admin";

                        if (!role) {
                            const { data: t } = await supabase
                                .from("teachers")
                                .select("id")
                                .eq("user_id", session.user.id)
                                .maybeSingle();
                            if (t) role = "teacher";
                        }

                        const target = getRoleDashboard(role);
                        if (target) {
                            window.location.replace(target);
                        }
                    }
                } catch (e) {
                    console.warn("[supabase] Public redirect check skipped:", e);
                }
            })();
        }
    } else {
        // Protected Route
        document.documentElement.style.visibility = "hidden";

        void (async () => {
            try {
                // Add small delay to ensure localStorage is read
                await new Promise(resolve => setTimeout(resolve, 100));
                
                const session = await getSession();
                const user = session?.user;

                if (!user) {
                    // Double-check: wait a bit longer if we have stored tokens
                    const hasStoredToken = Object.keys(localStorage).some(
                        k => k.startsWith("sb-") && k.endsWith("-auth-token")
                    );
                    
                    if (hasStoredToken) {
                        // Give one more chance for session to restore
                        await new Promise(resolve => setTimeout(resolve, 500));
                        const retrySession = await getSession();
                        if (retrySession?.user) {
                            // Session recovered, continue with permission check
                            const retryUser = retrySession.user;
                            await checkUserPermissions(retryUser);
                            return;
                        }
                    }
                    
                    // Truly unauthenticated: redirect to login
                    console.log("[auth] No valid session found, redirecting to login");
                    window.location.replace("/login.html");
                    return;
                }

                await checkUserPermissions(user);

            } catch (error) {
                console.warn("[auth] Protected-route check notice:", error);
                // Do not redirect on non-auth network errors; restore visibility
                document.documentElement.style.visibility = "";
            }
        })();
        
        async function checkUserPermissions(user) {
            // Retrieve role
            let profile = await getUserProfile(user.id);
            let role = String(profile?.role || "").trim().toLowerCase();
            if (role === "administrator") role = "admin";

            if (!role) {
                // Check if teacher
                const { data: t } = await supabase
                    .from("teachers")
                    .select("id")
                    .eq("user_id", user.id)
                    .maybeSingle();
                if (t) role = "teacher";
            }

            // Verify access permissions based on path
            if (pathname.startsWith("/teacher/")) {
                if (role && role !== "teacher" && role !== "admin") {
                    const target = getRoleDashboard(role);
                    if (target) {
                        window.location.replace(target);
                        return;
                    }
                }
            } else if (pathname.startsWith("/student/")) {
                if (role && role !== "student" && role !== "admin") {
                    const target = getRoleDashboard(role);
                    if (target) {
                        window.location.replace(target);
                        return;
                    }
                }
            } else if (pathname.startsWith("/parent/")) {
                if (role && role !== "parent" && role !== "admin") {
                    const target = getRoleDashboard(role);
                    if (target) {
                        window.location.replace(target);
                        return;
                    }
                }
            } else if (pathname.startsWith("/admin/")) {
                if (role && role !== "admin") {
                    const target = getRoleDashboard(role);
                    if (target) {
                        window.location.replace(target);
                        return;
                    }
                }
            }

            // Access granted: reveal document
            document.documentElement.style.visibility = "";
        }
    }
}
