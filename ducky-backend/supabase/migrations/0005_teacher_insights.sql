-- Teacher insights in the ducky/ app: tutor agent templates, per-problem attempt records
-- (grades, time on each question, misconception heatmap), concept tags and answer-leak results.
-- Safe to re-run.

-- ───────────── Tutor agent templates ─────────────
-- A teacher's saved tutor settings (same shape as assignments' policy), applied to problem sets from the Tutor agents page.
create table if not exists public.agent_templates (
  id          uuid primary key default gen_random_uuid(),
  teacher_id  uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  name        text not null check (length(name) between 1 and 80),
  description text not null default '' check (length(description) <= 300),
  policy      jsonb not null default '{}'::jsonb check (jsonb_typeof(policy) = 'object'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists agent_templates_teacher_id_idx on public.agent_templates (teacher_id);

alter table public.agent_templates enable row level security;
drop policy if exists tpl_owner on public.agent_templates;
create policy tpl_owner on public.agent_templates for all to authenticated
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid() and public.my_role() = 'teacher');

-- ───────────── Attempts: one sessions row per (student, problem) ─────────────
alter table public.sessions add column if not exists steps_done     int[] not null default '{}';
alter table public.sessions add column if not exists steps_total    int   not null default 0;
alter table public.sessions add column if not exists revealed       boolean not null default false;
-- Time on the question: gaps between activity, each capped at 5 minutes so an idle tab doesn't count.
alter table public.sessions add column if not exists active_seconds int not null default 0;
alter table public.sessions add column if not exists last_active_at timestamptz not null default now();
create unique index if not exists sessions_problem_student_key on public.sessions (problem_id, student_id);

-- Called by the tutoring server (service role) after each request. Only ever moves forward:
-- the server keeps sessions in memory, so after a restart it may report fewer hints or steps than were saved.
create or replace function public.record_attempt(
  p_problem uuid, p_student uuid, p_hints int, p_steps int[], p_steps_total int, p_revealed boolean, p_completed boolean
) returns uuid
language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
  insert into public.sessions as s (problem_id, student_id, status, hints_used, steps_done, steps_total, revealed, ended_at)
  values (p_problem, p_student,
          case when p_completed then 'completed' else 'active' end,
          greatest(p_hints, 0), coalesce(p_steps, '{}'), greatest(p_steps_total, 0), p_revealed,
          case when p_completed or p_revealed then now() end)
  on conflict (problem_id, student_id) do update set
    hints_used     = greatest(s.hints_used, excluded.hints_used),
    steps_done     = (select coalesce(array_agg(distinct x order by x), '{}') from unnest(s.steps_done || excluded.steps_done) as x),
    steps_total    = greatest(excluded.steps_total, 0),
    revealed       = s.revealed or excluded.revealed,
    status         = case when s.status = 'completed' or excluded.status = 'completed' then 'completed' else s.status end,
    active_seconds = s.active_seconds + least(greatest(extract(epoch from now() - s.last_active_at), 0), 300)::int,
    last_active_at = now(),
    ended_at       = coalesce(s.ended_at, excluded.ended_at)
  returning id into sid;
  return sid;
end $$;

revoke execute on function public.record_attempt(uuid, uuid, int, int[], int, boolean, boolean) from public, anon, authenticated;
grant execute on function public.record_attempt(uuid, uuid, int, int[], int, boolean, boolean) to service_role;

-- ───────────── Problems: concept tags and answer-leak results ─────────────
-- Concepts are tagged by the teacher for now (AI tagging later). Leak hits come from SerpApi.
alter table public.problems add column if not exists concepts        text[] not null default '{}';
alter table public.problems add column if not exists leak_hits       jsonb  not null default '[]'::jsonb;
alter table public.problems add column if not exists leak_checked_at timestamptz;
