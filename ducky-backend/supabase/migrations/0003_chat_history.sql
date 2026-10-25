-- Chat history for the tutoring sessions in the ducky/ app, so a conversation survives a
-- page reload and signing out and back in. One row per (student, session); `messages` is the
-- transcript exactly as the chat shows it (student, tutor and system/flag lines).
-- session_id is the app's session key ("demo", "demo-cs"), not public.sessions.id.

create table public.chat_histories (
  user_id     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  session_id  text not null check (length(session_id) between 1 and 100),
  messages    jsonb not null default '[]'::jsonb check (jsonb_typeof(messages) = 'array'),
  updated_at  timestamptz not null default now(),
  primary key (user_id, session_id)
);

alter table public.chat_histories enable row level security;

-- Owner only.
create policy chat_select on public.chat_histories for select to authenticated using (user_id = auth.uid());
create policy chat_insert on public.chat_histories for insert to authenticated with check (user_id = auth.uid());
create policy chat_update on public.chat_histories for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy chat_delete on public.chat_histories for delete to authenticated using (user_id = auth.uid());
