-- Aplicação rigorosa de RLS para isolamento total de dados por filial_id
-- O CD e SUPER_ADMIN têm acesso total. Filiais têm acesso restrito ao próprio filial_id.

DO $$
DECLARE
    table_name text;
    tables text[] := ARRAY['estoque', 'vendas', 'pdv', 'caixa', 'clientes', 'pedidos_transferencia', 'pedidos_compra_fornecedor', 'romaneios'];
BEGIN
    FOREACH table_name IN ARRAY tables
    LOOP
        -- Habilitar RLS
        EXECUTE format('alter table public.%I enable row level security', table_name);

        -- Política para todas as operações
        EXECUTE format('
            create policy %I_isolation on public.%I
            for all to authenticated
            using (
                exists (
                    select 1 from public.profiles p
                    where p.id = auth.uid()
                    and (
                        p.role in (''SUPER_ADMIN'', ''ADMIN_CD'')
                        or p.organization_id = %I.filial_id
                    )
                )
            )
            with check (
                exists (
                    select 1 from public.profiles p
                    where p.id = auth.uid()
                    and (
                        p.role in (''SUPER_ADMIN'', ''ADMIN_CD'')
                        or p.organization_id = %I.filial_id
                    )
                )
            )', table_name, table_name, table_name, table_name);
    END LOOP;
END $$;
