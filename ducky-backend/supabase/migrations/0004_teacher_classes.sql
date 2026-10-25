-- Teacher view in the ducky/ app: create classes and post problem sets.
-- Safe to run whether or not 0002_course_number.sql was applied, and safe to re-run.

-- Course number (from 0002), e.g. "PHYS 1401".
alter table public.classes add column if not exists course_number text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'classes_course_number_check') then
    alter table public.classes
      add constraint classes_course_number_check
      check (course_number is not null and course_number ~ '^[A-Z0-9][A-Z0-9 .-]{0,18}[A-Z0-9]$')
      not valid;
  end if;
end $$;

-- Students can't read their teacher's profile under RLS, so the class keeps the
-- name to show them ("D. Rivera"). Set from the teacher's profile when the class is created.
alter table public.classes add column if not exists teacher_name text check (teacher_name is null or length(teacher_name) <= 120);
