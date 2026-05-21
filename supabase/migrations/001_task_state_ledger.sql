create extension if not exists pgcrypto;

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  objective text not null,
  domain text not null check (domain in ('coding', 'research', 'ops', 'writing', 'other')),
  status text not null check (status in ('active', 'paused', 'complete', 'abandoned')),
  tags text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists commits (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id),
  parent_commit_id uuid references commits(id),
  author_type text not null check (author_type in ('agent', 'human', 'system')),
  author_id text not null,
  session_tool text not null,
  "timestamp" timestamptz not null default now(),
  summary text not null,
  requested_next_action text,
  raw_context_ref text,
  created_at timestamptz not null default now()
);

create table if not exists state_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id),
  introduced_in_commit uuid not null references commits(id),
  superseded_in_commit uuid references commits(id),
  type text not null check (
    type in (
      'decision',
      'rejected_option',
      'artifact',
      'blocker',
      'assumption',
      'open_question',
      'resolved_question',
      'next_step',
      'context_fact'
    )
  ),
  content text not null,
  rationale text,
  confidence double precision not null check (confidence >= 0 and confidence <= 1),
  provenance text not null,
  status text not null check (status in ('provisional', 'locked', 'deprecated')),
  correction_of uuid references state_items(id),
  created_at timestamptz not null default now()
);

create index if not exists commits_task_id_idx on commits(task_id);
create index if not exists state_items_task_id_idx on state_items(task_id);
create index if not exists state_items_task_id_status_idx on state_items(task_id, status);
create index if not exists state_items_introduced_in_commit_idx on state_items(introduced_in_commit);

create or replace function set_tasks_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tasks_set_updated_at on tasks;

create trigger tasks_set_updated_at
before update on tasks
for each row
execute function set_tasks_updated_at();

create or replace function create_commit_with_items(
  commit_record jsonb,
  state_item_records jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
as $$
declare
  inserted_commit commits%rowtype;
  inserted_items jsonb;
begin
  insert into commits (
    id,
    task_id,
    parent_commit_id,
    author_type,
    author_id,
    session_tool,
    "timestamp",
    summary,
    requested_next_action,
    raw_context_ref
  )
  values (
    coalesce(nullif(commit_record->>'id', '')::uuid, gen_random_uuid()),
    (commit_record->>'task_id')::uuid,
    nullif(commit_record->>'parent_commit_id', '')::uuid,
    commit_record->>'author_type',
    commit_record->>'author_id',
    commit_record->>'session_tool',
    coalesce(nullif(commit_record->>'timestamp', '')::timestamptz, now()),
    commit_record->>'summary',
    nullif(commit_record->>'requested_next_action', ''),
    nullif(commit_record->>'raw_context_ref', '')
  )
  returning * into inserted_commit;

  with inserted as (
    insert into state_items (
      id,
      task_id,
      introduced_in_commit,
      superseded_in_commit,
      type,
      content,
      rationale,
      confidence,
      provenance,
      status,
      correction_of,
      created_at
    )
    select
      coalesce(nullif(item_record->>'id', '')::uuid, gen_random_uuid()),
      inserted_commit.task_id,
      inserted_commit.id,
      nullif(item_record->>'superseded_in_commit', '')::uuid,
      item_record->>'type',
      item_record->>'content',
      nullif(item_record->>'rationale', ''),
      (item_record->>'confidence')::double precision,
      item_record->>'provenance',
      item_record->>'status',
      nullif(item_record->>'correction_of', '')::uuid,
      coalesce(nullif(item_record->>'created_at', '')::timestamptz, now())
    from jsonb_array_elements(coalesce(state_item_records, '[]'::jsonb)) as item_record
    returning *
  )
  select coalesce(jsonb_agg(to_jsonb(inserted) order by inserted.created_at), '[]'::jsonb)
  into inserted_items
  from inserted;

  return jsonb_build_object(
    'commit',
    to_jsonb(inserted_commit),
    'items',
    inserted_items
  );
end;
$$;
