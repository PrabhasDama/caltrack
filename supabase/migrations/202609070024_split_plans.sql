-- Persist recommendations separately from the existing purchase/stock ledger.
create table public.split_plans (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,
 fingerprint text not null,status text not null default 'applied' check(status in ('applied','partial','completed','replaced','abandoned')),
 currency text not null check(currency in ('USD','CAD')),max_stores int not null check(max_stores between 1 and 3),extra_store_penalty numeric not null check(extra_store_penalty between 0 and 100),
 expected_total numeric not null check(expected_total>=0),baseline_total numeric check(baseline_total>=0),engine_version text not null default 'phase9-v1',
 created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),unique(id,user_id),unique(user_id,fingerprint)
);
create unique index one_active_split on public.split_plans(user_id) where status in ('applied','partial');
create table public.split_assignments (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,plan_id uuid not null,
 item_id uuid references public.shopping_list_items(id) on delete set null,original_item_id uuid not null,food_id uuid not null references public.foods(id),item_name text not null,
 store_id uuid references public.stores(id) on delete set null,location_id uuid references public.store_locations(id) on delete set null,store_name text not null,location_name text not null,
 product_id uuid references public.retail_products(id) on delete set null,product_name text not null,package_g numeric not null check(package_g>0),package_count int not null check(package_count>0),
 original_need_g numeric not null check(original_need_g>0),allocated_g numeric not null check(allocated_g>0),expected_unit_price numeric not null check(expected_unit_price>=0),
 price_source text not null check(price_source in ('demo','provider','manual','receipt','observed')),price_reference_id uuid,observed_at timestamptz,
 state text not null default 'pending' check(state in ('pending','purchased','elsewhere','already_have','not_needed','review')),
 unique(id,user_id),unique(plan_id,original_item_id,location_id,product_id),foreign key(plan_id,user_id) references public.split_plans(id,user_id) on delete cascade
);
create index split_assignments_owner on public.split_assignments(user_id,plan_id);
create index split_assignments_item on public.split_assignments(item_id);
alter table public.shopping_fulfillments add column split_assignment_id uuid;
alter table public.shopping_fulfillments add constraint fulfillment_split_owner foreign key(split_assignment_id,user_id) references public.split_assignments(id,user_id);
drop index public.one_active_fulfillment;
create unique index one_active_fulfillment on public.shopping_fulfillments(item_id) where state='purchased' and split_assignment_id is null;
create unique index one_split_purchase on public.shopping_fulfillments(split_assignment_id) where state='purchased';
do $$ declare t text;begin foreach t in array array['split_plans','split_assignments'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy owner_read on public.%I for select to authenticated using(user_id=(select auth.uid()))',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);execute format('grant select on public.%I to authenticated',t);
end loop;end $$;

create function public.reconcile_splits_for(uid uuid) returns void language plpgsql security definer set search_path='' as $$
declare p public.split_plans;a public.split_assignments;i public.shopping_list_items;next_state text;paid numeric;begin
 perform 1 from public.profiles where id=uid for update;if not found then return;end if;
 for p in select * from public.split_plans where user_id=uid and status in ('applied','partial','completed') order by created_at desc loop
  -- A replaced/abandoned snapshot is immutable history. Reversal reopens only the latest plan.
  if p.status='completed' and exists(select 1 from public.split_plans where user_id=uid and created_at>p.created_at) then continue;end if;
  for a in select * from public.split_assignments where plan_id=p.id loop
   select * into i from public.shopping_list_items where id=a.item_id and user_id=uid;
   if exists(select 1 from public.shopping_fulfillments where split_assignment_id=a.id and user_id=uid and state='purchased') then next_state='purchased';
   elsif i.fulfillment='purchased' then next_state='elsewhere';
   elsif i.fulfillment='already_have' then next_state='already_have';
   elsif i.id is null or i.amount=0 then next_state='not_needed';
   else
    select coalesce(sum(f.added_g),0) into paid from public.shopping_fulfillments f join public.split_assignments sa on sa.id=f.split_assignment_id where sa.plan_id=p.id and sa.original_item_id=a.original_item_id and f.state='purchased';
    next_state=case when abs(i.amount-greatest(0,a.original_need_g-paid))<.01 then 'pending' else 'review' end;
   end if;
   update public.split_assignments set state=next_state where id=a.id and state<>next_state;
  end loop;
  next_state=case when not exists(select 1 from public.split_assignments where plan_id=p.id and state in ('pending','review')) then 'completed' when exists(select 1 from public.split_assignments where plan_id=p.id and state in ('purchased','elsewhere','already_have')) then 'partial' else 'applied' end;
  update public.split_plans set status=next_state,updated_at=clock_timestamp() where id=p.id and status<>next_state;
 end loop;
end $$;
revoke all on function public.reconcile_splits_for(uuid) from public,anon,authenticated;
create function public.split_state_changed() returns trigger language plpgsql security definer set search_path='' as $$ begin
 perform public.reconcile_splits_for(case when tg_op='DELETE' then old.user_id else new.user_id end);return null;end $$;
revoke all on function public.split_state_changed() from public,anon,authenticated;
create constraint trigger z_split_items after insert or update or delete on public.shopping_list_items deferrable initially deferred for each row execute function public.split_state_changed();
create constraint trigger z_split_purchases after insert or update or delete on public.shopping_fulfillments deferrable initially deferred for each row execute function public.split_state_changed();
create function public.sync_split_plans() returns void language plpgsql security definer set search_path='' as $$ begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 perform public.reconcile_groceries_for(auth.uid());perform public.reconcile_splits_for(auth.uid());end $$;

create function public.apply_split_plan(p_lines jsonb,p_currency text,p_max_stores int,p_penalty numeric,p_baseline numeric default null) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid=auth.uid();pid uuid;fp text;r jsonb;i public.shopping_list_items;prod public.retail_products;loc public.store_locations;off public.store_offers;obs record;price numeric;qty int;allocated numeric;total numeric=0;ref uuid;src text;stamp timestamptz;begin
 if uid is null then raise exception 'Authentication required';end if;
 perform 1 from public.profiles where id=uid for update;
 if p_lines is null or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines) not between 1 and 100 then raise exception 'Choose a nonempty, fully priced cart';end if;
 if p_currency not in ('USD','CAD') or p_max_stores not between 1 and 3 or p_penalty not between 0 and 100 or p_baseline<0 then raise exception 'Invalid cart settings';end if;
 select md5(jsonb_build_object('lines',jsonb_agg(value order by value->>'item',value->>'location',value->>'product'),'currency',p_currency,'max',p_max_stores,'penalty',p_penalty,'baseline',p_baseline)::text) into fp from jsonb_array_elements(p_lines);
 select id into pid from public.split_plans where user_id=uid and fingerprint=fp;if found then return pid;end if;
 perform public.reconcile_groceries_for(uid);
 if exists(select 1 from public.shopping_sessions where user_id=uid and status='open') then raise exception 'Finish the current shopping trip before applying a new plan';end if;
 if (select count(distinct value->>'location') from jsonb_array_elements(p_lines))>p_max_stores then raise exception 'Too many stores';end if;
 update public.split_plans set status='replaced',updated_at=clock_timestamp() where user_id=uid and status in ('applied','partial');
 insert into public.split_plans(user_id,fingerprint,currency,max_stores,extra_store_penalty,expected_total,baseline_total) values(uid,fp,p_currency,p_max_stores,p_penalty,0,p_baseline) returning id into pid;
 for r in select value from jsonb_array_elements(p_lines) order by value->>'item',value->>'location',value->>'product' loop
  select * into i from public.shopping_list_items where id=(r->>'item')::uuid and user_id=uid;
  if not found or i.fulfillment<>'needed' or i.unit<>'g' or i.amount<=0 or i.updated_at is distinct from (r->>'expected')::timestamptz then raise exception 'Groceries changed. Review the current recommendation before applying';end if;
  select * into prod from public.retail_products where id=(r->>'product')::uuid and is_active and food_id=i.food_id;
  if not found then raise exception 'Product is no longer available for this food';end if;
  select * into loc from public.store_locations where id=(r->>'location')::uuid and currency=p_currency;
  if not found then raise exception 'Store location is unavailable';end if;
  qty=(r->>'count')::int;if qty<=0 or qty>1000000 or prod.package_grams is null or prod.package_grams*qty>1000000 then raise exception 'Invalid package quantity';end if;
  src=r->>'source';ref=(r->>'reference')::uuid;
  if src in ('demo','provider') then
   select * into off from public.store_offers where id=ref and product_id=prod.id and location_id=loc.id and currency=p_currency;
   if not found or (src='demo') is distinct from off.is_demo then raise exception 'Offer is unavailable';end if;
   price=off.price;stamp=off.observed_at;
  elsif src in ('manual','receipt','observed') then
   select pi.unit_price,pu.purchased_on into obs from public.purchase_items pi join public.purchases pu on pu.id=pi.purchase_id where pi.id=ref and pi.user_id=uid and pi.retail_product_id=prod.id and pi.unit='package' and pi.price_source<>'demo' and pi.voided_at is null and pu.store_location_id=loc.id and pu.currency=p_currency;
   if not found then raise exception 'Price observation is unavailable';end if;
   price=obs.unit_price;stamp=obs.purchased_on::timestamptz;
  else raise exception 'Invalid price provenance';end if;
  if price is distinct from (r->>'price')::numeric then raise exception 'Price changed. Review the current recommendation';end if;
  select greatest(0,i.amount-coalesce(sum(allocated_g),0)) into allocated from public.split_assignments where plan_id=pid and original_item_id=i.id;
  allocated=least(allocated,prod.package_grams*qty);if allocated<=0 then raise exception 'Duplicate or unnecessary package allocation';end if;
  insert into public.split_assignments(user_id,plan_id,item_id,original_item_id,food_id,item_name,store_id,location_id,store_name,location_name,product_id,product_name,package_g,package_count,original_need_g,allocated_g,expected_unit_price,price_source,price_reference_id,observed_at)
  values(uid,pid,i.id,i.id,i.food_id,i.name,loc.store_id,loc.id,(select name from public.stores where id=loc.store_id),loc.name,prod.id,prod.name,prod.package_grams,qty,i.amount,allocated,price,src,ref,stamp);
  total=total+round(price*qty,2);
 end loop;
 if exists(select 1 from public.split_assignments where plan_id=pid group by original_item_id having sum(allocated_g)<max(original_need_g)) then raise exception 'Packages do not cover their grocery requirements';end if;
 update public.split_plans set expected_total=total where id=pid;return pid;
