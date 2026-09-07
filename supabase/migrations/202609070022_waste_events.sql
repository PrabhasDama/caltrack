create table public.food_waste_events(id uuid primary key,user_id uuid not null references public.profiles(id) on delete cascade,food_id uuid not null references public.foods(id),quantity_g numeric not null check(quantity_g>0),reason text not null check(reason in ('expired','discarded')),recorded_at timestamptz not null default clock_timestamp(),estimated_cost numeric,currency text check(currency in ('USD','CAD')));
alter table public.food_waste_events enable row level security;
create policy owner_read on public.food_waste_events for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.food_waste_events from anon,authenticated;grant select on public.food_waste_events to authenticated;
create function public.record_food_waste(p_id uuid,p_pantry uuid,p_expected timestamptz,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare stock public.pantry_items;price numeric;curr text;begin
 if auth.uid() is null or p_id is null or p_reason not in ('expired','discarded') then raise exception 'Invalid waste entry';end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 if exists(select 1 from public.food_waste_events where id=p_id and user_id=auth.uid()) then return;end if;
 select * into stock from public.pantry_items where id=p_pantry and user_id=auth.uid() for update;
 if not found or stock.quantity_g<=0 or stock.updated_at is distinct from p_expected then raise exception 'Pantry changed. Reload before recording waste';end if;
 select i.quantity*i.unit_price/i.quantity_g,p.currency into price,curr from public.purchase_items i join public.purchases p on p.id=i.purchase_id where i.user_id=auth.uid() and i.food_id=stock.food_id and i.voided_at is null and i.quantity_g>0 and i.price_source<>'demo' order by p.purchased_on desc,i.created_at desc limit 1;
 insert into public.food_waste_events(id,user_id,food_id,quantity_g,reason,estimated_cost,currency) values(p_id,auth.uid(),stock.food_id,stock.quantity_g,p_reason,round(stock.quantity_g*price,2),curr);
 update public.pantry_items set quantity_g=0 where id=stock.id;
end $$;
revoke all on function public.record_food_waste(uuid,uuid,timestamptz,text) from public,anon;grant execute on function public.record_food_waste(uuid,uuid,timestamptz,text) to authenticated;
