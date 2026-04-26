alter table requests
  add column if not exists completed_at timestamptz;

alter table questions
  add column if not exists parent_question_id uuid references questions(id) on delete set null,
  add column if not exists parent_request_id uuid references requests(id) on delete set null;

alter table requests
  add column if not exists parent_question_id uuid references questions(id) on delete set null,
  add column if not exists parent_request_id uuid references requests(id) on delete set null;

update requests
set completed_at = coalesce(completed_at, created_at)
where status = 'completed' and completed_at is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'questions_single_parent_check'
  ) then
    alter table questions
      add constraint questions_single_parent_check
      check (
        (case when parent_question_id is null then 0 else 1 end) +
        (case when parent_request_id is null then 0 else 1 end)
        <= 1
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'requests_single_parent_check'
  ) then
    alter table requests
      add constraint requests_single_parent_check
      check (
        (case when parent_question_id is null then 0 else 1 end) +
        (case when parent_request_id is null then 0 else 1 end)
        <= 1
      );
  end if;
end
$$;

create index if not exists idx_questions_parent_question_id on questions (parent_question_id);
create index if not exists idx_questions_parent_request_id on questions (parent_request_id);
create index if not exists idx_requests_parent_question_id on requests (parent_question_id);
create index if not exists idx_requests_parent_request_id on requests (parent_request_id);
create index if not exists idx_requests_completed_at on requests (completed_at);