end $$;
create function public.abandon_split_plan(p_plan uuid) returns void language plpgsql security definer set search_path='' as $$ begin
 perform 1 from public.profiles where id=auth.uid() for update;
 update public.split_plans set status='abandoned',updated_at=clock_timestamp() where id=p_plan and user_id=auth.uid() and status in ('applied','partial');
 if not found then raise exception 'Active split plan not found';end if;
end $$;
create function public.start_split_store(p_plan uuid,p_location uuid,p_session uuid,p_date date) returns uuid language plpgsql security definer set search_path='' as $$
declare p public.split_plans;a public.split_assignments;s public.shopping_sessions;begin
 perform 1 from public.profiles where id=auth.uid() for update;perform public.sync_split_plans();
 select * into p from public.split_plans where id=p_plan and user_id=auth.uid() and status in ('applied','partial');if not found then raise exception 'Active split plan not found';end if;
 select * into a from public.split_assignments where plan_id=p.id and location_id=p_location and state='pending' limit 1;if not found then raise exception 'This store has no ready assignments';end if;
 select * into s from public.shopping_sessions where user_id=auth.uid() and status='open';
 if found then if s.location_id is distinct from a.location_id then raise exception 'Finish the current store before starting another';end if;return s.id;end if;
 return public.start_shopping_session(p_session,a.store_id,a.location_id,a.store_name,p.currency,p_date);
