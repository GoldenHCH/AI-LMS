-- Migration: create_course_scratchpad_schema
--
-- Faithful relational mirror of the canvas_import working-copy model
-- (backend/canvas_import/model/). Stores an imported Canvas course as an
-- editable scratchpad before it is pushed back to Canvas.
--
--   Course -> Module -> ModuleItem -> one of (Page | Quiz | FileRef | opaque)
--   Quiz -> Question -> Answer
--
-- Conventions:
--   * id uuid pk default gen_random_uuid()  (built into Postgres 17 core)
--   * Canvas natural keys stored as text (model CanvasId = int | str;
--     New Quizzes use string ids via the canvas-string-ids header)
--   * raw_payload jsonb on every table = original Canvas payload, verbatim,
--     for lossless round-trip (alias keys like content-type vs content_type matter)
--   * links jsonb only where the model has it (ModuleItem/Page/Quiz/Question/File)
--   * numeric for points/weight (no float rounding on grade-bearing values)
--   * on delete cascade down the tree (dropping a scratchpad drops its subtree)
--
-- The Canvas access token is intentionally NOT stored anywhere here; only the
-- non-secret canvas_base_url is kept, to know where to export back to.

-- updated_at auto-touch helper
create extension if not exists moddatetime schema extensions;

-- 1. courses ---------------------------------------------------------------
create table public.courses (
  id               uuid primary key default gen_random_uuid(),
  canvas_course_id text not null,
  name             text not null,
  canvas_base_url  text,                        -- instance URL to export to; NEVER the token
  workspace_id     uuid,                        -- reserved: group scratchpads by session
  schema_version   integer not null default 1,  -- working-copy envelope version
  raw_payload      jsonb   not null default '{}'::jsonb,
  imported_at      timestamptz not null default now(),
  expires_at       timestamptz not null default (now() + interval '90 days'),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- 2. modules ---------------------------------------------------------------
create table public.modules (
  id               uuid primary key default gen_random_uuid(),
  course_id        uuid not null references public.courses(id) on delete cascade,
  canvas_module_id text not null,
  name             text not null,
  position         integer not null default 0,
  raw_payload      jsonb   not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (course_id, canvas_module_id)
);
create index modules_course_position_idx on public.modules (course_id, position);

-- 3. module_items (discriminated union: page | quiz | file | opaque) --------
create table public.module_items (
  id                    uuid primary key default gen_random_uuid(),
  module_id             uuid not null references public.modules(id) on delete cascade,
  canvas_module_item_id text not null,
  position              integer not null default 0,
  kind                  text not null check (kind in ('page','quiz','file','opaque')),
  opaque                jsonb,                       -- present iff kind='opaque'
  links                 jsonb not null default '[]'::jsonb,
  raw_payload           jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (module_id, canvas_module_item_id),
  constraint module_items_opaque_matches_kind
    check ((kind = 'opaque') = (opaque is not null))
);
create index module_items_module_position_idx on public.module_items (module_id, position);

-- 4. pages (1:1 detail for kind='page') ------------------------------------
create table public.pages (
  id             uuid primary key default gen_random_uuid(),
  module_item_id uuid not null unique references public.module_items(id) on delete cascade,
  page_url       text not null,                 -- stable slug (the real key)
  canvas_page_id text,
  title          text not null,
  body_html      text not null default '',
  published      boolean,
  front_page     boolean,
  links          jsonb not null default '[]'::jsonb,
  raw_payload    jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- 5. quizzes (1:1 detail for kind='quiz') ----------------------------------
create table public.quizzes (
  id               uuid primary key default gen_random_uuid(),
  module_item_id   uuid not null unique references public.module_items(id) on delete cascade,
  canvas_quiz_id   text not null,
  engine           text not null check (engine in ('classic','new')),
  title            text not null,
  description_html text not null default '',
  points_possible  numeric,
  question_count   integer not null,            -- model invariant: == count(questions)
  links            jsonb not null default '[]'::jsonb,
  raw_payload      jsonb not null default '{}'::jsonb,
  read_only_reason text,                          -- non-null => not writable back
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- 6. quiz_questions --------------------------------------------------------
create table public.quiz_questions (
  id                 uuid primary key default gen_random_uuid(),
  quiz_id            uuid not null references public.quizzes(id) on delete cascade,
  canvas_question_id text not null,
  position           integer not null default 0,
  question_type      text not null,             -- free-form (matches model)
  stem_html          text not null default '',
  points_possible    numeric,
  type_specific      jsonb not null default '{}'::jsonb,
  links              jsonb not null default '[]'::jsonb,
  raw_payload        jsonb not null default '{}'::jsonb,
  read_only_reason   text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (quiz_id, canvas_question_id)
);
create index quiz_questions_quiz_position_idx on public.quiz_questions (quiz_id, position);

-- 7. quiz_answers ----------------------------------------------------------
create table public.quiz_answers (
  id               uuid primary key default gen_random_uuid(),
  question_id      uuid not null references public.quiz_questions(id) on delete cascade,
  canvas_answer_id text,                          -- nullable (model: answer_id | None)
  ordinal          integer not null default 0,    -- preserves list order (Answer has no position)
  text_html        text not null default '',
  weight           numeric,
  is_correct       boolean,
  comments_html    text,
  raw_payload      jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index quiz_answers_question_ordinal_idx on public.quiz_answers (question_id, ordinal);

-- 8. files (FileRef: course-level list AND file module-items) --------------
create table public.files (
  id             uuid primary key default gen_random_uuid(),
  course_id      uuid not null references public.courses(id) on delete cascade,
  module_item_id uuid references public.module_items(id) on delete cascade, -- set for file items
  canvas_file_id text not null,
  display_name   text not null,
  content_type   text,
  url            text not null default '',
  links          jsonb not null default '[]'::jsonb,
  raw_payload    jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index files_course_idx on public.files (course_id);
create unique index files_module_item_unique
  on public.files (module_item_id) where module_item_id is not null;

-- updated_at auto-touch triggers -------------------------------------------
create trigger set_updated_at before update on public.courses
  for each row execute function extensions.moddatetime(updated_at);
create trigger set_updated_at before update on public.modules
  for each row execute function extensions.moddatetime(updated_at);
create trigger set_updated_at before update on public.module_items
  for each row execute function extensions.moddatetime(updated_at);
create trigger set_updated_at before update on public.pages
  for each row execute function extensions.moddatetime(updated_at);
create trigger set_updated_at before update on public.quizzes
  for each row execute function extensions.moddatetime(updated_at);
create trigger set_updated_at before update on public.quiz_questions
  for each row execute function extensions.moddatetime(updated_at);
create trigger set_updated_at before update on public.quiz_answers
  for each row execute function extensions.moddatetime(updated_at);
create trigger set_updated_at before update on public.files
  for each row execute function extensions.moddatetime(updated_at);

-- Row Level Security -------------------------------------------------------
-- Enable RLS on every table with NO public policies. The anon (publishable)
-- key therefore cannot read or write course data; all access is server-side
-- via the secret key. Owner/session-scoped policies can be added later.
alter table public.courses        enable row level security;
alter table public.modules        enable row level security;
alter table public.module_items   enable row level security;
alter table public.pages          enable row level security;
alter table public.quizzes        enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_answers   enable row level security;
alter table public.files          enable row level security;
