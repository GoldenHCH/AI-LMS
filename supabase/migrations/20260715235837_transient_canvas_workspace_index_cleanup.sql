-- The live project already had an equivalent expiry index from an earlier
-- retention design. Keep one expiry index and remove an obsolete owner index.
drop index if exists public.courses_expiry_idx;
drop index if exists public.courses_owner_imported_idx;
