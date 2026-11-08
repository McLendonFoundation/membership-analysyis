# Membership Dashboard (web)

Next.js front end for the association membership pipeline. Created by Ishita Tibrewal.
Reads from Supabase with the public anon key; row-level security decides what each user sees.

## Pages
- `/signup?token=...` create an account from an invite link and pick an association (waits for approval)
- `/login`, `/pending`
- `/dashboard` NACDA Framework dashboard for the user's association (admins can switch associations)
- `/admin` users and approvals, invite links, all-associations view, weekly file upload, run history

## Local
```
cp .env.example .env.local   # fill in URL and anon key
npm install
npm run dev
```

## Vercel
Root directory: `web`. Environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
and optionally `GITHUB_DISPATCH_TOKEN` + `GITHUB_REPO` for the "Run the analysis now" button.
Never add the Supabase service_role key here.
