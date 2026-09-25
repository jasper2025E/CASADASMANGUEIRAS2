create table if not exists public.convites_filial (
  id uuid primary key default gen_random_uuid(),
  filial_id uuid not null references public.organizations(id),
  codigo text not null unique check (char_length(codigo)=8),
  cargo public.cdm_cargo not null,
  direitos text[] not null default '{}',
  expires_at timestamptz not null default (now()+interval '30 days'),
  criado_por uuid not null default auth.uid() references auth.users(id),
  usado_por uuid references auth.users(id),
  usado_em timestamptz,
  created_at timestamptz not null default now()
);
alter table public.convites_filial enable row level security;
grant select on public.convites_filial to authenticated;

drop policy if exists convites_select on public.convites_filial;
create policy convites_select on public.convites_filial for select to authenticated
using ((filial_id=(select public.minha_filial()) and (select public.cdm_pode('equipe.gerir'))) or (select public.is_global()));

create or replace function public.criar_convite_filial(p_cargo public.cdm_cargo, p_direitos text[] default '{}')
returns text language plpgsql security definer set search_path='' as $$
declare f uuid:=public.minha_filial(); codigo text;
begin
  if auth.uid() is null or not (public.cdm_pode('equipe.gerir') or public.is_global()) then raise exception 'Sem permissão para criar acesso'; end if;
  if p_cargo in ('ADMIN_CD','SUPER_ADMIN') and public.meu_cargo()<>'SUPER_ADMIN' then raise exception 'Cargo global só pode ser atribuído pelo SUPER_ADMIN'; end if;
  if p_cargo='GERENTE_GERAL' and public.meu_cargo()<>'SUPER_ADMIN' then raise exception 'Somente SUPER_ADMIN pode criar outro gerente geral'; end if;
  codigo:=upper(substr(encode(gen_random_bytes(8),'hex'),1,8));
  insert into public.convites_filial(filial_id,codigo,cargo,direitos) values(f,codigo,p_cargo,coalesce(p_direitos,'{}'));
  return codigo;
end $$;

create or replace function public.aceitar_convite_filial(p_codigo text)
returns uuid language plpgsql security definer set search_path='' as $$
declare c public.convites_filial;
begin
  if auth.uid() is null then raise exception 'Faça login antes de aceitar o convite'; end if;
  if exists(select 1 from public.usuarios_filial where user_id=auth.uid()) then raise exception 'Este usuário já pertence a uma filial'; end if;
  select * into c from public.convites_filial where codigo=upper(trim(p_codigo)) and usado_em is null and expires_at>now() for update;
  if not found then raise exception 'Convite inválido ou expirado'; end if;
  if c.cargo in ('ADMIN_CD','SUPER_ADMIN') then raise exception 'Convite global inválido'; end if;
  insert into public.usuarios_filial(user_id,filial_id,cargo,direitos) values(auth.uid(),c.filial_id,c.cargo,c.direitos);
  update public.convites_filial set usado_por=auth.uid(),usado_em=now() where id=c.id;
  return c.filial_id;
end $$;

create or replace function public.atualizar_usuario_filial(p_user_id uuid,p_cargo public.cdm_cargo,p_direitos text[],p_ativo boolean)
returns void language plpgsql security definer set search_path='' as $$
declare alvo public.usuarios_filial; f uuid:=public.minha_filial();
begin
  if auth.uid() is null or not (public.cdm_pode('equipe.gerir') or public.meu_cargo()='SUPER_ADMIN') then raise exception 'Sem permissão para gerenciar equipe'; end if;
  select * into alvo from public.usuarios_filial where user_id=p_user_id for update;
  if not found or (public.meu_cargo()<>'SUPER_ADMIN' and alvo.filial_id<>f) then raise exception 'Usuário de outra filial'; end if;
  if p_user_id=auth.uid() then raise exception 'Você não pode alterar seu próprio acesso'; end if;
  if (alvo.cargo in ('GERENTE_GERAL','ADMIN_CD','SUPER_ADMIN') or p_cargo in ('GERENTE_GERAL','ADMIN_CD','SUPER_ADMIN')) and public.meu_cargo()<>'SUPER_ADMIN' then raise exception 'Cargo protegido'; end if;
  update public.usuarios_filial set cargo=p_cargo,direitos=coalesce(p_direitos,'{}'),ativo=p_ativo,updated_at=now() where user_id=p_user_id;
end $$;

revoke all on function public.criar_convite_filial(public.cdm_cargo,text[]) from public,anon;
revoke all on function public.aceitar_convite_filial(text) from public,anon;
revoke all on function public.atualizar_usuario_filial(uuid,public.cdm_cargo,text[],boolean) from public,anon;
grant execute on function public.criar_convite_filial(public.cdm_cargo,text[]),public.aceitar_convite_filial(text),public.atualizar_usuario_filial(uuid,public.cdm_cargo,text[],boolean) to authenticated;
revoke insert,update,delete on public.convites_filial from authenticated,anon;
notify pgrst,'reload schema';
