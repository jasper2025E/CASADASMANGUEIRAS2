-- 1. Trigger para baixar estoque do CD ao aprovar pedido
create or replace function public.handle_order_approval()
returns trigger as $$
begin
  -- Se o status mudou para 'approved' (ou similar no fluxo)
  if new.status = 'approved' and old.status != 'approved' then
    -- Baixa estoque do CD
    update public.estoque
    set quantidade = quantidade - item.quantity
    from public.purchase_order_items item
    where estoque.product_id = item.product_id
    and estoque.filial_id = 'CD_ID_FIXO' -- Ajustar pelo ID real do CD
    and item.order_id = new.id;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_order_approval
after update on public.purchase_orders
for each row execute function public.handle_order_approval();

-- 2. Trigger para aumentar estoque da Filial ao confirmar recebimento
create or replace function public.handle_order_receipt()
returns trigger as $$
begin
  -- Se status mudou para 'delivered'
  if new.status = 'delivered' and old.status != 'delivered' then
    -- Aumenta estoque da filial destino
    update public.estoque
    set quantidade = quantidade + item.quantity
    from public.purchase_order_items item
    where estoque.product_id = item.product_id
    and estoque.filial_id = new.destination_organization_id
    and item.order_id = new.id;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_order_receipt
after update on public.purchase_orders
for each row execute function public.handle_order_receipt();
