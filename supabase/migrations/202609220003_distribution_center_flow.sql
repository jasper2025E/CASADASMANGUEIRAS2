alter table public.organizations
  add column if not exists organization_type text not null default 'branch',
  add column if not exists parent_organization_id uuid references public.organizations(id) on delete set null,
  add column if not exists code text;

alter table public.organizations drop constraint if exists organizations_type_check;
alter table public.organizations add constraint organizations_type_check
  check (organization_type in ('distribution_center', 'branch'));

update public.organizations
set name = 'Centro de Distribuição', organization_type = 'distribution_center', parent_organization_id = null, code = coalesce(code, 'CD')
where lower(trim(name)) = 'casa das mangueiras';

with cd as (
  select id from public.organizations where organization_type = 'distribution_center' order by created_at limit 1
)
update public.organizations o
set name = 'Casa das Mangueiras — Barreirinhas', organization_type = 'branch', parent_organization_id = cd.id, code = coalesce(o.code, 'BARREIRINHAS')
from cd
where lower(o.name) like '%bareirinhas%' or lower(o.name) like '%barreirinhas%';

create index if not exists organizations_parent_idx on public.organizations(parent_organization_id);

alter table public.products add column if not exists barcode text;
create unique index if not exists products_org_barcode_unique
  on public.products(organization_id, barcode)
  where barcode is not null and barcode <> '';

alter table public.purchase_orders
  add column if not exists destination_organization_id uuid references public.organizations(id) on delete restrict,
  add column if not exists distribution_status text not null default 'draft',
  add column if not exists review_message text not null default '',
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table public.purchase_orders drop constraint if exists purchase_orders_distribution_status_check;
alter table public.purchase_orders add constraint purchase_orders_distribution_status_check
  check (distribution_status in ('draft','submitted','received','approved','rejected','separating','shipped','delivered','cancelled'));

update public.purchase_orders po
set destination_organization_id = coalesce(o.parent_organization_id, po.organization_id),
    distribution_status = case when po.status = 'Finalizado' then 'delivered' else 'draft' end
from public.organizations o
where o.id = po.organization_id and po.destination_organization_id is null;

alter table public.purchase_order_items
  add column if not exists approved_quantity numeric,
  add column if not exists cd_notes text not null default '';
alter table public.purchase_order_items drop constraint if exists purchase_order_items_approved_quantity_check;
alter table public.purchase_order_items add constraint purchase_order_items_approved_quantity_check
  check (approved_quantity is null or approved_quantity >= 0);

create index if not exists purchase_orders_origin_status_idx
  on public.purchase_orders(organization_id, distribution_status, created_at desc);
create index if not exists purchase_orders_destination_status_idx
  on public.purchase_orders(destination_organization_id, distribution_status, created_at desc);

create table if not exists public.distribution_order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.purchase_orders(id) on delete cascade,
  status text not null check (status in ('draft','submitted','received','approved','rejected','separating','shipped','delivered','cancelled')),
  message text not null default '',
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists distribution_order_events_order_idx
  on public.distribution_order_events(order_id, created_at);
alter table public.distribution_order_events enable row level security;

drop policy if exists purchase_orders_select on public.purchase_orders;
drop policy if exists purchase_orders_insert on public.purchase_orders;
drop policy if exists purchase_orders_update on public.purchase_orders;
drop policy if exists purchase_orders_delete on public.purchase_orders;

create policy purchase_orders_select on public.purchase_orders for select to authenticated
using (
  public.has_org_permission(organization_id, 'orders.view')
  or public.has_org_permission(destination_organization_id, 'orders.view')
  or public.has_org_permission(organization_id, 'dashboard.view')
  or public.has_org_permission(destination_organization_id, 'dashboard.view')
);

create policy purchase_orders_insert on public.purchase_orders for insert to authenticated
with check (
  created_by = auth.uid()
  and public.has_org_permission(organization_id, 'orders.create')
  and distribution_status in ('draft','submitted')
  and exists (
    select 1 from public.organizations origin
    where origin.id = organization_id
      and destination_organization_id = coalesce(origin.parent_organization_id, origin.id)
  )
);

