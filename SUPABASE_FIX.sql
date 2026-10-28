-- Deprecated: this legacy script disabled Row Level Security and promoted a
-- hard-coded account to administrator. Use the additive security migration.
DO $$
BEGIN
    RAISE EXCEPTION 'Do not run this deprecated script. Use supabase/migrations/20261027000000_role_security.sql.';
END
$$;
