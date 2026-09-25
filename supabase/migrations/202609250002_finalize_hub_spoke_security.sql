-- CDM: finalização do modelo hub-and-spoke, RBAC e operações transacionais.
-- auth.users permanece intocada; autorização vive em usuarios_filial.

alter table public.usuarios_filial
  add column if not exists updated_at timestamptz not null default now();

-- Um usuário pertence a exatamente uma filial. Cargos globais ficam vinculados ao CD.
create unique index if not exists usuarios_filial_um_vinculo_por_usuario
  on public.usuarios_filial(user_id);

alter table public.products
  add column if not exists catalogo_global boolean not null default false;

update public.products p
set catalogo_global = true
where p.organization_id = (
  select o.id from public.organizations o
  where o.organization_type = 'distribution_center'
  order by o.created_at limit 1
);

create index if not exists products_catalogo_global_idx
  on public.products(catalogo_global, description);

create table if not exists public.pdv (
  id uuid primary key default gen_random_uuid(),
  filial_id uuid not null references public.organizations(id),
  caixa_id uuid references public.caixa(id),
  operador_id uuid not null default auth.uid() references auth.users(id),
  status text not null default 'ABERTO' check (status in ('ABERTO','FECHADO')),
  aberto_em timestamptz not null default now(),
  fechado_em timestamptz
);

