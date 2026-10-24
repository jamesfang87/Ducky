# Ducky backend setup

## What's in this branch
- `lib/llm/callModel.ts`: one function for every model call. Defaults to Muse Spark at `api.meta.ai/v1`. Handles structured output (JSON schema) and image/PDF parts. A second provider is used only when `LLM_FALLBACK=1`.
- `scripts/probe-muse.ts`: `npm run probe:muse` checks text, structured output, image input and PDF input.
- `.env.example`: copy to `.env.local` and fill in.

The Supabase project (lpckuttkravpguzqipar) already has a schema (profiles, classes, enrollments, assignments, problems, problem_solutions, sessions, turns, visuals, misconception_events). Don't run any other migration over it. Build against those tables.

## Still to do
1. Muse: get a key at dev.meta.ai, set `META_API_KEY` in `.env.local`, run `npm install && npm run probe:muse`. You want four checkmarks. If PDF fails, send PDF pages as images.
2. Google sign-in: Google Cloud OAuth client (Web), redirect URI `https://lpckuttkravpguzqipar.supabase.co/auth/v1/callback`, then enable the Google provider in Supabase and add `http://localhost:3000/auth/callback` under URL Configuration.
3. Install `@supabase/supabase-js` and `@supabase/ssr`, then replace `signIn()` in `app/page.tsx` with `supabase.auth.signInWithOAuth({ provider: "google" })`.
4. Replace the mock seams listed in README.md (`getTutorReply()` first, using `callModel`). Keep the system prompt and solutions server-side; never return `problem_solutions` to the browser.
