import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://fhcaisvvkuomrukwllfk.supabase.co";

const supabaseAnonKey = "sb_publishable_ZDS2UZkDjneYEHBxIRoMJg_0zALPjWm";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
