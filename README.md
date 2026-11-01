# SLG Housekeeping & Facility Services: Daily Attendance

A small web app for recording daily worker attendance for six teams
(Anandapuram, SLG, Madam, Kothavalasa, Airport, Dj) and viewing daily and
monthly totals.

- **Stack:** Next.js (App Router), TypeScript, Tailwind CSS, Supabase (Postgres), Recharts, Vitest
- **Pages:** `/` attendance form, `/dashboard` detail tables, charts and Excel download
- **Rules:** one record per date, earliest date 21/10/2026, dates shown as DD/MM/YYYY,
  a day's record can be corrected or deleted (with a confirmation step)

## 1. Supabase setup

1. Create a free project at <https://supabase.com>.
2. Open **SQL Editor**, paste the whole of [`supabase/schema.sql`](supabase/schema.sql) and click **Run**.
   Supabase may warn about "destructive operations" because the script contains
   `drop ... if exists` lines. They only touch objects the script itself creates.
3. Check **Table Editor** shows `daily_attendance`.
4. Open **Project Settings -> API** and copy the **Project URL** and the
   **anon / publishable** key.

The schema turns on Row Level Security and allows `select`, `insert`, `update`
and `delete` for the `anon` role. Delete is what powers the **Delete this record**
button on the attendance form.

If you set the project up before delete was added, run this once in the SQL Editor:

```sql
create policy "anon can delete attendance"
  on public.daily_attendance for delete to anon using (true);
grant delete on public.daily_attendance to anon;
notify pgrst, 'reload schema';
```

If the app says *"Could not find the table 'public.daily_attendance' in the schema cache"*,
the table is missing or the cache is stale. Re-run the SQL, then run
`notify pgrst, 'reload schema';` in the SQL Editor.

## 2. Run locally

Requires Node.js 18.18 or newer.

```bash
npm install
cp .env.example .env.local   # on Windows PowerShell: Copy-Item .env.example .env.local
```

Edit `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
```

Then start the dev server and open <http://localhost:3000>:

```bash
npm run dev
```

Other commands:

```bash
npm test         # unit tests for lib/attendance.ts
npm run build    # production build
npm run lint
```

Never put the Supabase `service_role` key in this project. The app only needs
the public anon key.

## 3. Deploy to Vercel

1. Push this project to a GitHub repository.
2. In Vercel choose **Add New -> Project**, import the GitHub repository and keep the
   detected **Next.js** settings.
3. Under **Environment Variables** add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

   (The Supabase Vercel integration adds these for you; just check both are present.)
4. Click **Deploy**.
5. After changing environment variables later, redeploy: **Deployments -> latest -> Redeploy**.
   New values only apply to new deployments.

## 4. Project layout

```
app/page.tsx                  attendance form page
app/dashboard/page.tsx        dashboard page
components/AttendanceForm.tsx form with load/insert/update logic
components/Dashboard.tsx      day and month tables, charts, Excel button
components/DateField.tsx      DD/MM/YYYY input with calendar button
lib/attendance.ts             constants, date helpers, calculations, table and export data
lib/excel.ts                  builds and downloads the .xlsx file
lib/attendance.test.ts        unit tests
lib/attendance-db.ts          Supabase reads and the upsert
lib/supabase.ts               Supabase client (anon key only)
supabase/schema.sql           table, constraints, trigger, RLS policies
```

## 5. Calculations

- Daily total = sum of numeric team values (`Leave` counts as 0)
- Teams working = teams with a number greater than 0
- Teams on Leave = teams marked `Leave`
- Monthly worker-days = sum of daily totals for dates in that month

## 6. Access and security

The app has no login. Anyone who has the site URL can add, correct or delete attendance,
so keep the URL private. Because the anon key is public by design, Row Level
Security and the table's CHECK constraints are the only protection, and that
includes delete: anyone with the link can delete a day's record. If you later need to restrict who can edit,
add Supabase Auth and tighten the policies in `supabase/schema.sql`.
