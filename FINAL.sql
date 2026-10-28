-- Deprecated: this legacy script dropped the existing profiles table and
-- disabled Row Level Security. Use the additive security migration instead.
DO $$
BEGIN
    RAISE EXCEPTION 'Do not run this deprecated script. Use supabase/migrations/20261027000000_role_security.sql.';
END
$$;