end $$;
create function public.record_shopping_purchase(p_request uuid,p_session uuid,p_item uuid,p_expected timestamptz,p_product uuid,p_offer uuid,p_quantity numeric,p_unit text,p_price numeric,p_price_source text,p_expires date,p_assignment uuid) returns uuid language plpgsql security definer set search_path='' as $$
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
 select * into event from public.shopping_fulfillments where item_id=item.id and state='purchased' and split_assignment_id is null;if found then return event.id;end if;
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
  if p_assignment is null and item.unit='g' and grams<item.amount then raise exception 'Purchase quantity is below this requirement. Adjust the shopping amount first for a partial shop.';end if;
  if p_expires is not null and p_expires<receipt.purchased_on then raise exception 'Expiration cannot precede purchase date';end if;
  -- Do not silently revive expired stock by mixing in a fresh batch.
  select expires_on into expiry from public.pantry_items where user_id=uid and food_id=item.food_id and quantity_g>0 for update;
  if expiry is not null and expiry<receipt.purchased_on then raise exception 'This food has expired pantry stock. Mark it depleted before adding a fresh purchase.';end if;
 end if;
 insert into public.purchase_items(id,user_id,purchase_id,food_id,retail_product_id,name,quantity,unit,unit_price,price_source,offer_id,observed_at,quantity_g) values(line,uid,receipt.id,item.food_id,p_product,item.name,p_quantity,p_unit,p_price,p_price_source,p_offer,offer.observed_at,nullif(grams,0));
 if p_assignment is not null and grams<least(item.amount,(select allocated_g from public.split_assignments where id=p_assignment and user_id=uid)) then raise exception 'Purchase weight is below this store assignment';end if;
 if grams>0 then
  insert into public.pantry_items(user_id,food_id,quantity_g,purchased_on,expires_on) values(uid,item.food_id,grams,receipt.purchased_on,p_expires)
  on conflict(user_id,food_id) do update set quantity_g=public.pantry_items.quantity_g+excluded.quantity_g,purchased_on=case when public.pantry_items.quantity_g=0 then excluded.purchased_on else least(public.pantry_items.purchased_on,excluded.purchased_on) end,expires_on=case when public.pantry_items.quantity_g=0 then excluded.expires_on else least(public.pantry_items.expires_on,excluded.expires_on) end;
 end if;
 insert into public.shopping_fulfillments(id,user_id,session_id,item_id,purchase_item_id,food_id,added_g,split_assignment_id) values(p_request,uid,session.id,item.id,line,item.food_id,grams,p_assignment);
 if p_assignment is not null and grams<item.amount then update public.shopping_list_items set amount=item.amount-grams where id=item.id;else update public.shopping_list_items set fulfillment='purchased',purchased=true where id=item.id;end if;
 update public.purchases set total=(select coalesce(sum(round(quantity*unit_price,2)),0) from public.purchase_items where purchase_id=receipt.id and voided_at is null) where id=receipt.id;
 return p_request;
