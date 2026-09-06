-- Phase 6.5: confirmed shopping actions form one atomic receipt/inventory transaction.
alter table public.purchases add column origin text not null default 'manual' check(origin in ('manual','shopping','receipt')),add column store_location_id uuid references public.store_locations(id),add column receipt_metadata jsonb not null default '{}' check(jsonb_typeof(receipt_metadata)='object' and octet_length(receipt_metadata::text)<16384);
alter table public.purchase_items add column price_source text not null default 'manual' check(price_source in ('manual','demo','provider')),add column offer_id uuid references public.store_offers(id),add column observed_at timestamptz,add column quantity_g numeric check(quantity_g>0),add column voided_at timestamptz,add constraint purchase_item_owner_unique unique(id,user_id);
alter table public.shopping_list_items add column fulfillment text not null default 'needed' check(fulfillment in ('needed','purchased','already_have'));
-- Old checkmarks never implied an actual receipt or stock transaction.
update public.shopping_list_items set fulfillment='already_have' where purchased;
create table public.shopping_sessions(id uuid primary key,user_id uuid not null references public.profiles(id) on delete cascade,purchase_id uuid not null unique,store_id uuid references public.stores(id),location_id uuid references public.store_locations(id),status text not null default 'open' check(status in ('open','finished')),created_at timestamptz not null default now(),finished_at timestamptz,unique(id,user_id),foreign key(purchase_id,user_id) references public.purchases(id,user_id) on delete cascade);
create unique index one_open_shopping_session on public.shopping_sessions(user_id) where status='open';
create table public.shopping_fulfillments(id uuid primary key,user_id uuid not null references public.profiles(id) on delete cascade,session_id uuid not null,item_id uuid references public.shopping_list_items(id) on delete set null,purchase_item_id uuid not null unique,food_id uuid references public.foods(id),added_g numeric not null default 0 check(added_g>=0),state text not null default 'purchased' check(state in ('purchased','voided')),created_at timestamptz not null default now(),voided_at timestamptz,foreign key(session_id,user_id) references public.shopping_sessions(id,user_id) on delete cascade,foreign key(purchase_item_id,user_id) references public.purchase_items(id,user_id) on delete cascade);
create unique index one_active_fulfillment on public.shopping_fulfillments(item_id) where state='purchased';
create index shopping_fulfillments_owner on public.shopping_fulfillments(user_id,session_id);
create index shopping_fulfillments_food on public.shopping_fulfillments(food_id);
create index shopping_sessions_store on public.shopping_sessions(store_id);
create index shopping_sessions_location on public.shopping_sessions(location_id);
create index purchases_location on public.purchases(store_location_id);
create index purchase_items_offer on public.purchase_items(offer_id);
do $$ declare t text;begin foreach t in array array['shopping_sessions','shopping_fulfillments'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy owner_read on public.%I for select to authenticated using(user_id=(select auth.uid()))',t);
 execute format('revoke all on public.%I from anon,authenticated',t);execute format('grant select on public.%I to authenticated',t);
end loop;end $$;
-- Session receipts must be corrected through their ledger, not deleted underneath stock.
create policy protect_stocked_receipts on public.purchases as restrictive for delete to authenticated using(origin='manual');
revoke update,insert on public.shopping_list_items from authenticated;
grant insert(id,user_id,list_id,food_id,name,amount,unit,source) on public.shopping_list_items to authenticated;
grant update(amount,name,updated_at) on public.shopping_list_items to authenticated;

create function public.start_shopping_session(p_id uuid,p_store uuid,p_location uuid,p_name text,p_currency text,p_date date) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid=auth.uid();existing public.shopping_sessions;loc public.store_locations;label text;today date;receipt uuid=gen_random_uuid();begin
 if uid is null or p_id is null then raise exception 'Authentication required';end if;
 select (now() at time zone timezone)::date into today from public.profiles where id=uid for update;
 select * into existing from public.shopping_sessions where id=p_id;
 if found then if existing.user_id<>uid then raise exception 'Session not found';end if;return existing.id;end if;
 select * into existing from public.shopping_sessions where user_id=uid and status='open';if found then return existing.id;end if;
 if p_date is null or p_date>today or p_date<today-365 then raise exception 'Choose a purchase date within the past year';end if;
 if p_location is not null then select * into loc from public.store_locations where id=p_location;if not found or loc.store_id is distinct from p_store or loc.currency<>p_currency then raise exception 'Store location or currency does not match';end if;end if;
 if p_store is not null then select name into label from public.stores where id=p_store;else label=trim(p_name);end if;
 insert into public.purchases(id,user_id,store_id,store_location_id,store_name,purchased_on,currency,total,origin) values(receipt,uid,p_store,p_location,label,p_date,p_currency,0,'shopping');
 insert into public.shopping_sessions(id,user_id,purchase_id,store_id,location_id) values(p_id,uid,receipt,p_store,p_location);return p_id;
end $$;

create function public.fulfill_shopping_item(p_request uuid,p_session uuid,p_item uuid,p_expected timestamptz,p_product uuid,p_offer uuid,p_quantity numeric,p_unit text,p_price numeric,p_price_source text,p_expires date default null) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid=auth.uid();session public.shopping_sessions;item public.shopping_list_items;product public.retail_products;offer public.store_offers;receipt public.purchases;event public.shopping_fulfillments;grams numeric=0;line uuid=gen_random_uuid();weight numeric;expiry date;begin
 if uid is null or p_request is null then raise exception 'Authentication required';end if;
 perform 1 from public.profiles where id=uid for update;
 select * into event from public.shopping_fulfillments where id=p_request;
 if found then if event.user_id<>uid then raise exception 'Purchase action not found';end if;return event.id;end if;
 select * into session from public.shopping_sessions where id=p_session and user_id=uid for update;
 if not found or session.status<>'open' then raise exception 'Start or reopen an active shopping session';end if;
 select * into receipt from public.purchases where id=session.purchase_id and user_id=uid;
 select * into item from public.shopping_list_items where id=p_item and user_id=uid for update;
 if not found then raise exception 'Shopping item not found';end if;
 select * into event from public.shopping_fulfillments where item_id=item.id and state='purchased';if found then return event.id;end if;
 if item.updated_at is distinct from p_expected or item.fulfillment<>'needed' then raise exception 'Shopping item changed. Reload before purchasing.';end if;
 if p_quantity is null or p_quantity<=0 or p_quantity>1000000 or p_price is null or p_price<0 or p_price>1000000 or p_price<>round(p_price,2) or p_price_source not in ('manual','demo','provider') then raise exception 'Invalid purchase quantity or price';end if;
 if p_product is not null then select * into product from public.retail_products where id=p_product;if not found or product.food_id is distinct from item.food_id then raise exception 'Product does not match this food';end if;end if;
 if p_offer is not null then
  select * into offer from public.store_offers where id=p_offer;
  if not found or offer.product_id is distinct from p_product or offer.location_id is distinct from session.location_id or offer.currency<>receipt.currency then raise exception 'Offer does not match this product, location or currency';end if;
  if p_price_source='demo' and not offer.is_demo then raise exception 'Invalid demo source';end if;
  if p_price_source='provider' and offer.is_demo then raise exception 'Demo offers cannot be labeled live provider data';end if;
  if p_price_source<>'manual' and p_price<>offer.price then raise exception 'Use receipt/manual price for a corrected amount';end if;
 elsif p_price_source<>'manual' then raise exception 'A verified source offer is required';end if;
 if item.food_id is not null then
  if p_unit='package' then grams=p_quantity*product.package_grams;
  elsif p_unit='g' then grams=p_quantity;
  elsif p_unit='kg' then grams=p_quantity*1000;
  elsif p_unit='oz' then grams=p_quantity*28.349523125;
  elsif p_unit='lb' then grams=p_quantity*453.59237;
  elsif p_unit in ('piece','serving') then select case when p_unit='piece' then piece_g else serving_g end into weight from public.food_nutrition where food_id=item.food_id;grams=p_quantity*weight;
  else raise exception 'Use a known weight, portion or package unit';end if;
  grams=round(grams,3);
  if grams is null or grams<=0 or grams>1000000 then raise exception 'No reliable package or portion weight. Enter a weight instead.';end if;
  if item.unit='g' and grams<item.amount then raise exception 'Purchase quantity is below this requirement. Adjust the shopping amount first for a partial shop.';end if;
  if p_expires is not null and p_expires<receipt.purchased_on then raise exception 'Expiration cannot precede purchase date';end if;
  -- Do not silently revive expired stock by mixing in a fresh batch.
  select expires_on into expiry from public.pantry_items where user_id=uid and food_id=item.food_id and quantity_g>0 for update;
  if expiry is not null and expiry<receipt.purchased_on then raise exception 'This food has expired pantry stock. Mark it depleted before adding a fresh purchase.';end if;
 end if;
 insert into public.purchase_items(id,user_id,purchase_id,food_id,retail_product_id,name,quantity,unit,unit_price,price_source,offer_id,observed_at,quantity_g) values(line,uid,receipt.id,item.food_id,p_product,item.name,p_quantity,p_unit,p_price,p_price_source,p_offer,offer.observed_at,nullif(grams,0));
 if grams>0 then
  insert into public.pantry_items(user_id,food_id,quantity_g,purchased_on,expires_on) values(uid,item.food_id,grams,receipt.purchased_on,p_expires)
  on conflict(user_id,food_id) do update set quantity_g=public.pantry_items.quantity_g+excluded.quantity_g,purchased_on=case when public.pantry_items.quantity_g=0 then excluded.purchased_on else least(public.pantry_items.purchased_on,excluded.purchased_on) end,expires_on=case when public.pantry_items.quantity_g=0 then excluded.expires_on else least(public.pantry_items.expires_on,excluded.expires_on) end;
 end if;
 insert into public.shopping_fulfillments(id,user_id,session_id,item_id,purchase_item_id,food_id,added_g) values(p_request,uid,session.id,item.id,line,item.food_id,grams);
 update public.shopping_list_items set fulfillment='purchased',purchased=true where id=item.id;
 update public.purchases set total=(select coalesce(sum(round(quantity*unit_price,2)),0) from public.purchase_items where purchase_id=receipt.id and voided_at is null) where id=receipt.id;
 return p_request;
end $$;

create function public.correct_shopping_purchase(p_event uuid,p_price numeric) returns void language plpgsql security definer set search_path='' as $$
declare e public.shopping_fulfillments;sid uuid;begin
 perform 1 from public.profiles where id=auth.uid() for update;
 select * into e from public.shopping_fulfillments where id=p_event and user_id=auth.uid() and state='purchased' for update;
 if not found then raise exception 'Purchase action not found';end if;
 if p_price is null or p_price<0 or p_price>1000000 or p_price<>round(p_price,2) then raise exception 'Enter a valid receipt price';end if;
 select purchase_id into sid from public.shopping_sessions where id=e.session_id;
 update public.purchase_items set unit_price=p_price,price_source='manual' where id=e.purchase_item_id;
 update public.purchases set total=(select coalesce(sum(round(quantity*unit_price,2)),0) from public.purchase_items where purchase_id=sid and voided_at is null) where id=sid;
end $$;
create function public.undo_shopping_purchase(p_event uuid) returns void language plpgsql security definer set search_path='' as $$
declare e public.shopping_fulfillments;sid uuid;stock numeric;begin
 perform 1 from public.profiles where id=auth.uid() for update;
 select * into e from public.shopping_fulfillments where id=p_event and user_id=auth.uid() for update;if not found then raise exception 'Purchase action not found';end if;if e.state='voided' then return;end if;
 if e.added_g>0 then
  select quantity_g into stock from public.pantry_items where user_id=auth.uid() and food_id=e.food_id for update;
  if coalesce(stock,0)<e.added_g or exists(select 1 from public.pantry_movements where user_id=auth.uid() and food_id=e.food_id and created_at>=e.created_at) then raise exception 'This stock may already have been used. Undo the related meal completion and restore inventory before reversing the purchase.';end if;
  update public.pantry_items set quantity_g=quantity_g-e.added_g where user_id=auth.uid() and food_id=e.food_id;
 end if;
 update public.shopping_fulfillments set state='voided',voided_at=clock_timestamp() where id=e.id;
 update public.purchase_items set voided_at=clock_timestamp() where id=e.purchase_item_id;
 update public.shopping_list_items set purchased=false,fulfillment='needed' where id=e.item_id;
 select purchase_id into sid from public.shopping_sessions where id=e.session_id;
 update public.purchases set total=(select coalesce(sum(round(quantity*unit_price,2)),0) from public.purchase_items where purchase_id=sid and voided_at is null) where id=sid;
end $$;
create function public.mark_shopping_requirement(p_item uuid,p_state text,p_expected timestamptz) returns void language plpgsql security definer set search_path='' as $$
declare item public.shopping_list_items;begin
 if p_state not in ('needed','already_have') then raise exception 'Invalid requirement state';end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 select * into item from public.shopping_list_items where id=p_item and user_id=auth.uid() for update;if not found then raise exception 'Shopping item not found';end if;
 if item.fulfillment=p_state then return;end if;
 if item.fulfillment='purchased' then raise exception 'Use Undo purchase to reverse spending and pantry safely';end if;
 if item.updated_at is distinct from p_expected then raise exception 'Shopping item changed. Reload and try again.';end if;
 update public.shopping_list_items set fulfillment=p_state,purchased=(p_state='already_have') where id=item.id;
end $$;
create function public.finish_shopping_session(p_session uuid) returns void language plpgsql security definer set search_path='' as $$ begin
 perform 1 from public.profiles where id=auth.uid() for update;
 update public.shopping_sessions set status='finished',finished_at=coalesce(finished_at,clock_timestamp()) where id=p_session and user_id=auth.uid();if not found then raise exception 'Session not found';end if;
end $$;
-- Recalculation is explicit and cannot replace a cart while someone is shopping.
alter function public.refresh_shopping_list(date,date) rename to refresh_shopping_list_v6;
revoke all on function public.refresh_shopping_list_v6(date,date) from public,anon,authenticated;
create function public.refresh_shopping_list(p_start date,p_end date) returns uuid language plpgsql security definer set search_path='' as $$ begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 if exists(select 1 from public.shopping_sessions where user_id=auth.uid() and status='open') then raise exception 'Finish your shopping session before recalculating requirements';end if;
 delete from public.shopping_list_items where user_id=auth.uid() and source='generated' and fulfillment<>'needed';
 return public.refresh_shopping_list_v6(p_start,p_end);
end $$;
-- Protect the existing manual receipt API from altering a stocked session receipt.
alter function public.save_purchase(jsonb,jsonb) rename to save_manual_purchase_v6;
revoke all on function public.save_manual_purchase_v6(jsonb,jsonb) from public,anon,authenticated;
create function public.save_purchase(p_purchase jsonb,p_items jsonb) returns uuid language plpgsql security definer set search_path='' as $$ begin
 perform 1 from public.profiles where id=auth.uid() for update;
 if exists(select 1 from public.purchases where id=(p_purchase->>'id')::uuid and origin<>'manual') then raise exception 'Correct shopping receipts through their shopping session';end if;
 return public.save_manual_purchase_v6(p_purchase,p_items);
end $$;
create or replace function public.purchase_months() returns table(month text,currency text,total numeric,purchase_count bigint,shopping_days bigint) language sql stable security invoker set search_path='' as $$
 select to_char(p.purchased_on,'YYYY-MM'),p.currency,sum(p.total),count(*),count(distinct p.purchased_on) from public.purchases p where p.user_id=auth.uid() and exists(select 1 from public.purchase_items i where i.purchase_id=p.id and i.voided_at is null) group by 1,2 order by 1 desc;
$$;
do $$ declare signature text;begin foreach signature in array array['start_shopping_session(uuid,uuid,uuid,text,text,date)','fulfill_shopping_item(uuid,uuid,uuid,timestamptz,uuid,uuid,numeric,text,numeric,text,date)','correct_shopping_purchase(uuid,numeric)','undo_shopping_purchase(uuid)','mark_shopping_requirement(uuid,text,timestamptz)','finish_shopping_session(uuid)','refresh_shopping_list(date,date)','save_purchase(jsonb,jsonb)'] loop execute 'revoke all on function public.'||signature||' from public,anon';execute 'grant execute on function public.'||signature||' to authenticated';end loop;end $$;
create function public.demo_spending_months() returns table(month text,currency text,demo_total numeric) language sql stable security invoker set search_path='' as $$ select to_char(p.purchased_on,'YYYY-MM'),p.currency,sum(round(i.quantity*i.unit_price,2)) from public.purchases p join public.purchase_items i on i.purchase_id=p.id where p.user_id=auth.uid() and i.price_source='demo' and i.voided_at is null group by 1,2; $$;
revoke all on function public.demo_spending_months() from public,anon;
grant execute on function public.demo_spending_months() to authenticated;
