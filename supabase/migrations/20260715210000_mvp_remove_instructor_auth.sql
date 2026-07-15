-- MVP: the Canvas connect + import flow has NO instructor accounts.
--
-- The (now-removed) instructor-auth migrations added owner-scoped RLS, an
-- owner_id NOT NULL column, a per-actor audit table, and a retention cron. This
-- migration converges the scratchpad back to the simple development store: RLS
-- disabled, the publishable/anon key may read, imports carry no owner, and there
-- is no login-tied audit trail. It is written defensively so it reaches the same
-- end state whether or not the auth migrations were previously applied here.

-- Partial-import tracking is kept (the writer populates these).
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'courses'
      and column_name = 'import_status'
  ) then
    alter table public.courses
      add column import_status text not null default 'complete'
        check (import_status in ('complete', 'partial'));
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'courses'
      and column_name = 'import_issues'
  ) then
    alter table public.courses
      add column import_issues jsonb not null default '[]'::jsonb
        check (jsonb_typeof(import_issues) = 'array');
  end if;
end $$;

-- Imports no longer carry an authenticated owner.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'courses'
      and column_name = 'owner_id'
  ) then
    alter table public.courses alter column owner_id drop not null;
  end if;
end $$;

-- Drop owner-scoped aal2 read policies if present.
drop policy if exists "aal2 owners can read courses" on public.courses;
drop policy if exists "aal2 owners can read modules" on public.modules;
drop policy if exists "aal2 owners can read module items" on public.module_items;
drop policy if exists "aal2 owners can read pages" on public.pages;
drop policy if exists "aal2 owners can read quizzes" on public.quizzes;
drop policy if exists "aal2 owners can read quiz questions" on public.quiz_questions;
drop policy if exists "aal2 owners can read quiz answers" on public.quiz_answers;
drop policy if exists "aal2 owners can read files" on public.files;

-- Development scratchpad: RLS disabled; publishable/anon + authenticated may read.
-- (Server-side writes use the Supabase secret key / service_role, which bypasses RLS.)
do $$
declare t text;
begin
  foreach t in array array[
    'courses', 'modules', 'module_items', 'pages', 'quizzes',
    'quiz_questions', 'quiz_answers', 'files'
  ] loop
    execute format('alter table public.%I disable row level security', t);
    execute format('grant select on public.%I to anon, authenticated', t);
  end loop;
end $$;

-- Remove the login-tied audit trail and its retention job.
do $$
declare existing_job bigint;
begin
  select jobid into existing_job from cron.job
   where jobname = 'purge-expired-canvas-import-data';
  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;
exception
  when undefined_table then null;  -- pg_cron not installed
end $$;

drop function if exists public.purge_expired_canvas_import_data();
drop table if exists public.canvas_import_events;
