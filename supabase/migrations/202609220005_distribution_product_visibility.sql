create or replace function public.can_view_distribution_product(p_product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.purchase_order_items item
    join public.purchase_orders po on po.id = item.order_id
    where item.product_id = p_product_id
      and public.has_org_permission(po.destination_organization_id, 'orders.view')
  );
$$;

drop policy if exists products_select on public.products;
create policy products_select on public.products for select to authenticated
using (
  public.has_org_permission(organization_id, 'products.view')
  or public.has_org_permission(organization_id, 'dashboard.view')
  or public.can_view_distribution_product(id)
);

grant execute on function public.can_view_distribution_product(uuid) to authenticated;
revoke execute on function public.can_view_distribution_product(uuid) from anon;
