-- Reuse the existing public catalog/offer ledger; private preferences and matches stay separate.
alter table public.store_locations add column provider text,add column provider_location_id text,add column address text,add column latitude double precision,add column longitude double precision,add column retrieved_at timestamptz;
create unique index provider_location_identity on public.store_locations(provider,provider_location_id) where provider is not null;
alter table public.store_locations add constraint valid_store_coordinates check((latitude is null and longitude is null) or (latitude between -90 and 90 and longitude between -180 and 180));
alter table public.retail_products alter column package_amount drop not null,alter column package_unit drop not null;
alter table public.retail_products add column provider text,add column provider_product_id text,add column provider_item_id text,add column upc text,add column brand text;
create unique index provider_product_identity on public.retail_products(provider,provider_product_id,provider_item_id) where provider is not null;
alter table public.store_offers add column retrieved_at timestamptz,add column environment text not null default 'production' check(environment in ('production','certification')),add column regular_price numeric check(regular_price>=0),add column promo_price numeric check(promo_price>=0),add column availability text not null default 'unknown' check(availability in ('in_stock','low_stock','out_of_stock','unknown')),add column price_status text not null default 'known' check(price_status in ('known','unavailable'));
create table public.location_preferences(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,location_id uuid not null references public.store_locations(id),state text not null check(state in ('selected','excluded')),unique(user_id,location_id));
create table public.location_search_settings(id uuid primary key default gen_random_uuid(),user_id uuid not null unique references public.profiles(id) on delete cascade,postal_code text not null default '' check(length(postal_code)<=12),radius_miles int not null default 10 check(radius_miles between 1 and 50),share_prices boolean not null default false);
create table public.product_food_matches(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,product_id uuid not null references public.retail_products(id),food_id uuid not null references public.foods(id) on delete cascade,package_grams numeric not null check(package_grams>0 and package_grams<=1000000),method text not null default 'user_confirmed' check(method='user_confirmed'),confirmed_at timestamptz not null default now(),unique(user_id,product_id));
do $$ declare t text;begin foreach t in array array['location_preferences','location_search_settings','product_food_matches'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy owner_rows on public.%I for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()))',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
end loop;end $$;
grant insert,update,delete on public.location_preferences to authenticated;
-- Settings and mapping writes go through validated self-only RPCs.
create function public.save_location_settings(p_postal text,p_radius int,p_share boolean) returns void language plpgsql security definer set search_path='' as $$ begin
 if auth.uid() is null or p_radius is null or p_radius not between 1 and 50 or p_postal is null or length(p_postal)>12 or p_share is null then raise exception 'Invalid location preferences';end if;
 insert into public.location_search_settings(user_id,postal_code,radius_miles,share_prices) values(auth.uid(),trim(p_postal),p_radius,p_share) on conflict(user_id) do update set postal_code=excluded.postal_code,radius_miles=excluded.radius_miles,share_prices=excluded.share_prices;
end $$;
create function public.confirm_product_match(p_product uuid,p_food uuid,p_grams numeric) returns void language plpgsql security definer set search_path='' as $$ declare p public.retail_products;begin
 if auth.uid() is null or not exists(select 1 from public.foods where id=p_food and (user_id is null or user_id=auth.uid())) then raise exception 'Food not found';end if;
 select * into p from public.retail_products where id=p_product and is_active;
 if not found or p_grams is null or p_grams<=0 or p_grams>1000000 or (p.package_grams is not null and abs(p.package_grams-p_grams)>.01) then raise exception 'Confirm the actual package weight';end if;
 insert into public.product_food_matches(user_id,product_id,food_id,package_grams) values(auth.uid(),p_product,p_food,p_grams) on conflict(user_id,product_id) do update set food_id=excluded.food_id,package_grams=excluded.package_grams,confirmed_at=now();
end $$;
create function public.effective_products() returns setof public.retail_products language plpgsql stable security invoker set search_path='' as $$ declare p public.retail_products;m public.product_food_matches;begin
 for p in select * from public.retail_products loop
  select * into m from public.product_food_matches where product_id=p.id and user_id=auth.uid();
  if found then p.food_id=m.food_id;p.package_grams=m.package_grams;end if;return next p;
 end loop;
end $$;
-- Preserve the existing transaction bodies while resolving only the caller's reviewed food/weight mapping.
do $$ declare sig text;body text;begin
 foreach sig in array array['public.apply_split_plan(jsonb,text,integer,numeric,numeric)','public.record_shopping_purchase(uuid,uuid,uuid,timestamptz,uuid,uuid,numeric,text,numeric,text,date,uuid)','public.confirm_reviewed_receipt(uuid,jsonb,boolean)','public.save_manual_purchase_v6(jsonb,jsonb)'] loop
 body=pg_get_functiondef(sig::regprocedure);
 if position('public.retail_products where' in body)=0 then raise exception 'Expected product resolution missing in %',sig;end if;
  body=replace(body,'public.retail_products where','public.effective_products() where');execute body;
 end loop;
end $$;

