# Authentication and role security setup

The portal continues to use its existing Supabase project and public frontend key. The additive role-security migration preserves school rows; do not drop or recreate `profiles`, `students`, `teachers`, or any other existing table.

## Live project status

The `admin-create-school-account` Edge Function must be deployed to the configured project. Its CORS allowlist includes the production portal origins `https://sululta-schools-portal.vercel.app` and `https://sululta-school-portal.vercel.app`; configure `APP_URL` and `ALLOWED_ORIGINS` for the deployment as described below.

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

The **Add Student** and **Add Teacher** forms create the school record and Auth account together. By default, they email a Supabase invitation link to `/reset-password.html`; the recipient chooses their password through Supabase Auth. The optional **Set a temporary password** button instead lets the administrator provide an initial password (at least 8 characters), creates a confirmed Auth account, and skips the invitation email. Share temporary passwords through a secure channel. Inactive school accounts remain blocked until activated.

**Admin → Add Account** creates Admin, Teacher, or Student accounts using the same invitation-by-default or optional temporary-password choice. Teacher and Student accounts must link to an existing active school record; a new account is not created if that record is already linked. The Admin **Users** page has a **Send Password Reset** action for teacher/student accounts. It sends a one-time Supabase recovery link to the email address on the server-side profile lookup; the browser never receives the service-role key.

Both operations require an active Admin profile. `admin-create-school-account` handles the Add Student/Teacher forms; `admin-invite-user` handles Admin → Add Account and password reset requests. **Admin → Teaching Assignments** continues to manage teacher-subject access.

From the project directory, link the Supabase CLI to the existing project and deploy the Edge Function:

```powershell
supabase link --project-ref <your-project-ref>
supabase secrets set APP_URL="https://sululta-schools-portal.vercel.app" ALLOWED_ORIGINS="https://sululta-schools-portal.vercel.app,https://sululta-school-portal.vercel.app,http://localhost:5173,http://127.0.0.1:5173"
supabase functions deploy admin-create-school-account
supabase functions deploy admin-invite-user
```

The local Edge Function configuration is in `supabase/config.toml`; JWT verification is enabled for both functions.

Run the commands from this project directory after installing the Supabase CLI and linking the existing project. Set `APP_URL` to the exact active production origin without a trailing slash; this server-controlled value determines the Auth email redirect and must not be supplied by the browser. `ALLOWED_ORIGINS` is a comma-separated, exact origin allowlist. Include whichever local origin is in the browser address bar: `http://localhost:5173` and/or `http://127.0.0.1:5173` are different origins. Both known production portal origins are also allowed by the function source. To repair a deployed function that is returning `Origin is not allowed`, update the `ALLOWED_ORIGINS` Edge Function secret in the Supabase Dashboard or with `supabase secrets set`, including the exact production origin, for example:

```powershell
supabase secrets set ALLOWED_ORIGINS="https://sululta-schools-portal.vercel.app,https://sululta-school-portal.vercel.app"
```

The function reads this secret at runtime; redeploy `admin-create-school-account` after changing function code, but a secret-only change does not require a code deployment. Remove local origins from the production allowlist when no longer needed. Supabase provides `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to deployed Edge Functions. The service-role key must remain server-side and must never be added to `.env.local`, frontend code, or a Vite `VITE_*` variable.

After changing either function, redeploy it with the matching `supabase functions deploy` command. Verify both functions appear in `supabase functions list` and that the exact page origin appears in `ALLOWED_ORIGINS`.

`admin-create-school-account` creates invited Supabase Auth users, then creates the school record and profile; it removes newly created records if account setup fails. `admin-invite-user` creates an invitation and profile for Admin → Add Account, or sends a reset email after resolving the target email from its profile ID. It restricts resets to teacher/student roles and rolls back a partially created invited account if setup fails. Do not expose service-role credentials to the browser.

## Configure email and redirect URLs

In Supabase **Authentication → URL Configuration**:

- Set **Site URL** to the deployed school portal origin.
- Add the exact allowed redirects `https://sululta-schools-portal.vercel.app/reset-password.html`, `https://sululta-school-portal.vercel.app/reset-password.html`, and, for local testing, `http://localhost:5173/reset-password.html` and/or `http://127.0.0.1:5173/reset-password.html`.
- Keep any other deployed portal origin in the allowlist only if it is actively used.

In **Authentication → SMTP Settings**, configure a real mail provider with its SMTP host, port, username, password, sender name, and verified sender address. Configure the **Invite user** and **Reset password** email templates to use Supabase's secure `{{ .ConfirmationURL }}` link. Do not put passwords in templates. The invitation and password reset use Supabase's time-limited, one-time Auth links and return to `/reset-password.html`.

The app only shows a successful request message when Supabase accepts the request; an Auth/SMTP API error is shown as an error. Verify delivery through the configured provider's logs. The generic recovery response does not disclose whether an address is registered.

## Configure frontend environment

Keep the existing `.env.local` settings `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` pointing at the existing project. Add those same two public settings to the Vercel project's **Settings → Environment Variables** for Production (and Preview if used), then redeploy the frontend. The Vercel build command is `npm run build` and the output directory is `dist`. These are the project URL and public anon/publishable key only. Never add `SUPABASE_SERVICE_ROLE_KEY` to Vercel frontend variables, `.env.local`, or any `VITE_*` setting.

Deploy the changed frontend to the existing Vercel project after deploying both Edge Functions. Verify that the deployed site origin exactly matches `APP_URL` and is in the Edge Functions' origin allowlist.

Disable public user sign-up in Supabase **Authentication → Providers / Sign-in settings**. Users are provisioned by the administrator-only Edge Functions. A manually created Auth user without a profile cannot sign in to a school dashboard.

## Class, subject, and student ownership

- The existing `classes.class_teacher` relationship is a class-level assignment. Manage it through the existing class editor.
- The migration derives `class_subjects` from matching class/section/subject timetable entries and keeps it in sync when timetable entries are added or changed.
- Use **Admin → Teaching Assignments** to assign each class subject to one teacher. Only those assignment rows authorize a teacher to enter results for that subject/class. A class teacher or a teacher assigned a subject in that class can record class attendance; teachers can update only attendance/results they recorded themselves.
- A student's existing `profiles.student_id` link is retained and backfilled to `students.user_id`. New invitations require an unlinked school record.

The student dashboard calculates each subject total as the equal-weighted average of its saved assessment marks, then calculates the overall average from those subject totals. It uses a 50/100 pass threshold with descriptive bands (85+, 70+, 50+, below 50). No official assessment weighting scheme exists in the current schema; confirm that threshold and weighting with the school before relying on the summary for official grading. Individual marks remain capped at 100.

## Verification still required against the live project

The local workspace contains schema/setup SQL but no database-inspector connection was available in this session. The live migration, administrator bootstrap, deployed Edge Function, SMTP delivery, and complete reset flow have therefore **not** been run or verified against a real test account. After configuration, test with one administrator, teacher, and student, including direct REST requests for another student's records and an unassigned teacher class/subject. Verify real invitation/reset delivery and successful password change in the provider logs before rollout.
