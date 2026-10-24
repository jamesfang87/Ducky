# Ducky: Foundation + Accounts setup

## 1. Supabase database (≈2 min)
1. Open https://supabase.com/dashboard/project/lpckuttkravpguzqipar/sql/new
2. Paste all of `supabase/migrations/0001_foundation.sql` and click **Run**.
3. Check: **Table Editor** shows 10 tables, each marked "RLS enabled".

## 2. Google OAuth client (≈5 min)
In https://console.cloud.google.com/auth/overview?project=dotted-memory-509806-u5
1. **Branding**: App name `Ducky`, your support email. Save.
2. **Audience**: External. While in "Testing", add yourself and any testers under **Test users**.
3. **Data access**: add scopes `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`.
4. **Clients → Create client** → type **Web application**, name `Ducky web`:
   - Authorized JavaScript origins: `http://localhost:3000` (plus your production URL later)
   - Authorized redirect URIs: `https://lpckuttkravpguzqipar.supabase.co/auth/v1/callback`
5. Copy the **Client ID** and **Client secret**.

## 3. Turn on Google in Supabase
1. https://supabase.com/dashboard/project/lpckuttkravpguzqipar/auth/providers → **Google** → Enable, paste the Client ID and secret, Save.
2. https://supabase.com/dashboard/project/lpckuttkravpguzqipar/auth/url-configuration
   - Site URL: `http://localhost:3000`
   - Redirect URLs: add `http://localhost:3000/auth/callback` (plus your production URL + `/auth/callback` later)

## 4. Environment variables
Fill in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`: from Project Settings → API Keys.
- `META_API_KEY`: from your project at dev.meta.ai/platform.

## 5. Meta: confirm Muse supports what we need
```bash
curl -fsSL https://dev.meta.ai/install.sh | bash   # Meta's CLI, optional
npm install
npm run probe:muse
```
You want ✅ on all four: text, structured output, image input, and PDF input. If PDF input fails, we'll render PDF pages to images before sending them.

## 6. Run it
```bash
npm run dev   # http://localhost:3000
```
Try it: sign in → choose **Teacher** → create a class (shows the code and QR) → in a private window, sign in with another Google account → choose **Student** → scan the QR or enter the code → the class appears under My classes.

## What's where
| Piece | File |
|---|---|
| Tables, RLS, join code, role, and join functions | `supabase/migrations/0001_foundation.sql` |
| `callModel()` with fallback flag (STU-7) | `src/lib/llm/callModel.ts` |
| Muse capability probe | `scripts/probe-muse.ts` |
| Google sign-in | `src/app/(auth)/login`, `src/app/auth/callback`, `src/middleware.ts` |
| Role picker (ACC-2) | `src/app/onboarding` |
| Classes + QR (ACC-3) | `src/app/teacher`, `src/app/teacher/classes/[id]` |
| Join by code or QR (ACC-4) | `src/app/join`, `src/app/student` |
