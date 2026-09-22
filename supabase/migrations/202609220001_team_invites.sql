create table if not exists public.organization_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  code text not null unique check (char_length(code) = 8),
  role text not null default 'operator' check (role in ('admin', 'operator', 'viewer')),
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.organization_invites enable row level security;

drop policy if exists invites_owner_access on public.organization_invites;
create policy invites_owner_access on public.organization_invites
for all to authenticated
using (
  exists (
    select 1 from public.organization_members member
    where member.organization_id = organization_invites.organization_id
      and member.user_id = (select auth.uid())
      and member.role in ('owner', 'admin')
  )
)
with check (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.organization_members member
    where member.organization_id = organization_invites.organization_id
      and member.user_id = (select auth.uid())
      and member.role in ('owner', 'admin')
  )
);

revoke all on table public.organization_invites from anon;
grant select, insert, update, delete on public.organization_invites to authenticated;

create or replace function public.accept_organization_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_organization uuid;
  target_role text;
  current_user_id uuid;
begin
  current_user_id := auth.uid();
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  select invite.organization_id, invite.role
    into target_organization, target_role
  from public.organization_invites invite
  where upper(invite.code) = upper(trim(p_code))
    and invite.expires_at > now()
  limit 1;

  if target_organization is null then
    raise exception 'Invalid or expired invite';
  end if;

  insert into public.organization_members (organization_id, user_id, role)
  values (target_organization, current_user_id, target_role)
  on conflict (organization_id, user_id) do update set role = excluded.role;

  return target_organization;
end;
$$;

revoke all on function public.accept_organization_invite(text) from public;
revoke all on function public.accept_organization_invite(text) from anon;
grant execute on function public.accept_organization_invite(text) to authenticated;
