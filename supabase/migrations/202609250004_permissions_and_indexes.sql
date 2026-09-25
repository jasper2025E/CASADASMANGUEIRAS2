-- Permissões individuais complementam o cargo, sem permitir escalar para poderes globais.
create or replace function public.cdm_pode(acao text)
returns boolean language sql stable security definer set search_path='' as $$
  with me as (
    select u.cargo,coalesce(u.direitos,'{}'::text[]) direitos
    from public.usuarios_filial u where u.user_id=auth.uid() and u.ativo limit 1
  ), resolved as (
    select *,case acao
      when 'dashboard.view' then 'dashboard.view' when 'orders.view' then 'orders.view'
      when 'pedido.criar' then 'orders.create' when 'pedido.receber' then 'orders.manage'
      when 'pedido.cd' then 'orders.manage' when 'expedicao' then 'orders.manage'
      when 'equipe.gerir' then 'users.manage' when 'equipe.excluir' then 'users.manage'
      when 'relatorios' then 'reports.view' when 'financeiro' then 'reports.view'
      when 'estoque.ver' then 'inventory.view' when 'estoque.gerir' then 'inventory.manage'
      when 'auditoria' then 'reports.view' when 'produto.cadastrar' then 'products.create'
      when 'compra.fornecedor' then 'orders.manage' else null end permission_key
    from me
  )
  select auth.uid() is not null and coalesce(case
    when cargo='SUPER_ADMIN' then true
    when acao in ('pedido.cd','compra.fornecedor','produto.cadastrar') then cargo='ADMIN_CD'
    when acao='expedicao' then cargo in ('ADMIN_CD','SEPARADOR') and (cardinality(direitos)=0 or permission_key=any(direitos))
    when acao='equipe.excluir' then cargo='GERENTE_GERAL' and (cardinality(direitos)=0 or permission_key=any(direitos))
    when cardinality(direitos)>0 and permission_key is not null then permission_key=any(direitos)
    else case acao
      when 'dashboard.view' then true
      when 'orders.view' then cargo in ('GERENTE_GERAL','SUBGERENTE','AUXILIAR_GERENTE','GERENTE_ESTOQUE','GERENTE_REPOSICAO','FUNCIONARIO_COMPRAS','RECEBEDOR_CONFERENTE','SEPARADOR','ADMIN_CD')
      when 'pedido.criar' then cargo in ('GERENTE_GERAL','SUBGERENTE','AUXILIAR_GERENTE','GERENTE_ESTOQUE','GERENTE_REPOSICAO','FUNCIONARIO_COMPRAS')
      when 'pedido.receber' then cargo in ('RECEBEDOR_CONFERENTE','GERENTE_GERAL','SUBGERENTE','AUXILIAR_GERENTE')
      when 'equipe.gerir' then cargo in ('GERENTE_GERAL','SUBGERENTE','AUXILIAR_GERENTE')
      when 'relatorios' then cargo in ('GERENTE_GERAL','SUBGERENTE','AUXILIAR_GERENTE','ADMIN_CD')
      when 'financeiro' then cargo='GERENTE_GERAL'
      when 'pdv' then cargo in ('CAIXA','VENDEDOR','GERENTE_GERAL','SUBGERENTE')
      when 'estoque.ver' then true
      when 'estoque.gerir' then cargo in ('GERENTE_GERAL','SUBGERENTE','GERENTE_ESTOQUE','ADMIN_CD')
      when 'auditoria' then cargo in ('FISCAL_LOJA','GERENTE_GERAL')
      else false end
  end,false) from resolved
$$;

-- Índices dos caminhos quentes de RLS e movimentação.
create index if not exists usuarios_filial_filial_idx on public.usuarios_filial(filial_id);
create index if not exists estoque_product_idx on public.estoque(product_id);
create index if not exists pedidos_transferencia_filial_idx on public.pedidos_transferencia(filial_id,created_at desc);
create index if not exists pedidos_transferencia_itens_pedido_idx on public.pedidos_transferencia_itens(pedido_id);
create index if not exists pedidos_transferencia_itens_product_idx on public.pedidos_transferencia_itens(product_id);
create index if not exists romaneios_pedido_idx on public.romaneios(pedido_id);
create index if not exists romaneios_filial_idx on public.romaneios(filial_id);
create index if not exists ocorrencias_pedido_idx on public.ocorrencias(pedido_id);
create index if not exists ocorrencias_filial_idx on public.ocorrencias(filial_id);
create index if not exists notificacoes_filial_idx on public.notificacoes(filial_id,created_at desc);
create index if not exists movimentos_product_idx on public.movimentos_estoque(product_id);
create index if not exists movimentos_pedido_idx on public.movimentos_estoque(pedido_id);
create index if not exists eventos_pedido_idx on public.eventos_pedido_transferencia(pedido_id);
create index if not exists convites_filial_idx on public.convites_filial(filial_id,expires_at);
create index if not exists clientes_filial_idx on public.clientes(filial_id);
create index if not exists vendas_filial_idx on public.vendas(filial_id,created_at desc);
create index if not exists caixa_filial_idx on public.caixa(filial_id,created_at desc);

drop policy if exists uf_select on public.usuarios_filial;
create policy uf_select on public.usuarios_filial for select to authenticated
using ((user_id=(select auth.uid())) or (select public.is_global()) or (filial_id=(select public.minha_filial()) and (select public.cdm_pode('equipe.gerir'))));

drop policy if exists ufa_own on public.usuario_filial_ativa;
create policy ufa_own on public.usuario_filial_ativa for all to authenticated
using (user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

notify pgrst,'reload schema';
