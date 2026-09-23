-- 1. Segurar a tabela organization_members
alter table public.organization_members enable row level security;

-- Política: Usuário só lê membros da própria organização (ou se for SUPER_ADMIN/ADMIN_CD)
create policy organization_members_select on public.organization_members for select to authenticated
using (
  auth.uid() = user_id
  or exists (
    select 1 from public.profiles p 
    where p.id = auth.uid() 
    and (p.role in ('SUPER_ADMIN', 'ADMIN_CD') or p.organization_id = organization_members.organization_id)
  )
);

-- Política: Gerente Geral da filial pode inserir/editar membros da sua filial
create policy organization_members_manage on public.organization_members for all to authenticated
using (
  exists (
    select 1 from public.profiles p 
    where p.id = auth.uid() 
    and (
      p.role = 'SUPER_ADMIN' 
      or (p.role = 'GERENTE_GERAL' and p.organization_id = organization_members.organization_id)
    )
  )
);
