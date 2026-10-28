# Authentication and role security setup

The portal continues to use its existing Supabase project and public frontend key. The additive role-security migration preserves school rows; do not drop or recreate `profiles`, `students`, `teachers`, or any other existing table.

## Live project status

The `admin-create-school-account` Edge Function is deployed to the configured project. `APP_URL` and `ALLOWED_ORIGINS` currently permit local development at `http://127.0.0.1:5173` and `http://localhost:5173`; add the deployed school portal's exact origin before using the function from production.

The live database has not had the role-security migration applied. Inspection found that the migration references `parents`, `fees`, `events`, and `exams` tables that do not exist in this project's current schema, so do not apply that migration unchanged. RLS is currently disabled on the live public tables, and the `anon` database role has `SELECT` privileges on student and profile records. Treat these records as exposed to unauthenticated database reads; do not use real student data in production until a schema-matched RLS migration is reviewed and applied.

## Apply database security

1. Back up the Supabase database.
2. If this is a new project with no school tables, run `SUPABASE_SETUP.sql` once as the schema bootstrap. Do not run `FINAL.sql` or `SUPABASE_FIX.sql`; they are intentionally disabled legacy scripts. Existing projects should skip the bootstrap.
3. In the Supabase SQL Editor, run `supabase/migrations/20261027000000_role_security.sql`.
4. Confirm the migration succeeded before deploying the frontend. The migration enables RLS, removes anonymous table/sequence access, and limits authenticated reads/writes by role and record ownership.
5. Inspect and repair duplicate `profiles.student_id`, `teachers.user_id`, or `students.user_id` links if the migration reports a uniqueness error. The migration copies existing `profiles.student_id` links to `students.user_id`; it does not delete school records.

The initial administrator must be provisioned by a trusted project owner, not through public registration:

1. Create the first administrator in Supabase **Authentication → Users**.
2. In the SQL Editor, replace the example values below with that account's actual details and execute it:

   ```sql
   INSERT INTO public.profiles (id, first_name, last_name, email, role, status)
   SELECT id, 'First', 'Last', lower(email), 'admin', 'active'
   FROM auth.users
   WHERE lower(email) = lower('admin@example.edu');
   ```

3. Confirm exactly one row was inserted. Do not reuse this process to promote ordinary accounts; public account invitations only accept the `teacher` or `student` roles.

## Deploy administrator account functions

The **Add Student** and **Add Teacher** forms create the school record and login account together. The administrator supplies the email and an initial password (at least 8 characters); active accounts can sign in with those credentials immediately. Inactive accounts remain blocked until activated. The password is sent only to Supabase Auth and is never written to a school table or sent by email. Share initial passwords with users through a secure channel and advise them to change them after signing in.

The separate **Admin → Invite User** flow remains available for accounts linked to school records that already exist. **Admin → Teaching Assignments** continues to manage teacher-subject access.

From the project directory, link the Supabase CLI to the existing project and deploy the Edge Function:

```powershell
supabase link --project-ref <your-project-ref>
supabase secrets set APP_URL="https://your-school-domain.example" ALLOWED_ORIGINS="https://your-school-domain.example,http://localhost:5173,http://127.0.0.1:5173"
supabase functions deploy admin-invite-user
supabase functions deploy admin-create-school-account
```

The local Edge Function configuration is in `supabase/config.toml`.

Run the commands from this project directory after installing the Supabase CLI and linking the existing project. Set `APP_URL` to the exact production origin without a trailing slash. `ALLOWED_ORIGINS` is a comma-separated, exact origin allowlist. Include whichever local origin is in the browser address bar: `http://localhost:5173` and/or `http://127.0.0.1:5173` are different origins. After changing secrets, redeploy the function. Remove local origins from the production allowlist when no longer needed. Supabase provides `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to deployed Edge Functions. The service-role key must remain server-side and must never be added to `.env.local`, frontend code, or a Vite `VITE_*` variable.

If account creation displays a connection error, verify the function is deployed with `supabase functions list`, then verify the exact page origin appears in `ALLOWED_ORIGINS` and redeploy `admin-create-school-account`.

Both functions validate the caller's active administrator profile and accept only `teacher`/`student`. `admin-create-school-account` creates a confirmed Supabase Auth user with the administrator-provided password, the school record, and its profile link; it removes the newly created data if setup fails. `admin-invite-user` creates an Auth invitation, profile, and links an existing record. Do not expose service-role credentials to the browser.

## Configure email and redirect URLs

In Supabase **Authentication → URL Configuration**:

- Set **Site URL** to the deployed school portal origin.
- Add the exact allowed redirects `https://your-school-domain.example/reset-password.html` and, for local testing, `http://localhost:5173/reset-password.html`.
- Keep any other deployed portal origin in the allowlist only if it is actively used.

In **Authentication → SMTP Settings**, configure a real mail provider with its SMTP host, port, username, password, sender name, and verified sender address. Configure the **Invite user** and **Reset password** email templates to use Supabase's secure `{{ .ConfirmationURL }}` link. Do not put passwords in templates. The invitation and password reset use Supabase's time-limited, one-time Auth links and return to `/reset-password.html`.

The app only shows a successful request message when Supabase accepts the request; an Auth/SMTP API error is shown as an error. Verify delivery through the configured provider's logs. The generic recovery response does not disclose whether an address is registered.

## Configure frontend environment

Keep the existing `.env.local` settings `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` pointing at the existing project. These are the project URL and public anon/publishable key only. Never use the service-role key in the Vite app.

Disable public user sign-up in Supabase **Authentication → Providers / Sign-in settings**. Users are provisioned by the administrator-only Edge Functions. A manually created Auth user without a profile cannot sign in to a school dashboard.

## Class, subject, and student ownership

- The existing `classes.class_teacher` relationship is a class-level assignment. Manage it through the existing class editor.
- The migration derives `class_subjects` from matching class/section/subject timetable entries and keeps it in sync when timetable entries are added or changed.
- Use **Admin → Teaching Assignments** to assign each class subject to one teacher. Only those assignment rows authorize a teacher to enter results for that subject/class. A class teacher or a teacher assigned a subject in that class can record class attendance; teachers can update only attendance/results they recorded themselves.
- A student's existing `profiles.student_id` link is retained and backfilled to `students.user_id`. New invitations require an unlinked school record.

The student dashboard calculates each subject total as the equal-weighted average of its saved assessment marks, then calculates the overall average from those subject totals. It uses a 50/100 pass threshold with descriptive bands (85+, 70+, 50+, below 50). No official assessment weighting scheme exists in the current schema; confirm that threshold and weighting with the school before relying on the summary for official grading. Individual marks remain capped at 100.

## Verification still required against the live project

The local workspace contains schema/setup SQL but no database-inspector connection was available in this session. The live migration, administrator bootstrap, deployed Edge Function, SMTP delivery, and complete reset flow have therefore **not** been run or verified against a real test account. After configuration, test with one administrator, teacher, and student, including direct REST requests for another student's records and an unassigned teacher class/subject. Verify real invitation/reset delivery and successful password change in the provider logs before rollout.
