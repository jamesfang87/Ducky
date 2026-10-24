-- Ducky foundation: PRD §8.3 tables, RLS, accounts & classes (ACC-1..4), GRD-1.

create extension if not exists pgcrypto;

-- ───────────── Tables ─────────────
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  avatar_url  text,
  role        text check (role in ('student','teacher','admin')),  -- null until onboarding
  created_at  timestamptz not null default now()
);

-- 6 chars, no ambiguous 0/O/1/I/L
-- security definer so the uniqueness check sees every class, not just RLS-visible ones
create or replace function public.generate_join_code() returns text
language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + (get_byte(gen_random_bytes(1), 0) % length(alphabet)), 1);
    end loop;
    exit when not exists (select 1 from public.classes c where c.join_code = code);
  end loop;
  return code;
end $$;

create table public.classes (
  id          uuid primary key default gen_random_uuid(),
  teacher_id  uuid not null references public.profiles(id) on delete cascade,
  name        text not null check (length(name) between 1 and 120),
  join_code   char(6) not null unique,
  created_at  timestamptz not null default now()
);
alter table public.classes alter column join_code set default public.generate_join_code();

create table public.enrollments (
  class_id    uuid not null references public.classes(id) on delete cascade,
  student_id  uuid not null references public.profiles(id) on delete cascade,
  joined_at   timestamptz not null default now(),
  primary key (class_id, student_id)
);

create table public.assignments (
  id              uuid primary key default gen_random_uuid(),
  class_id        uuid not null references public.classes(id) on delete cascade,
  title           text not null,
  -- POL-1 (P0) as columns; POL-2 extras in policy jsonb. Only ever set from the teacher form (ASG-5.3).
  hint_limit      int  not null default 3 check (hint_limit >= 0),
  reveal_answers  boolean not null default false,
  voice_required  boolean not null default false,
  policy          jsonb not null default '{}'::jsonb,
  source_file     text,
  published       boolean not null default false,
  due_at          timestamptz,
  created_at      timestamptz not null default now()
);

create table public.problems (
  id                        uuid primary key default gen_random_uuid(),
  assignment_id             uuid not null references public.assignments(id) on delete cascade,
  position                  int  not null,
  prompt                    text not null,           -- untrusted document data (ASG-5)
  predicted_misconceptions  jsonb not null default '[]'::jsonb,
  flagged_lines             jsonb not null default '[]'::jsonb,  -- ASG-5.6
  leak_status               text not null default 'unchecked' check (leak_status in ('unchecked','clean','leaked','mutated')),
  created_at                timestamptz not null default now(),
  unique (assignment_id, position)
);

-- GRD-1: never readable by students. No student policy exists on this table.
create table public.problem_solutions (
  problem_id  uuid primary key references public.problems(id) on delete cascade,
  solution    text not null,
  rubric      jsonb not null default '[]'::jsonb,
  updated_at  timestamptz not null default now()
);

create table public.sessions (
  id            uuid primary key default gen_random_uuid(),
  problem_id    uuid not null references public.problems(id) on delete cascade,
  student_id    uuid not null references public.profiles(id) on delete cascade,
  status        text not null default 'active' check (status in ('active','completed','escalated','abandoned')),
  hints_used    int  not null default 0,          -- written by server only (POL-4)
  mastery       jsonb,                             -- rubric scores; teacher override lives here
  started_at    timestamptz not null default now(),
  ended_at      timestamptz
);

create table public.turns (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.sessions(id) on delete cascade,
  idx         int  not null,
  speaker     text not null check (speaker in ('student','ducky')),
  input_mode  text check (input_mode in ('voice','text','sketch','voice+sketch','text+sketch')),
  text        text,
  structured  jsonb,       -- TUT-5 output for ducky turns
  sketch_path text,        -- Storage path (TUT-8.6)
  created_at  timestamptz not null default now(),
  unique (session_id, idx)
);

create table public.misconception_events (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.sessions(id) on delete cascade,
  turn_id     uuid references public.turns(id) on delete set null,
  problem_id  uuid not null references public.problems(id) on delete cascade,
  label       text not null,
  evidence    text not null,   -- MIS-2: evidence required
  created_at  timestamptz not null default now()
);

create table public.visuals (
  id          uuid primary key default gen_random_uuid(),
  problem_id  uuid not null references public.problems(id) on delete cascade,
  session_id  uuid references public.sessions(id) on delete cascade,  -- null = pre-generated (VIS-5)
  turn_id     uuid references public.turns(id) on delete set null,
  primitive   text,
  spec        jsonb not null default '{}'::jsonb,
  review_log  jsonb not null default '[]'::jsonb,   -- VIS-3
  status      text not null default 'pending' check (status in ('pending','approved','fallback','failed')),
  created_at  timestamptz not null default now()
);

create index on public.classes (teacher_id);
create index on public.enrollments (student_id);
create index on public.assignments (class_id);
create index on public.problems (assignment_id);
create index on public.sessions (student_id);
create index on public.sessions (problem_id);
create index on public.turns (session_id);
create index on public.misconception_events (problem_id);
create index on public.misconception_events (session_id);
create index on public.visuals (problem_id);

-- ───────────── Helpers (security definer avoids RLS recursion) ─────────────
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_class_teacher(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.classes where id = cid and teacher_id = auth.uid())
$$;

create or replace function public.is_enrolled(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.enrollments where class_id = cid and student_id = auth.uid())
$$;

