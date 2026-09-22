drop policy if exists orders_select on public.purchase_orders;
drop policy if exists orders_insert on public.purchase_orders;
drop policy if exists orders_update on public.purchase_orders;
drop policy if exists orders_delete on public.purchase_orders;
drop policy if exists order_items_select on public.purchase_order_items;
drop policy if exists order_items_insert on public.purchase_order_items;
drop policy if exists order_items_update on public.purchase_order_items;
drop policy if exists order_items_delete on public.purchase_order_items;

drop policy if exists purchase_orders_insert on public.purchase_orders;
create policy purchase_orders_insert on public.purchase_orders for insert to authenticated
with check (
  created_by = (select auth.uid())
  and public.has_org_permission(organization_id, 'orders.create')
  and distribution_status in ('draft','submitted')
  and exists (
    select 1 from public.organizations origin
    where origin.id = organization_id
      and destination_organization_id = coalesce(origin.parent_organization_id, origin.id)
  )
);

create index if not exists distribution_order_events_changed_by_idx on public.distribution_order_events(changed_by);
create index if not exists purchase_orders_reviewed_by_idx on public.purchase_orders(reviewed_by);

revoke execute on function public.can_view_distribution_product(uuid) from public, anon;
grant execute on function public.can_view_distribution_product(uuid) to authenticated;
revoke execute on function public.transition_distribution_order(uuid,text,text) from public, anon;
grant execute on function public.transition_distribution_order(uuid,text,text) to authenticated;
revoke execute on function public.log_initial_distribution_order_event() from public, anon, authenticated;
