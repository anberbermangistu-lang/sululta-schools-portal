import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://oshxnwqoutttvrfrcxph.supabase.co";

const supabaseAnonKey = "sb_publishable_YCdElnucIWEAXiWKJiyrHg_wy9QpQQQ";

export const supabase = createClient(
    supabaseUrl,
    supabaseAnonKey
);