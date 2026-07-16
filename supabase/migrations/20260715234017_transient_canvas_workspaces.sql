-- Replace the shared, long-lived development scratchpad with isolated
-- 30-minute anonymous workspaces. Canvas credentials are never stored.

set local lock_timeout = '5s';
set local statement_timeout = '2min';

-- The product decision for this migration is to remove every existing import.
-- All child tables cascade from courses.
truncate table public.courses cascade;

alter table public.courses
  drop column if exists canvas_base_url,
  alter column workspace_id set not null,
  alter column expires_at set default (now() + interval '30 minutes');

create index if not exists courses_workspace_course_idx
  on public.courses (workspace_id, canvas_course_id);
create index if not exists courses_expiry_idx
  on public.courses (expires_at);

-- Browser roles have no direct course-data access. The FastAPI import service
-- and Next.js Server Components use only the server-side Supabase secret key.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'courses', 'modules', 'module_items', 'pages', 'quizzes',
    'quiz_questions', 'quiz_answers', 'files'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format(
      'revoke all privileges on table public.%I from anon, authenticated',
      table_name
    );
  end loop;
end $$;

-- Scheduling with the same name replaces an existing job. A course becomes
-- inaccessible at expires_at and is physically removed by the next minute run.
select cron.schedule(
  'purge-expired-canvas-workspaces',
  '* * * * *',
  $$delete from public.courses where expires_at <= now()$$
);
