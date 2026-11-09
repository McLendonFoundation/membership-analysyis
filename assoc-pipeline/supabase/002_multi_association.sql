-- Migration 002: let a user belong to several associations.
-- Run once in the Supabase SQL editor after schema.sql. Safe to re-run.
-- Author: Ishita Tibrewal

create table if not exists public.profile_associations (
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  association_code text not null references public.associations(code),
  created_at timestamptz default now(),
  primary key (user_id, association_code)
);

-- Carry over everyone's existing single association.
insert into public.profile_associations(user_id, association_code)
select user_id, association_code from public.profiles where association_code is not null
on conflict do nothing;

-- All associations the signed-in, approved user can see.
create or replace function public.my_associations() returns setof text
language sql stable security definer set search_path = public as $$
  select pa.association_code
  from profile_associations pa join profiles p on p.user_id = pa.user_id
  where pa.user_id = auth.uid() and p.status = 'approved';
$$;

-- Sign-up with one or more associations.
create or replace function public.redeem_invite_multi(p_token text, p_associations text[], p_full_name text)
returns text language plpgsql security definer set search_path = public as $$
declare inv invites; v_email text; a text;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if p_associations is null or array_length(p_associations, 1) is null then raise exception 'Choose at least one association'; end if;
  select * into inv from invites where token = p_token for update;
  if inv.id is null or inv.revoked or inv.expires_at < now() or inv.uses >= inv.max_uses then
    raise exception 'Invite link is invalid or expired';
  end if;
  foreach a in array p_associations loop
    if inv.association_code is not null and inv.association_code <> a then
      raise exception 'This invite is only for %', inv.association_code;
    end if;
    if not exists (select 1 from associations where code = a) then raise exception 'Unknown association %', a; end if;
  end loop;
  select email into v_email from auth.users where id = auth.uid();
  insert into profiles(user_id, email, full_name, association_code, invite_id)
  values (auth.uid(), v_email, p_full_name, p_associations[1], inv.id)
  on conflict (user_id) do nothing;
  insert into profile_associations(user_id, association_code)
  select auth.uid(), unnest(p_associations) on conflict do nothing;
  update invites set uses = uses + 1 where id = inv.id;
  return 'pending';
end $$;

-- Keep the old single-association function working (older links / cached pages).
create or replace function public.redeem_invite(p_token text, p_association text, p_full_name text)
returns text language sql security definer set search_path = public as $$
  select public.redeem_invite_multi(p_token, array[p_association], p_full_name);
$$;

-- Row-level security now checks the list instead of one association.
alter table public.profile_associations enable row level security;
drop policy if exists pa_read on public.profile_associations;
create policy pa_read on public.profile_associations for select using (user_id = auth.uid() or is_admin());
drop policy if exists pa_admin on public.profile_associations;
create policy pa_admin on public.profile_associations for all using (is_admin()) with check (is_admin());

drop policy if exists snap_read on public.association_snapshots;
create policy snap_read on public.association_snapshots for select
  using (is_admin() or association_code in (select my_associations()));

drop policy if exists lapsed_read on public.lapsed_members;
create policy lapsed_read on public.lapsed_members for select
  using (is_admin() or association_code in (select my_associations()));
