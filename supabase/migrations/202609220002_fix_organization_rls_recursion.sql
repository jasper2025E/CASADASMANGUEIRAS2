create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.current_user_is_organization_member(target_organization uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.organization_members member
      where member.organization_id = target_organization
        and member.user_id = auth.uid()
    );
$$;

revoke all on function private.current_user_is_organization_member(uuid) from public, anon;
grant execute on function private.current_user_is_organization_member(uuid) to authenticated;

drop policy if exists organizations_select on public.organizations;
create policy organizations_select on public.organizations
for select to authenticated
using (
  created_by = (select auth.uid())
  or private.current_user_is_organization_member(id)
);
