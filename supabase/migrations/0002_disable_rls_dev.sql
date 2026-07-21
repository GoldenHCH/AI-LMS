-- TEMPORARY LOCAL-DEVELOPMENT ONLY: disable RLS for the Issue #4 fixture demo.
--
-- This intentionally allows the publishable/anon key to read and write all
-- imported course scratchpad rows. Do not deploy this migration to a shared or
-- production environment. Before the beta harness, re-enable RLS on every
-- table and add authenticated, instructor-owned policies.

alter table public.courses        disable row level security;
alter table public.modules        disable row level security;
alter table public.module_items   disable row level security;
alter table public.pages          disable row level security;
alter table public.quizzes        disable row level security;
alter table public.quiz_questions disable row level security;
alter table public.quiz_answers   disable row level security;
alter table public.files          disable row level security;
