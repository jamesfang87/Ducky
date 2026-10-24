\set ON_ERROR_STOP 1
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select count(*) as solutions_visible_to_student from public.problem_solutions;
select count(*) as problems_visible_to_student from public.problems;
insert into public.sessions (problem_id, student_id) select id, auth.uid() from public.problems;
insert into public.turns (session_id, idx, speaker, input_mode, text) select id,0,'student','text','hi' from public.sessions;
\echo expect failures:
\set ON_ERROR_STOP 0
insert into public.turns (session_id, idx, speaker, text) select id,1,'ducky','answer' from public.sessions;
update public.sessions set hints_used = 0;
select count(*) as rows_updated_hint from public.sessions where hints_used <> 0;
update public.profiles set role='teacher' where id=auth.uid();
select public.set_my_role('teacher');
insert into public.classes (teacher_id,name) values (auth.uid(),'Fake');
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select public.set_my_role('admin');
select count(*) as other_user_sees_classes from public.classes;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select count(*) as teacher_sees_solutions, (select count(*) from public.profiles) as teacher_sees_profiles from public.problem_solutions;
