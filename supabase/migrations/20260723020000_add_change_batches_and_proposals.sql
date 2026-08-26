-- Persist agent-proposed edits for review (build order #5-#7).
--
-- ChangeBatch = one professor request -> one agent call that returned a
-- batch of proposals (never persisted for a 'clarification' response, since
-- there's no batch yet). ChangeProposal = one proposed after-state for one
-- module item, carrying whatever the agent returned in proposed_state
-- (validated against lib/agent/proposal.ts's changeProposalSchema before
-- insert) plus server-computed review state.
--
-- Mirrors the existing workspace/course persistence pattern: no workspace_id
-- column here — scoping is transitive through course_id -> courses.workspace_id,
-- same as modules/module_items/pages/quizzes/files. Cascades down from
-- courses, so the purge-expired-canvas-workspaces cron job (courses.sql)
-- wipes batches and proposals along with everything else when a workspace
-- expires.
--
-- is_sensitive defaults false and is set by the diff engine (not yet built)
-- once it classifies a proposal's actual field-level changes against the
-- stored before-state — never trusted from the agent's own response.

create table public.change_batches (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid not null references public.courses(id) on delete cascade,
  request_text text not null,
  created_at   timestamptz not null default now()
);
create index change_batches_course_idx on public.change_batches (course_id);

create table public.change_proposals (
  id             uuid primary key default gen_random_uuid(),
  batch_id       uuid not null references public.change_batches(id) on delete cascade,
  item_id        uuid not null references public.module_items(id) on delete cascade,
  kind           text not null check (kind in ('page', 'quiz')),
  proposed_state jsonb not null,
  rationale      text not null,
  status         text not null default 'proposed'
                   check (status in ('proposed', 'accepted', 'rejected')),
  is_sensitive   boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index change_proposals_batch_idx on public.change_proposals (batch_id);
create index change_proposals_item_idx on public.change_proposals (item_id);
create index change_proposals_batch_status_idx
  on public.change_proposals (batch_id, status);

create trigger set_updated_at before update on public.change_proposals
  for each row execute function extensions.moddatetime(updated_at);

-- Same isolation posture as every other course-content table: RLS enabled,
-- zero privileges for anon/authenticated. Only the Next.js server (via the
-- Supabase secret key) reads or writes these rows.
alter table public.change_batches   enable row level security;
alter table public.change_proposals enable row level security;
revoke all privileges on table public.change_batches   from anon, authenticated;
revoke all privileges on table public.change_proposals from anon, authenticated;