-- A direct RPC cannot bypass the UI's provider quote safety gates.
do $$ declare body text;begin
 body=pg_get_functiondef('public.apply_split_plan(jsonb,text,integer,numeric,numeric)'::regprocedure);
 body=replace(body,'price=off.price;stamp=off.observed_at;', 'if src=''provider'' and (off.environment<>''production'' or off.price_status<>''known'' or off.availability=''out_of_stock'' or off.observed_at<now()-interval ''24 hours'' or off.observed_at>now()+interval ''1 minute'') then raise exception ''Provider price needs confirmation'';end if;price=off.price;stamp=off.observed_at;');execute body;
 body=pg_get_functiondef('public.record_shopping_purchase(uuid,uuid,uuid,timestamptz,uuid,uuid,numeric,text,numeric,text,date,uuid)'::regprocedure);
 body=replace(body,'if p_price_source=''provider'' and offer.is_demo', 'if p_price_source=''provider'' and (offer.environment<>''production'' or offer.price_status<>''known'' or offer.availability=''out_of_stock'' or offer.observed_at<now()-interval ''24 hours'') then raise exception ''Provider price needs confirmation'';end if;if p_price_source=''provider'' and offer.is_demo');execute body;
end $$;

-- Only the authenticated server provider importer receives this privilege; callers cannot mint shared quotes.
create function public.import_kroger_location(p jsonb) returns uuid language plpgsql security definer set search_path='' as $$ declare sid uuid;lid uuid;chain_slug text;begin
 if p->>'providerLocationId' !~ '^\d{1,20}$' or length(p->>'name') not between 1 and 200 or length(p->>'chain') not between 1 and 100 then raise exception 'Invalid provider location';end if;
 chain_slug='kroger-'||lower(regexp_replace(p->>'chain','[^a-zA-Z0-9]+','-','g'));
 insert into public.stores(slug,name) values(chain_slug,p->>'chain') on conflict(slug) do update set name=excluded.name returning id into sid;
 insert into public.store_locations(store_id,name,country_code,currency,postal_code,is_demo,provider,provider_location_id,address,latitude,longitude,retrieved_at)
 values(sid,p->>'name','US','USD',p->>'postalCode',false,'kroger',p->>'providerLocationId',p->>'address',(p#>>'{coordinates,latitude}')::double precision,(p#>>'{coordinates,longitude}')::double precision,(p->>'retrievedAt')::timestamptz)
 on conflict(provider,provider_location_id) where provider is not null do update set name=excluded.name,address=excluded.address,latitude=excluded.latitude,longitude=excluded.longitude,retrieved_at=excluded.retrieved_at returning id into lid;return lid;
end $$;
create function public.import_kroger_products(p_location uuid,p_products jsonb) returns void language plpgsql security definer set search_path='' as $$ declare r jsonb;pid uuid;oid uuid;prov text;stamp timestamptz;loc public.store_locations;begin
 select * into loc from public.store_locations where id=p_location and provider='kroger';if not found or jsonb_typeof(p_products)<>'array' or jsonb_array_length(p_products)>24 then raise exception 'Invalid provider import';end if;
 for r in select value from jsonb_array_elements(p_products) loop
 if r->>'providerLocationId'<>loc.provider_location_id or r->>'provider'<>'kroger' or r->>'environment' not in ('production','certification') then raise exception 'Provider identity mismatch';end if;
 prov=case when r->>'environment'='certification' then 'kroger:certification' else 'kroger' end;stamp=(r->>'retrievedAt')::timestamptz;
 insert into public.retail_products(name,package_amount,package_unit,package_grams,package_label,provider,provider_product_id,provider_item_id,upc,brand,is_demo)
 values(r->>'description',(r->>'packageAmount')::numeric,r->>'packageUnit',(r->>'packageGrams')::numeric,r->>'packageSize',prov,r->>'providerProductId',r->>'providerItemId',r->>'upc',r->>'brand',false)
 on conflict(provider,provider_product_id,provider_item_id) where provider is not null do update set name=excluded.name,package_amount=excluded.package_amount,package_unit=excluded.package_unit,package_grams=excluded.package_grams,package_label=excluded.package_label,upc=excluded.upc,brand=excluded.brand returning id into pid;
 if r->>'effectivePrice' is not null then
  insert into public.store_offers(product_id,location_id,price,currency,observed_at,provider,is_demo,retrieved_at,environment,regular_price,promo_price,availability,price_status,promotion)
  values(pid,loc.id,(r->>'effectivePrice')::numeric,'USD',stamp,prov,false,stamp,r->>'environment',(r->>'regularPrice')::numeric,(r->>'promoPrice')::numeric,r->>'availability','known',case when r->>'promoPrice' is not null then 'Provider promotion' end)
  on conflict(product_id,location_id,provider) do update set price=excluded.price,observed_at=excluded.observed_at,retrieved_at=excluded.retrieved_at,regular_price=excluded.regular_price,promo_price=excluded.promo_price,availability=excluded.availability,price_status='known',promotion=excluded.promotion where public.store_offers.observed_at<=excluded.observed_at returning id into oid;
  if oid is not null then insert into public.price_history(offer_id,price,currency,observed_at,source) values(oid,(r->>'effectivePrice')::numeric,'USD',stamp,prov) on conflict(offer_id,observed_at) do nothing;end if;
 else update public.store_offers set price_status='unavailable',availability=r->>'availability',retrieved_at=stamp where product_id=pid and location_id=loc.id and provider=prov and observed_at<=stamp;
 end if;
 end loop;
end $$;
revoke all on function public.import_kroger_location(jsonb),public.import_kroger_products(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.import_kroger_location(jsonb),public.import_kroger_products(uuid,jsonb) to service_role;
do $$ declare sig text;begin foreach sig in array array['save_location_settings(text,integer,boolean)','confirm_product_match(uuid,uuid,numeric)','effective_products()'] loop execute 'revoke all on function public.'||sig||' from public,anon';execute 'grant execute on function public.'||sig||' to authenticated';end loop;end $$;

-- Reuse private receipt observations for all actual package purchases; sharing is explicit opt-in.
create table public.shared_price_observations(id uuid primary key default gen_random_uuid(),product_id uuid not null references public.retail_products(id),location_id uuid not null references public.store_locations(id),price numeric not null check(price>=0),currency text not null check(currency in ('USD','CAD')),package_grams numeric not null check(package_grams>0),observed_on date not null,source text not null default 'first_party_confirmed' check(source='first_party_confirmed'));
alter table public.shared_price_observations enable row level security;
create policy public_prices_read on public.shared_price_observations for select to authenticated using(true);
revoke all on public.shared_price_observations from public,anon,authenticated;grant select on public.shared_price_observations to authenticated;
alter table public.receipt_price_observations add column shared_id uuid references public.shared_price_observations(id) on delete set null;
create function public.sync_purchase_price(p_line uuid) returns void language plpgsql security definer set search_path='' as $$ declare i public.purchase_items;p public.purchases;o public.receipt_price_observations;shared uuid;begin
 select * into i from public.purchase_items where id=p_line;
 select * into o from public.receipt_price_observations where purchase_item_id=p_line;
 if i.id is null then return;end if;
 select * into p from public.purchases where id=i.purchase_id;
 if i.voided_at is not null or i.price_source='demo' or i.retail_product_id is null or i.unit<>'package' then
  if o.shared_id is not null then delete from public.shared_price_observations where id=o.shared_id;end if;
  delete from public.receipt_price_observations where purchase_item_id=p_line;return;
 end if;
 insert into public.receipt_price_observations(user_id,purchase_item_id,product_id,currency,observed_on) values(i.user_id,i.id,i.retail_product_id,p.currency,p.purchased_on) on conflict(purchase_item_id) do update set currency=excluded.currency,observed_on=excluded.observed_on returning * into o;
 if exists(select 1 from public.location_search_settings where user_id=i.user_id and share_prices) and exists(select 1 from public.store_locations where id=p.store_location_id and not is_demo) and i.quantity_g>0 then
  shared=coalesce(o.shared_id,gen_random_uuid());
  insert into public.shared_price_observations(id,product_id,location_id,price,currency,package_grams,observed_on) values(shared,i.retail_product_id,p.store_location_id,i.unit_price,p.currency,i.quantity_g/i.quantity,p.purchased_on)
  on conflict(id) do update set price=excluded.price,observed_on=excluded.observed_on,currency=excluded.currency,package_grams=excluded.package_grams;
  update public.receipt_price_observations set shared_id=shared where id=o.id;
 elsif o.shared_id is not null then delete from public.shared_price_observations where id=o.shared_id;
 end if;
end $$;
create function public.purchase_price_changed() returns trigger language plpgsql security definer set search_path='' as $$ begin perform public.sync_purchase_price(new.id);return null;end $$;
create trigger purchase_price_observation after insert or update on public.purchase_items for each row execute function public.purchase_price_changed();
create function public.remove_shared_price() returns trigger language plpgsql security definer set search_path='' as $$ begin delete from public.shared_price_observations where id=old.shared_id;return old;end $$;
create trigger remove_shared_price before delete on public.receipt_price_observations for each row execute function public.remove_shared_price();
create function public.stop_price_sharing() returns trigger language plpgsql security definer set search_path='' as $$ begin if not new.share_prices then delete from public.shared_price_observations where id in(select shared_id from public.receipt_price_observations where user_id=new.user_id);end if;return null;end $$;
create trigger stop_price_sharing after update on public.location_search_settings for each row execute function public.stop_price_sharing();
revoke all on function public.sync_purchase_price(uuid),public.purchase_price_changed(),public.remove_shared_price(),public.stop_price_sharing() from public,anon,authenticated;
-- The receipt transaction's existing explicit insert cooperates with the new universal observation trigger.
do $$ declare body text;begin body=pg_get_functiondef('public.confirm_reviewed_receipt(uuid,jsonb,boolean)'::regprocedure);body=replace(body,'values(uid,line,prod,p_review->>''currency'',dt);','values(uid,line,prod,p_review->>''currency'',dt) on conflict(purchase_item_id) do nothing;');execute body;end $$;
