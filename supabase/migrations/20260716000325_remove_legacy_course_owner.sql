-- Transient workspaces are anonymous and never attach to Supabase users.
alter table public.courses drop column if exists owner_id;