end $$;


revoke all on function public.record_shopping_purchase(uuid,uuid,uuid,timestamptz,uuid,uuid,numeric,text,numeric,text,date,uuid) from public,anon,authenticated;
create or replace function public.fulfill_shopping_item(p_request uuid,p_session uuid,p_item uuid,p_expected timestamptz,p_product uuid,p_offer uuid,p_quantity numeric,p_unit text,p_price numeric,p_price_source text,p_expires date default null) returns uuid language plpgsql security definer set search_path='' as $$ begin
 return public.record_shopping_purchase(p_request,p_session,p_item,p_expected,p_product,p_offer,p_quantity,p_unit,p_price,p_price_source,p_expires,null);end $$;
create function public.purchase_split_assignment(p_assignment uuid,p_request uuid,p_session uuid,p_expected timestamptz,p_product uuid,p_quantity numeric,p_unit text,p_price numeric,p_expires date default null) returns uuid language plpgsql security definer set search_path='' as $$
declare a public.split_assignments;p public.split_plans;s public.shopping_sessions;e public.shopping_fulfillments;begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 select * into a from public.split_assignments where id=p_assignment and user_id=auth.uid();if not found then raise exception 'Assignment not found';end if;
 select * into e from public.shopping_fulfillments where (id=p_request or split_assignment_id=a.id and state='purchased') and user_id=auth.uid() order by created_at limit 1;if found then if e.split_assignment_id is distinct from a.id then raise exception 'Purchase request belongs to another assignment';end if;return e.id;end if;
 perform public.sync_split_plans();select * into a from public.split_assignments where id=p_assignment;
 select * into p from public.split_plans where id=a.plan_id and user_id=auth.uid();
 if p.status not in ('applied','partial') or a.state<>'pending' then raise exception 'Assignment changed. Review the remaining plan';end if;
 select * into s from public.shopping_sessions where id=p_session and user_id=auth.uid() and status='open';
 if not found or s.location_id is distinct from a.location_id then raise exception 'Start this assigned store before purchasing';end if;
 return public.record_shopping_purchase(p_request,p_session,a.item_id,p_expected,p_product,null,p_quantity,p_unit,p_price,'manual',p_expires,a.id);
end $$;
do $$ declare sig text;begin foreach sig in array array['sync_split_plans()','apply_split_plan(jsonb,text,integer,numeric,numeric)','abandon_split_plan(uuid)','start_split_store(uuid,uuid,uuid,date)','purchase_split_assignment(uuid,uuid,uuid,timestamptz,uuid,numeric,text,numeric,date)'] loop execute 'revoke all on function public.'||sig||' from public,anon';execute 'grant execute on function public.'||sig||' to authenticated';end loop;end $$;