create or replace function public.class_of_problem(pid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select a.class_id from public.problems p join public.assignments a on a.id = p.assignment_id where p.id = pid
$$;

create or replace function public.problem_is_published(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select a.published from public.problems p join public.assignments a on a.id = p.assignment_id where p.id = pid), false)
$$;

create or replace function public.owns_session(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.sessions where id = sid and student_id = auth.uid())
$$;

create or replace function public.teaches_session(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_class_teacher(public.class_of_problem((select problem_id from public.sessions where id = sid)))
$$;

-- Profile row on first Google sign-in (ACC-1)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
          new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ACC-2: pick role once. Admin is never self-assignable.
create or replace function public.set_my_role(new_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if new_role not in ('student','teacher') then raise exception 'invalid role'; end if;
  update public.profiles set role = new_role where id = auth.uid() and role is null;
  if not found then raise exception 'role already set'; end if;
end $$;

-- ACC-4: join by code (students can't see classes before enrolling, so this is definer)
create or replace function public.join_class(code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if public.my_role() is distinct from 'student' then raise exception 'only students can join classes'; end if;
  select id into cid from public.classes where join_code = upper(trim(code));
  if cid is null then raise exception 'invalid join code'; end if;
  insert into public.enrollments (class_id, student_id) values (cid, auth.uid()) on conflict do nothing;
  return cid;
end $$;

-- Teacher can rotate a leaked code
create or replace function public.regenerate_join_code(cid uuid) returns text
language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if not public.is_class_teacher(cid) then raise exception 'not your class'; end if;
  update public.classes set join_code = public.generate_join_code() where id = cid returning join_code into c;
  return c;
end $$;

revoke execute on all functions in schema public from anon, public;
grant execute on function public.set_my_role(text), public.join_class(text), public.regenerate_join_code(uuid) to authenticated;
grant execute on function public.generate_join_code(), public.my_role(), public.is_class_teacher(uuid), public.is_enrolled(uuid),
  public.class_of_problem(uuid), public.problem_is_published(uuid), public.owns_session(uuid),
  public.teaches_session(uuid) to authenticated;

-- ───────────── RLS ─────────────
alter table public.profiles             enable row level security;
alter table public.classes              enable row level security;
alter table public.enrollments          enable row level security;
alter table public.assignments          enable row level security;
alter table public.problems             enable row level security;
alter table public.problem_solutions    enable row level security;
alter table public.sessions             enable row level security;
alter table public.turns                enable row level security;
alter table public.misconception_events enable row level security;
alter table public.visuals              enable row level security;

-- profiles: self; teachers see their enrolled students
create policy profiles_select on public.profiles for select to authenticated using (
  id = auth.uid()
  or exists (select 1 from public.enrollments e where e.student_id = profiles.id and public.is_class_teacher(e.class_id))
);
-- role changes only via set_my_role()
revoke update on public.profiles from authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- classes
create policy classes_select on public.classes for select to authenticated using (teacher_id = auth.uid() or public.is_enrolled(id));
create policy classes_insert on public.classes for insert to authenticated with check (teacher_id = auth.uid() and public.my_role() = 'teacher');
create policy classes_update on public.classes for update to authenticated using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
create policy classes_delete on public.classes for delete to authenticated using (teacher_id = auth.uid());

-- enrollments (inserts go through join_class)
create policy enroll_select on public.enrollments for select to authenticated using (student_id = auth.uid() or public.is_class_teacher(class_id));
create policy enroll_delete on public.enrollments for delete to authenticated using (student_id = auth.uid() or public.is_class_teacher(class_id));

-- assignments
create policy asg_teacher on public.assignments for all to authenticated using (public.is_class_teacher(class_id)) with check (public.is_class_teacher(class_id));
create policy asg_student on public.assignments for select to authenticated using (published and public.is_enrolled(class_id));

-- problems
create policy prob_teacher on public.problems for all to authenticated
  using (public.is_class_teacher(public.class_of_problem(id)))
  with check (exists (select 1 from public.assignments a where a.id = assignment_id and public.is_class_teacher(a.class_id)));
create policy prob_student on public.problems for select to authenticated
  using (public.problem_is_published(id) and public.is_enrolled(public.class_of_problem(id)));

-- problem_solutions: teacher only. Tutor reads these with the service role server-side.
create policy sol_teacher on public.problem_solutions for all to authenticated
  using (public.is_class_teacher(public.class_of_problem(problem_id)))
  with check (public.is_class_teacher(public.class_of_problem(problem_id)));

-- sessions: students create/read their own; hints_used/mastery are written by the server (service role)
create policy sess_select on public.sessions for select to authenticated using (student_id = auth.uid() or public.teaches_session(id));
create policy sess_insert on public.sessions for insert to authenticated with check (
  student_id = auth.uid() and hints_used = 0 and mastery is null
  and public.problem_is_published(problem_id) and public.is_enrolled(public.class_of_problem(problem_id))
);
create policy sess_teacher_update on public.sessions for update to authenticated using (public.teaches_session(id)) with check (public.teaches_session(id));

-- turns: ducky turns come only from the server
create policy turns_select on public.turns for select to authenticated using (public.owns_session(session_id) or public.teaches_session(session_id));
create policy turns_insert on public.turns for insert to authenticated with check (speaker = 'student' and structured is null and public.owns_session(session_id));

-- misconception_events / visuals: read-only to clients, written by server
create policy mis_select on public.misconception_events for select to authenticated using (public.owns_session(session_id) or public.teaches_session(session_id));
create policy vis_select on public.visuals for select to authenticated using (
  public.is_class_teacher(public.class_of_problem(problem_id))
  or (session_id is not null and public.owns_session(session_id))
);
