-- Reviewed receipts share the existing purchase/stock reversal ledger. No OCR writes.
create table public.receipt_price_observations (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 purchase_item_id uuid not null unique, product_id uuid not null references public.retail_products(id),
 currency text not null check(currency in ('USD','CAD')), observed_on date not null,
 foreign key(purchase_item_id,user_id) references public.purchase_items(id,user_id) on delete cascade
);
alter table public.receipt_price_observations enable row level security;
create policy owner_read on public.receipt_price_observations for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.receipt_price_observations from anon,authenticated;
grant select on public.receipt_price_observations to authenticated;
create function public.confirm_reviewed_receipt(p_upload uuid,p_review jsonb,p_confirmed boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare uid uuid=auth.uid(); dt date; today date; pid uuid; sid uuid=gen_random_uuid();
 x jsonb; fid uuid; prod uuid; shopping uuid; line uuid; grams numeric; qty numeric; price numeric;
 item public.shopping_list_items; product public.retail_products; expiry date; total numeric=0; expected numeric;
begin
 if uid is null then raise exception 'Authentication required';end if;
 if p_confirmed is distinct from true then raise exception 'Review and confirm every receipt detail first';end if;
 select (now() at time zone timezone)::date into today from public.profiles where id=uid for update;
 if not exists(select 1 from public.user_uploads where id=p_upload and user_id=uid and bucket='receipts' and status='ready') then raise exception 'Receipt image not found';end if;
 -- Upload UUID is the receipt identity; a changed retry never silently overwrites a saved receipt.
 select id into pid from public.purchases where id=p_upload and user_id=uid and origin='receipt';
 if found then return pid;end if;
 dt=(p_review->>'date')::date;expected=(p_review->>'total')::numeric;
 if dt is null or dt>today or dt<today-365 then raise exception 'Choose a purchase date within the past year';end if;
 if expected is null or expected<0 or expected>1000000 or expected<>round(expected,2) then raise exception 'Invalid receipt total';end if;
 if jsonb_typeof(p_review->'items') is distinct from 'array' or jsonb_array_length(p_review->'items') not between 1 and 100 then raise exception 'Review 1 to 100 receipt lines';end if;
 insert into public.purchases(id,user_id,store_name,purchased_on,currency,total,origin,receipt_metadata)
 values(p_upload,uid,trim(p_review->>'store'),dt,p_review->>'currency',0,'receipt',jsonb_build_object('upload_id',p_upload,'reviewed_at',clock_timestamp()));
 -- A finished session avoids interfering with an open cart and retains safe correction/undo.
 insert into public.shopping_sessions(id,user_id,purchase_id,status,finished_at) values(sid,uid,p_upload,'finished',clock_timestamp());
 for x in select value from jsonb_array_elements(p_review->'items') loop
  fid=nullif(x->>'foodId','')::uuid;prod=nullif(x->>'productId','')::uuid;shopping=nullif(x->>'shoppingId','')::uuid;
  grams=nullif(x->>'grams','')::numeric;qty=(x->>'quantity')::numeric;price=(x->>'price')::numeric;line=gen_random_uuid();
  if qty is null or qty<1 or qty>1000000 or qty<>trunc(qty) or price is null or price<0 or price>1000000 or price<>round(price,2) then raise exception 'Enter whole purchased units and a valid price per unit';end if;
  if fid is not null then
   if not exists(select 1 from public.foods where id=fid and (user_id is null or user_id=uid)) then raise exception 'Food not available';end if;
   if grams is null or grams<=0 or grams>1000000 then raise exception 'Confirm total gram weight for pantry items';end if;
   grams=round(grams,3);
  elsif grams is not null or prod is not null or shopping is not null then raise exception 'Choose a food before matching stock or groceries';end if;
  if prod is not null then
   select * into product from public.retail_products where id=prod and food_id=fid and is_active;
   if not found or product.package_grams is null or abs(product.package_grams*qty-grams)>.01 then raise exception 'Product package weight does not match the reviewed quantity';end if;
  end if;
  if shopping is not null then
   select * into item from public.shopping_list_items where id=shopping and user_id=uid for update;
   if not found or item.food_id is distinct from fid or item.fulfillment<>'needed' or item.updated_at is distinct from (x->>'expected')::timestamptz then raise exception 'Grocery requirement changed. Reload and review again';end if;
   if item.unit<>'g' or grams<item.amount then raise exception 'Match a complete gram-based grocery requirement, or leave it unmatched';end if;
  end if;
  if fid is not null then
   select expires_on into expiry from public.pantry_items where user_id=uid and food_id=fid and quantity_g>0 for update;
   if expiry is not null and expiry<today then raise exception 'Remove expired pantry stock before adding a fresh purchase';end if;
  end if;
  insert into public.purchase_items(id,user_id,purchase_id,food_id,retail_product_id,name,quantity,unit,unit_price,quantity_g,price_source,observed_at)
   values(line,uid,p_upload,fid,prod,trim(x->>'name'),qty,'package',price,grams,'manual',clock_timestamp());
  if fid is not null then
   insert into public.pantry_items(user_id,food_id,quantity_g,purchased_on) values(uid,fid,grams,dt)
   on conflict(user_id,food_id) do update set quantity_g=public.pantry_items.quantity_g+excluded.quantity_g,
    purchased_on=case when public.pantry_items.quantity_g=0 then excluded.purchased_on else least(public.pantry_items.purchased_on,excluded.purchased_on) end,
    expires_on=case when public.pantry_items.quantity_g=0 then null else public.pantry_items.expires_on end;
  end if;
  insert into public.shopping_fulfillments(id,user_id,session_id,item_id,purchase_item_id,food_id,added_g) values(gen_random_uuid(),uid,sid,shopping,line,fid,coalesce(grams,0));
  if shopping is not null then update public.shopping_list_items set fulfillment='purchased',purchased=true where id=shopping;end if;
  if prod is not null then insert into public.receipt_price_observations(user_id,purchase_item_id,product_id,currency,observed_on) values(uid,line,prod,p_review->>'currency',dt);end if;
  total=total+round(qty*price,2);
 end loop;
 if total<>expected then raise exception 'Receipt total must equal the reviewed lines, including tax or other charges';end if;
 update public.purchases p set total=expected where p.id=p_upload;
 return p_upload;
end $$;
revoke all on function public.confirm_reviewed_receipt(uuid,jsonb,boolean) from public,anon;
grant execute on function public.confirm_reviewed_receipt(uuid,jsonb,boolean) to authenticated;