create table if not exists public.movimentos_estoque (
  id uuid primary key default gen_random_uuid(),
  filial_id uuid not null references public.organizations(id),
  product_id uuid not null references public.products(id),
  pedido_id uuid references public.pedidos_transferencia(id),
  tipo text not null check (tipo in ('SAIDA_TRANSFERENCIA','ENTRADA_TRANSFERENCIA','AJUSTE','VENDA')),
  quantidade numeric not null check (quantidade > 0),
  criado_por uuid default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.eventos_pedido_transferencia (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos_transferencia(id) on delete cascade,
  filial_id uuid not null references public.organizations(id),
  status text not null,
  mensagem text not null default '',
  criado_por uuid default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists pdv_filial_idx on public.pdv(filial_id);
create index if not exists movimentos_estoque_filial_idx on public.movimentos_estoque(filial_id, created_at desc);
create index if not exists eventos_transferencia_filial_idx on public.eventos_pedido_transferencia(filial_id, created_at desc);
create index if not exists pedidos_transferencia_status_idx on public.pedidos_transferencia(status, created_at desc);

alter table public.pdv enable row level security;
alter table public.movimentos_estoque enable row level security;
alter table public.eventos_pedido_transferencia enable row level security;

-- Helpers usados em políticas. Sempre exigem sessão autenticada.
create or replace function public.minha_filial()
returns uuid language sql stable security definer set search_path = '' as $$
  select case when auth.uid() is null then null::uuid else (
    select u.filial_id from public.usuarios_filial u
    where u.user_id = auth.uid() and u.ativo
    limit 1
  ) end
$$;

create or replace function public.meu_cargo()
returns public.cdm_cargo language sql stable security definer set search_path = '' as $$
  select case when auth.uid() is null then null::public.cdm_cargo else (
    select u.cargo from public.usuarios_filial u
    where u.user_id = auth.uid() and u.ativo
    limit 1
  ) end
$$;

create or replace function public.is_global()
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and coalesce(public.meu_cargo() in ('ADMIN_CD','SUPER_ADMIN'), false)
$$;

create or replace function public.cdm_pode(acao text)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and case
    when c is null then false
    when c = 'SUPER_ADMIN' then true
    else case acao
      when 'dashboard.view' then true
      when 'orders.view' then c in ('GERENTE_GERAL','SUBGERENTE','AUXILIAR_GERENTE','GERENTE_ESTOQUE','GERENTE_REPOSICAO','FUNCIONARIO_COMPRAS','RECEBEDOR_CONFERENTE','SEPARADOR','ADMIN_CD')
      when 'pedido.criar' then c in ('GERENTE_GERAL','SUBGERENTE','AUXILIAR_GERENTE','GERENTE_ESTOQUE','GERENTE_REPOSICAO','FUNCIONARIO_COMPRAS')
      when 'pedido.receber' then c in ('RECEBEDOR_CONFERENTE','GERENTE_GERAL','SUBGERENTE','AUXILIAR_GERENTE')
      when 'pedido.cd' then c = 'ADMIN_CD'
      when 'expedicao' then c in ('ADMIN_CD','SEPARADOR')
      when 'equipe.gerir' then c in ('GERENTE_GERAL','SUBGERENTE','AUXILIAR_GERENTE')
      when 'equipe.excluir' then c = 'GERENTE_GERAL'
      when 'relatorios' then c in ('GERENTE_GERAL','SUBGERENTE','AUXILIAR_GERENTE','ADMIN_CD')
      when 'financeiro' then c = 'GERENTE_GERAL'
      when 'pdv' then c in ('CAIXA','VENDEDOR','GERENTE_GERAL','SUBGERENTE')
      when 'estoque.ver' then true
      when 'estoque.gerir' then c in ('GERENTE_GERAL','SUBGERENTE','GERENTE_ESTOQUE','ADMIN_CD')
      when 'auditoria' then c in ('FISCAL_LOJA','GERENTE_GERAL')
      when 'produto.cadastrar' then c = 'ADMIN_CD'
      when 'compra.fornecedor' then c = 'ADMIN_CD'
      else false
    end
  end
  from (select public.meu_cargo() c) x
$$;

create or replace function public.get_my_access_context()
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when auth.uid() is null then null else jsonb_build_object(
    'user_id', u.user_id,
    'filial_id', u.filial_id,
    'filial_nome', o.name,
    'filial_tipo', o.organization_type,
    'cargo', u.cargo,
    'ativo', u.ativo,
    'permissions', to_jsonb(coalesce(u.direitos, '{}'::text[]))
  ) end
  from public.usuarios_filial u
  join public.organizations o on o.id = u.filial_id
  where u.user_id = auth.uid() and u.ativo
  limit 1
$$;

create or replace function public.criar_pedido_transferencia(p_itens jsonb, p_observacao text default '')
returns uuid language plpgsql security definer set search_path = '' as $$
declare pid uuid; f uuid := public.minha_filial(); i jsonb; produto uuid; qtd numeric;
begin
  if auth.uid() is null or not public.cdm_pode('pedido.criar') or f is null then
    raise exception 'Sem permissão para criar pedido';
  end if;
  if exists (select 1 from public.organizations where id=f and organization_type='distribution_center') then
    raise exception 'O CD não cria pedido de transferência para si mesmo';
  end if;
  if jsonb_typeof(coalesce(p_itens, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_itens,'[]'::jsonb)) = 0 then
    raise exception 'Adicione pelo menos um item';
  end if;
  insert into public.pedidos_transferencia(filial_id, motivo)
  values (f, left(coalesce(p_observacao,''), 1000)) returning id into pid;
  for i in select * from jsonb_array_elements(p_itens) loop
    produto := (i->>'product_id')::uuid;
    qtd := (i->>'qtd')::numeric;
    if qtd <= 0 or not exists (select 1 from public.products where id=produto and catalogo_global) then
      raise exception 'Produto ou quantidade inválida';
    end if;
    insert into public.pedidos_transferencia_itens(pedido_id,filial_id,product_id,qtd_solicitada)
    values (pid,f,produto,qtd);
  end loop;
  insert into public.eventos_pedido_transferencia(pedido_id,filial_id,status,mensagem)
  values (pid,f,'PENDENTE','Pedido enviado ao Centro de Distribuição');
  insert into public.notificacoes(filial_id,mensagem)
  values (public.cd_id(), 'Novo pedido interno #'||(select numero from public.pedidos_transferencia where id=pid));
  return pid;
end $$;

create or replace function public.decidir_pedido(p_id uuid, p_acao text, p_itens jsonb default '[]', p_motivo text default '')
returns void language plpgsql security definer set search_path = '' as $$
declare p public.pedidos_transferencia; it record; q numeric; cd uuid := public.cd_id(); saldo numeric;
begin
  if auth.uid() is null or not public.cdm_pode('pedido.cd') then raise exception 'Apenas ADMIN_CD ou SUPER_ADMIN'; end if;
  if p_acao not in ('APROVAR_TOTAL','PARCIAL','NEGAR') then raise exception 'Ação inválida'; end if;
  select * into p from public.pedidos_transferencia where id=p_id for update;
  if not found or p.status <> 'PENDENTE' then raise exception 'Pedido não está pendente'; end if;
  if p_acao='NEGAR' then
    if length(trim(p_motivo)) < 3 then raise exception 'Informe o motivo da negativa'; end if;
    update public.pedidos_transferencia set status='NEGADO',motivo=left(p_motivo,1000),decidido_por=auth.uid(),updated_at=now() where id=p_id;
    insert into public.eventos_pedido_transferencia(pedido_id,filial_id,status,mensagem) values(p_id,p.filial_id,'NEGADO',left(p_motivo,1000));
    insert into public.notificacoes(filial_id,mensagem) values (p.filial_id,'Pedido #'||p.numero||' negado: '||left(p_motivo,300));
    return;
  end if;
  for it in select * from public.pedidos_transferencia_itens where pedido_id=p_id order by id for update loop
    q := case when p_acao='PARCIAL' then coalesce((select (e->>'qtd')::numeric from jsonb_array_elements(p_itens) e where (e->>'id')::uuid=it.id),0) else it.qtd_solicitada end;
    if q < 0 or q > it.qtd_solicitada then raise exception 'Quantidade aprovada inválida'; end if;
    select quantidade into saldo from public.estoque where filial_id=cd and product_id=it.product_id for update;
    if coalesce(saldo,0) < q then raise exception 'Estoque insuficiente no CD para o produto %', it.product_id; end if;
    update public.estoque set quantidade=quantidade-q,updated_at=now() where filial_id=cd and product_id=it.product_id;
    update public.pedidos_transferencia_itens set qtd_aprovada=q where id=it.id;
    if q > 0 then
      insert into public.movimentos_estoque(filial_id,product_id,pedido_id,tipo,quantidade) values(cd,it.product_id,p_id,'SAIDA_TRANSFERENCIA',q);
    end if;
  end loop;
  if not exists (select 1 from public.pedidos_transferencia_itens where pedido_id=p_id and qtd_aprovada > 0) then
    raise exception 'A aprovação precisa conter ao menos um item';
  end if;
  update public.pedidos_transferencia set status='EM_SEPARACAO',motivo=left(coalesce(p_motivo,''),1000),decidido_por=auth.uid(),updated_at=now() where id=p_id;
  insert into public.eventos_pedido_transferencia(pedido_id,filial_id,status,mensagem) values(p_id,p.filial_id,'EM_SEPARACAO',case when p_acao='PARCIAL' then 'Aprovação parcial' else 'Aprovação total' end);
  insert into public.notificacoes(filial_id,mensagem) values (p.filial_id,'Pedido #'||p.numero||' aprovado e em separação');
end $$;

create or replace function public.gerar_romaneio(p_id uuid, p_motorista text, p_placa text, p_saida timestamptz default now())
returns void language plpgsql security definer set search_path = '' as $$
declare p public.pedidos_transferencia;
begin
  if auth.uid() is null or not public.cdm_pode('expedicao') then raise exception 'Sem permissão de expedição'; end if;
  if length(trim(p_motorista)) < 3 or length(regexp_replace(upper(p_placa),'[^A-Z0-9]','','g')) not between 7 and 8 then raise exception 'Motorista ou placa inválidos'; end if;
  select * into p from public.pedidos_transferencia where id=p_id for update;
  if not found or p.status <> 'EM_SEPARACAO' then raise exception 'Pedido não está em separação'; end if;
  insert into public.romaneios(filial_id,pedido_id,motorista,placa,data_saida)
  values(p.filial_id,p_id,trim(p_motorista),upper(trim(p_placa)),coalesce(p_saida,now()));
  update public.pedidos_transferencia set status='EM_TRANSITO',updated_at=now() where id=p_id;
  insert into public.eventos_pedido_transferencia(pedido_id,filial_id,status,mensagem) values(p_id,p.filial_id,'EM_TRANSITO','Romaneio emitido para '||trim(p_motorista));
  insert into public.notificacoes(filial_id,mensagem) values(p.filial_id,'Pedido #'||p.numero||' saiu do CD e está em trânsito');
end $$;

create or replace function public.confirmar_recebimento(p_id uuid, p_itens jsonb default '[]', p_obs text default '')
returns void language plpgsql security definer set search_path = '' as $$
declare p public.pedidos_transferencia; it record; q numeric; divergencia text := '';
begin
  if auth.uid() is null or not public.cdm_pode('pedido.receber') then raise exception 'Sem permissão para confirmar recebimento'; end if;
  select * into p from public.pedidos_transferencia where id=p_id for update;
  if not found or (p.filial_id <> public.minha_filial() and public.meu_cargo() <> 'SUPER_ADMIN') then raise exception 'Pedido de outra filial'; end if;
  if p.status <> 'EM_TRANSITO' then raise exception 'Pedido não está em trânsito'; end if;
  for it in select i.*, pr.description from public.pedidos_transferencia_itens i join public.products pr on pr.id=i.product_id where pedido_id=p_id order by i.id for update loop
    q := coalesce((select (e->>'qtd')::numeric from jsonb_array_elements(coalesce(p_itens,'[]'::jsonb)) e where (e->>'id')::uuid=it.id), it.qtd_aprovada, 0);
    if q < 0 or q > coalesce(it.qtd_aprovada,0) then raise exception 'Quantidade recebida inválida'; end if;
    update public.pedidos_transferencia_itens set qtd_recebida=q where id=it.id;
    if q > 0 then
      insert into public.estoque(filial_id,product_id,quantidade) values(p.filial_id,it.product_id,q)
      on conflict (filial_id,product_id) do update set quantidade=public.estoque.quantidade+excluded.quantidade,updated_at=now();
      insert into public.movimentos_estoque(filial_id,product_id,pedido_id,tipo,quantidade) values(p.filial_id,it.product_id,p_id,'ENTRADA_TRANSFERENCIA',q);
    end if;
    if q <> coalesce(it.qtd_aprovada,0) then divergencia := divergencia||it.description||': esperado '||coalesce(it.qtd_aprovada,0)||', recebido '||q||'; '; end if;
  end loop;
  update public.pedidos_transferencia set status='FINALIZADO',recebido_por=auth.uid(),updated_at=now() where id=p_id;
  insert into public.eventos_pedido_transferencia(pedido_id,filial_id,status,mensagem) values(p_id,p.filial_id,'FINALIZADO','Recebimento confirmado');
  if divergencia <> '' or length(trim(coalesce(p_obs,''))) > 0 then
    insert into public.ocorrencias(filial_id,pedido_id,descricao) values(p.filial_id,p_id,left(trim(divergencia||' '||coalesce(p_obs,'')),3000));
    insert into public.notificacoes(filial_id,mensagem) values(public.cd_id(),'Ocorrência no recebimento do pedido #'||p.numero);
  end if;
end $$;

create or replace function public.cancelar_pedido_transferencia(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare p public.pedidos_transferencia;
begin
  if auth.uid() is null then raise exception 'Sessão inválida'; end if;
  select * into p from public.pedidos_transferencia where id=p_id for update;
  if not found or p.filial_id <> public.minha_filial() or p.criado_por <> auth.uid() or p.status <> 'PENDENTE' then raise exception 'Este pedido não pode ser cancelado'; end if;
  update public.pedidos_transferencia set status='CANCELADO',updated_at=now() where id=p_id;
  insert into public.eventos_pedido_transferencia(pedido_id,filial_id,status,mensagem) values(p_id,p.filial_id,'CANCELADO','Cancelado pela filial');
end $$;

drop function if exists public.listar_equipe();
create function public.listar_equipe()
returns table(user_id uuid,email text,full_name text,cargo public.cdm_cargo,direitos text[],ativo boolean,created_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare f uuid := public.minha_filial();
begin
  if auth.uid() is null or not (public.cdm_pode('equipe.gerir') or public.is_global()) then raise exception 'Sem permissão para listar a equipe'; end if;
  return query select u.user_id,coalesce(p.email,''),coalesce(p.full_name,''),u.cargo,coalesce(u.direitos,'{}'),u.ativo,u.created_at
  from public.usuarios_filial u left join public.user_profiles p on p.id=u.user_id
  where public.is_global() or u.filial_id=f order by u.created_at;
end $$;

-- Revoga execução implícita, depois libera somente os endpoints necessários para usuários autenticados.
revoke all on function public.minha_filial() from public, anon;
revoke all on function public.meu_cargo() from public, anon;
revoke all on function public.is_global() from public, anon;
revoke all on function public.cdm_pode(text) from public, anon;
revoke all on function public.get_my_access_context() from public, anon;
revoke all on function public.criar_pedido_transferencia(jsonb,text) from public, anon;
revoke all on function public.decidir_pedido(uuid,text,jsonb,text) from public, anon;
revoke all on function public.gerar_romaneio(uuid,text,text,timestamptz) from public, anon;
revoke all on function public.confirmar_recebimento(uuid,jsonb,text) from public, anon;
revoke all on function public.cancelar_pedido_transferencia(uuid) from public, anon;
revoke all on function public.listar_equipe() from public, anon;
grant execute on function public.minha_filial(),public.meu_cargo(),public.is_global(),public.cdm_pode(text),public.get_my_access_context(),public.criar_pedido_transferencia(jsonb,text),public.decidir_pedido(uuid,text,jsonb,text),public.gerar_romaneio(uuid,text,text,timestamptz),public.confirmar_recebimento(uuid,jsonb,text),public.cancelar_pedido_transferencia(uuid),public.listar_equipe() to authenticated;

grant select on public.products,public.fornecedores,public.categorias to authenticated;
grant select on public.usuarios_filial,public.estoque,public.pedidos_transferencia,public.pedidos_transferencia_itens,public.romaneios,public.ocorrencias,public.notificacoes,public.movimentos_estoque,public.eventos_pedido_transferencia to authenticated;
grant select,insert,update on public.pdv,public.vendas,public.caixa,public.clientes to authenticated;
grant insert,update,delete on public.products to authenticated;

drop policy if exists pdv_isolation on public.pdv;
create policy pdv_isolation on public.pdv for all to authenticated
using ((filial_id=(select public.minha_filial())) or (select public.is_global()))
with check (((filial_id=(select public.minha_filial())) and (select public.cdm_pode('pdv'))) or (select public.is_global()));

drop policy if exists movimentos_select on public.movimentos_estoque;
create policy movimentos_select on public.movimentos_estoque for select to authenticated
using ((filial_id=(select public.minha_filial())) or (select public.is_global()));

drop policy if exists eventos_select on public.eventos_pedido_transferencia;
create policy eventos_select on public.eventos_pedido_transferencia for select to authenticated
using ((filial_id=(select public.minha_filial())) or (select public.is_global()));

-- Escritas de movimentação e eventos só acontecem pelas funções transacionais.
revoke insert,update,delete on public.movimentos_estoque,public.eventos_pedido_transferencia,public.pedidos_transferencia,public.pedidos_transferencia_itens,public.romaneios from authenticated, anon;

-- Estoque inicial: transforma o saldo legado em saldo por filial, apontando para o produto mestre do CD.
insert into public.estoque(filial_id,product_id,quantidade)
select p.organization_id,coalesce(cd.id,p.id),greatest(coalesce(p.stock,0),0)
from public.products p
left join public.products cd on cd.product_key=p.product_key and cd.catalogo_global
where exists(select 1 from public.organizations o where o.id=p.organization_id)
on conflict(filial_id,product_id) do update set quantidade=greatest(public.estoque.quantidade,excluded.quantidade),updated_at=now();

notify pgrst, 'reload schema';
