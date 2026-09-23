-- Criar índices para performance das políticas RLS
-- Isto é essencial para que o banco de dados não faça busca sequencial (slow) em todas as tabelas.

CREATE INDEX IF NOT EXISTS idx_estoque_filial ON public.estoque(filial_id);
CREATE INDEX IF NOT EXISTS idx_vendas_filial ON public.vendas(filial_id);
CREATE INDEX IF NOT EXISTS idx_pdv_filial ON public.pdv(filial_id);
CREATE INDEX IF NOT EXISTS idx_caixa_filial ON public.caixa(filial_id);
CREATE INDEX IF NOT EXISTS idx_clientes_filial ON public.clientes(filial_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_transf_filial ON public.pedidos_transferencia(filial_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_compra_filial ON public.pedidos_compra_fornecedor(filial_id);
CREATE INDEX IF NOT EXISTS idx_romaneios_filial ON public.romaneios(filial_id);

-- Otimização extra: Índice em perfis para busca rápida de cargo/filial na RLS
CREATE INDEX IF NOT EXISTS idx_profiles_org_id ON public.profiles(organization_id);