create policy purchase_orders_delete on public.purchase_orders for delete to authenticated
using (
  public.has_org_permission(organization_id, 'orders.manage')
  and distribution_status in ('draft','rejected','cancelled')
);

drop policy if exists distribution_order_events_select on public.distribution_order_events;
create policy distribution_order_events_select on public.distribution_order_events for select to authenticated
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

create or replace function public.transition_distribution_order(
  p_order_id uuid,
  p_status text,
  p_message text default ''
) returns public.purchase_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_order public.purchase_orders;
  actor uuid := auth.uid();
  destination_manager boolean;
  origin_operator boolean;
begin
  if actor is null then raise exception 'Autenticação obrigatória'; end if;
  if p_status not in ('submitted','received','approved','rejected','separating','shipped','delivered','cancelled') then
    raise exception 'Etapa inválida';
  end if;

  select * into current_order from public.purchase_orders where id = p_order_id for update;
  if not found then raise exception 'Pedido não encontrado'; end if;

  destination_manager := public.has_org_permission(current_order.destination_organization_id, 'orders.manage');
  origin_operator := public.has_org_permission(current_order.organization_id, 'orders.create')
    or public.has_org_permission(current_order.organization_id, 'orders.manage');

  if p_status = 'submitted' and not (origin_operator and current_order.distribution_status = 'draft') then
    raise exception 'Transição não autorizada';
  elsif p_status = 'received' and not (destination_manager and current_order.distribution_status = 'submitted') then
    raise exception 'Transição não autorizada';
  elsif p_status in ('approved','rejected') and not (destination_manager and current_order.distribution_status = 'received') then
    raise exception 'Transição não autorizada';
  elsif p_status = 'separating' and not (destination_manager and current_order.distribution_status = 'approved') then
    raise exception 'Transição não autorizada';
  elsif p_status = 'shipped' and not (destination_manager and current_order.distribution_status = 'separating') then
    raise exception 'Transição não autorizada';
  elsif p_status = 'delivered' and not (origin_operator and current_order.distribution_status = 'shipped') then
    raise exception 'Transição não autorizada';
  elsif p_status = 'cancelled' and not (origin_operator and current_order.distribution_status in ('draft','submitted')) then
    raise exception 'Transição não autorizada';
  end if;

  if p_status = 'rejected' and length(trim(coalesce(p_message,''))) < 3 then
    raise exception 'Informe o motivo da rejeição';
  end if;

  update public.purchase_orders
  set distribution_status = p_status,
      status = case when p_status = 'draft' then 'Rascunho' else 'Finalizado' end,
      review_message = case when p_status in ('approved','rejected') then trim(coalesce(p_message,'')) else review_message end,
      reviewed_by = case when p_status in ('approved','rejected') then actor else reviewed_by end,
      reviewed_at = case when p_status in ('approved','rejected') then now() else reviewed_at end,
      updated_at = now()
  where id = p_order_id
  returning * into current_order;

  insert into public.distribution_order_events(order_id,status,message,changed_by)
  values (p_order_id,p_status,trim(coalesce(p_message,'')),actor);
  return current_order;
end;
$$;

create or replace function public.log_initial_distribution_order_event()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.distribution_order_events(order_id,status,message,changed_by)
  values (new.id,new.distribution_status,'',new.created_by);
  return new;
end;
$$;

drop trigger if exists log_initial_distribution_order_event on public.purchase_orders;
create trigger log_initial_distribution_order_event
after insert on public.purchase_orders for each row execute function public.log_initial_distribution_order_event();

grant select, insert, delete on public.purchase_orders to authenticated;
grant select, insert, update, delete on public.purchase_order_items to authenticated;
grant select on public.distribution_order_events to authenticated;
grant execute on function public.transition_distribution_order(uuid,text,text) to authenticated;
revoke all on public.distribution_order_events from anon;
revoke execute on function public.transition_distribution_order(uuid,text,text) from anon;
