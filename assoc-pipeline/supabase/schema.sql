-- Membership dashboard schema. Run once in the Supabase SQL editor.
-- Author: Ishita Tibrewal
-- Safe to re-run: uses IF NOT EXISTS / OR REPLACE where possible.

create extension if not exists pgcrypto;

-- ============ Reference ============
create table if not exists public.associations (
  code text primary key,                 -- matches the Assn column, e.g. 'NADIIIAA'
  name text,
  branding jsonb default '{}'::jsonb,    -- {"primary":"#242931","accent":"#962a2e","logo_url":"..."}
  created_at timestamptz default now()
);

-- ============ People and access ============
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  association_code text references public.associations(code),
  role text not null default 'lead' check (role in ('lead','admin')),
  status text not null default 'pending' check (status in ('pending','approved','revoked')),
  invite_id uuid,
  created_at timestamptz default now(),
  approved_at timestamptz,
  approved_by uuid
);

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  token text unique not null default encode(gen_random_bytes(16),'hex'),
  association_code text references public.associations(code),  -- null = invitee picks
  note text,
  max_uses int not null default 25,
  uses int not null default 0,
  expires_at timestamptz not null default now() + interval '30 days',
  revoked boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- ============ Pipeline outputs ============
create table if not exists public.pipeline_runs (
  id uuid primary key default gen_random_uuid(),
  as_of date not null,
  status text not null,
  report jsonb not null,
  created_at timestamptz default now()
);

create table if not exists public.association_snapshots (
  association_code text not null references public.associations(code),
  as_of date not null,
  payload jsonb not null,                -- aggregates + NACDA text, no personal data
  created_at timestamptz default now(),
  primary key (association_code, as_of)
);

create table if not exists public.portfolio_snapshots (
  as_of date primary key,
  payload jsonb not null,
  created_at timestamptz default now()
);

-- Restricted: contact details. Only the latest week is kept per association.
create table if not exists public.lapsed_members (
  association_code text not null references public.associations(code),
  as_of date not null,
  member_id bigint not null,
  first_name text, last_name text, title text, email text,
  organization text, city text, state text, role text, member_type text,
  division text, conference text, is_primary_member boolean,
  primary key (association_code, member_id)
);

-- ============ Helper functions (bypass RLS safely) ============
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where user_id = auth.uid() and role = 'admin' and status = 'approved');
$$;

create or replace function public.my_association() returns text
language sql stable security definer set search_path = public as $$
  select association_code from profiles where user_id = auth.uid() and status = 'approved';
$$;

-- Called by the signup page after the user creates their account.
create or replace function public.redeem_invite(p_token text, p_association text, p_full_name text)
returns text language plpgsql security definer set search_path = public as $$
declare inv invites; v_email text;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select * into inv from invites where token = p_token for update;
  if inv.id is null or inv.revoked or inv.expires_at < now() or inv.uses >= inv.max_uses then
    raise exception 'Invite link is invalid or expired';
  end if;
  if inv.association_code is not null and inv.association_code <> p_association then
    raise exception 'This invite is for %', inv.association_code;
  end if;
  if not exists (select 1 from associations where code = p_association) then
    raise exception 'Unknown association';
  end if;
  select email into v_email from auth.users where id = auth.uid();
  insert into profiles(user_id, email, full_name, association_code, invite_id)
  values (auth.uid(), v_email, p_full_name, p_association, inv.id)
  on conflict (user_id) do nothing;
  update invites set uses = uses + 1 where id = inv.id;
  return 'pending';
end $$;

-- Lets the signup page show valid association choices for a token without exposing the invites table.
create or replace function public.check_invite(p_token text)
returns table(valid boolean, association_code text)
language sql stable security definer set search_path = public as $$
  select (not revoked and expires_at > now() and uses < max_uses), association_code
  from invites where token = p_token;
$$;

-- ============ Row-level security ============
alter table public.associations          enable row level security;
alter table public.profiles              enable row level security;
alter table public.invites               enable row level security;
alter table public.pipeline_runs         enable row level security;
alter table public.association_snapshots enable row level security;
alter table public.portfolio_snapshots   enable row level security;
alter table public.lapsed_members        enable row level security;

drop policy if exists assoc_read on public.associations;
create policy assoc_read on public.associations for select using (true);           -- names for the signup picker
drop policy if exists assoc_admin on public.associations;
create policy assoc_admin on public.associations for all using (is_admin()) with check (is_admin());

drop policy if exists prof_self on public.profiles;
create policy prof_self on public.profiles for select using (user_id = auth.uid() or is_admin());
drop policy if exists prof_admin on public.profiles;
create policy prof_admin on public.profiles for update using (is_admin()) with check (is_admin());

drop policy if exists inv_admin on public.invites;
create policy inv_admin on public.invites for all using (is_admin()) with check (is_admin());

drop policy if exists runs_admin on public.pipeline_runs;
create policy runs_admin on public.pipeline_runs for select using (is_admin());

drop policy if exists snap_read on public.association_snapshots;
create policy snap_read on public.association_snapshots for select
  using (is_admin() or association_code = my_association());

drop policy if exists port_admin on public.portfolio_snapshots;
create policy port_admin on public.portfolio_snapshots for select using (is_admin());

drop policy if exists lapsed_read on public.lapsed_members;
create policy lapsed_read on public.lapsed_members for select
  using (is_admin() or association_code = my_association());
-- No insert/update/delete policies on pipeline tables: only the service key (GitHub Action) writes them.

-- ============ Storage for weekly files (private) ============
insert into storage.buckets (id, name, public) values ('uploads','uploads', false)
on conflict (id) do nothing;
drop policy if exists uploads_admin on storage.objects;
create policy uploads_admin on storage.objects for all
  using (bucket_id = 'uploads' and public.is_admin())
  with check (bucket_id = 'uploads' and public.is_admin());

-- ============ Seed associations ============
insert into public.associations(code) values
 ('CABMA'),('CCA'),('CEFMA'),('DII ADA'),('DIIICA'),('FBS ADA'),('FCS ADA'),('IAAA ADA'),('ICLA'),('MOAA'),
 ('N4A'),('NAAC'),('NAADD'),('NAATSO'),('NACDA'),('NACMA'),('NADIIIAA'),('NAIA ADA'),('NATYCAA')
on conflict (code) do nothing;
update public.associations set branding = '{"primary":"#242931","accent":"#962a2e"}'::jsonb where code = 'NADIIIAA';

-- ============ Make yourself admin (run AFTER you sign up once in the app) ============
-- insert into public.profiles(user_id, email, role, status, approved_at)
-- select id, email, 'admin', 'approved', now() from auth.users where email = 'YOUR_EMAIL'
-- on conflict (user_id) do update set role = 'admin', status = 'approved', approved_at = now();
