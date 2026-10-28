import { createClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = "https://rbkrezomrouycmxfiuzh.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "sb_publishable_Oty_iLtW8mhEKoNEwhkP2A_KeCsrAl9";

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL || "").trim();
const supabaseKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY || "").trim();

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
);
