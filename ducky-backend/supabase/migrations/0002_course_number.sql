-- Course number (e.g. "PHYS 1401"), set by the teacher when creating a class (ACC-3).
-- Shown next to the class name everywhere classes are listed.

alter table public.classes add column course_number text;

-- Required for every class created or edited from now on. NOT VALID skips rows that
-- existed before this migration, so it applies cleanly; those can be backfilled with
--   update public.classes set course_number = '...' where id = '...';
-- and then checked with
--   alter table public.classes validate constraint classes_course_number_check;
alter table public.classes
  add constraint classes_course_number_check
  check (course_number is not null and course_number ~ '^[A-Z0-9][A-Z0-9 .-]{0,18}[A-Z0-9]$')
  not valid;
