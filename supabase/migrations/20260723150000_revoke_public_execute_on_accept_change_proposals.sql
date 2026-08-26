-- Postgres grants EXECUTE to PUBLIC by default on function creation. The prior
-- migration only revoked from anon/authenticated directly, which left the
-- PUBLIC grant in place — anon/authenticated inherit privileges granted to
-- PUBLIC regardless of any per-role revoke. Close that gap explicitly.
revoke all on function public.accept_change_proposals(uuid[]) from public;
