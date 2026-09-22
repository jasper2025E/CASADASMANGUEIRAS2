update public.organizations
set name = 'Centro de Distribuição', organization_type = 'distribution_center', parent_organization_id = null, code = coalesce(code, 'CD')
where lower(name) like '%centro de distribui%';

with cd as (
  select id from public.organizations where organization_type = 'distribution_center' order by created_at limit 1
)
update public.organizations o
set name = 'Casa das Mangueiras — Barreirinhas', organization_type = 'branch', parent_organization_id = cd.id, code = coalesce(o.code, 'BARREIRINHAS')
from cd
where lower(o.name) like '%barreirinhas%';

drop policy if exists purchase_order_items_select on public.purchase_order_items;
drop policy if exists purchase_order_items_insert on public.purchase_order_items;
drop policy if exists purchase_order_items_update on public.purchase_order_items;
drop policy if exists purchase_order_items_delete on public.purchase_order_items;

create policy purchase_order_items_select on public.purchase_order_items for select to authenticated
using (
  exists (
    select 1 from public.purchase_orders po
    where po.id = order_id
      and (
        public.has_org_permission(po.organization_id, 'orders.view')
        or public.has_org_permission(po.destination_organization_id, 'orders.view')
      )
  )
);

create policy purchase_order_items_insert on public.purchase_order_items for insert to authenticated
with check (
  exists (
    select 1 from public.purchase_orders po
    where po.id = order_id
      and po.distribution_status in ('draft','submitted')
      and public.has_org_permission(po.organization_id, 'orders.create')
  )
);

create policy purchase_order_items_update on public.purchase_order_items for update to authenticated
using (
  exists (
    select 1 from public.purchase_orders po
    where po.id = order_id
      and (
        (po.distribution_status = 'draft' and public.has_org_permission(po.organization_id, 'orders.create'))
        or public.has_org_permission(po.destination_organization_id, 'orders.manage')
      )
  )
)
with check (
  exists (
    select 1 from public.purchase_orders po
    where po.id = order_id
      and (
        (po.distribution_status = 'draft' and public.has_org_permission(po.organization_id, 'orders.create'))
        or public.has_org_permission(po.destination_organization_id, 'orders.manage')
      )
  )
);

create policy purchase_order_items_delete on public.purchase_order_items for delete to authenticated
using (
  exists (
    select 1 from public.purchase_orders po
    where po.id = order_id
      and po.distribution_status = 'draft'
      and public.has_org_permission(po.organization_id, 'orders.create')
  )
);
