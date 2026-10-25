-- A teacher can also be a student in someone else's class. Joining by code now works for both roles,
-- but nobody can enroll in a class they teach.
create or replace function public.join_class(code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if public.my_role() is null then raise exception 'finish setting up your account first'; end if;
  select id into cid from public.classes where join_code = upper(trim(code));
  if cid is null then raise exception 'invalid join code'; end if;
  if exists (select 1 from public.classes where id = cid and teacher_id = auth.uid()) then
    raise exception 'you teach this class';
  end if;
  insert into public.enrollments (class_id, student_id) values (cid, auth.uid()) on conflict do nothing;
  return cid;
end $$;
