-- Phase 6. Foods are independent of packages, offers, observations, and purchases.
alter table public.budgets drop constraint budgets_currency_check;
alter table public.budgets add constraint budgets_currency_check check(currency in ('USD','CAD'));
create table public.store_locations(id uuid primary key default gen_random_uuid(),store_id uuid not null references public.stores(id),name text not null,country_code text not null check(country_code in ('US','CA')),currency text not null check(currency in ('USD','CAD')),postal_code text,is_demo boolean not null default false,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(id,currency),unique(store_id,name,country_code));
create table public.retail_products(id uuid primary key default gen_random_uuid(),food_id uuid references public.foods(id),name text not null,sku text unique,package_amount numeric not null check(package_amount>0),package_unit text not null check(package_unit in ('g','kg','oz','lb','piece','ml','l')),package_grams numeric check(package_grams>0),is_demo boolean not null default false,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.store_offers(id uuid primary key default gen_random_uuid(),product_id uuid not null references public.retail_products(id),location_id uuid not null,price numeric(12,2) not null check(price>=0),currency text not null,observed_at timestamptz not null,provider text not null,source_url text,promotion text,is_demo boolean not null default false,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),foreign key(location_id,currency) references public.store_locations(id,currency),unique(product_id,location_id,provider),unique(id,currency));
create table public.price_history(id uuid primary key default gen_random_uuid(),offer_id uuid not null,price numeric(12,2) not null check(price>=0),currency text not null,observed_at timestamptz not null,source text not null,created_at timestamptz not null default now(),foreign key(offer_id,currency) references public.store_offers(id,currency) on delete cascade,unique(offer_id,observed_at));
create table public.deals(id uuid primary key default gen_random_uuid(),offer_id uuid not null references public.store_offers(id) on delete cascade,description text not null,starts_at timestamptz not null,ends_at timestamptz not null check(ends_at>starts_at),is_demo boolean not null default false,created_at timestamptz not null default now());
create table public.purchases(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,store_id uuid references public.stores(id),store_name text not null check(char_length(store_name) between 1 and 120),purchased_on date not null,currency text not null check(currency in ('USD','CAD')),total numeric(12,2) not null check(total>=0 and total<=1000000),notes text not null default '' check(char_length(notes)<=2000),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(id,user_id));
create table public.purchase_items(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,purchase_id uuid not null,food_id uuid references public.foods(id),retail_product_id uuid references public.retail_products(id),name text not null check(char_length(name) between 1 and 120),quantity numeric not null check(quantity>0 and quantity<=1000000),unit text not null check(unit in ('g','kg','oz','lb','piece','serving','package')),unit_price numeric(12,2) not null check(unit_price>=0 and unit_price<=1000000),created_at timestamptz not null default now(),foreign key(purchase_id,user_id) references public.purchases(id,user_id) on delete cascade);
create index purchases_user_date on public.purchases(user_id,purchased_on desc);
create index purchase_items_purchase on public.purchase_items(purchase_id,user_id);
create index purchase_items_food on public.purchase_items(food_id);
create index purchase_items_product on public.purchase_items(retail_product_id);
create index purchases_store on public.purchases(store_id);
create index products_food on public.retail_products(food_id);
create index offers_location on public.store_offers(location_id,currency);
create index deals_offer on public.deals(offer_id);
do $$ declare t text;begin
 foreach t in array array['store_locations','retail_products','store_offers','price_history','deals'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('create policy pricing_catalog_read on public.%I for select to authenticated using(true)',t);
 end loop;
 foreach t in array array['purchases','purchase_items'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy own_purchase on public.%I for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()))',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant select,delete on public.%I to authenticated',t);
 end loop;
 foreach t in array array['store_locations','retail_products','store_offers','purchases'] loop execute format('create trigger touch_updated before update on public.%I for each row execute function public.touch_updated_at()',t);end loop;
end $$;
revoke delete on public.purchase_items from authenticated;
create function public.save_purchase(p_purchase jsonb,p_items jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid=auth.uid();pid uuid=(p_purchase->>'id')::uuid;existing public.purchases;storelabel text;it jsonb;subtotal numeric;today date;
begin
 if uid is null or pid is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 100 then raise exception 'Invalid purchase';end if;
 select (now() at time zone timezone)::date into today from public.profiles where id=uid for update;
 select * into existing from public.purchases where id=pid;
 if found then
  if existing.user_id<>uid then raise exception 'Purchase not found';end if;
  -- A repeated create request returns the same purchase without double spending.
  if nullif(p_purchase->>'updated_at','') is null then return pid;end if;
  if existing.updated_at<>(p_purchase->>'updated_at')::timestamptz then raise exception 'Purchase changed. Reload before editing.';end if;
 end if;
 if (p_purchase->>'purchased_on')::date>today then raise exception 'Purchase date cannot be in the future';end if;
 if nullif(p_purchase->>'store_id','') is not null then select name into storelabel from public.stores where id=(p_purchase->>'store_id')::uuid;else storelabel=p_purchase->>'store_name';end if;
 select sum(round((i->>'quantity')::numeric*(i->>'unit_price')::numeric,2)) into subtotal from jsonb_array_elements(p_items)i;
 if subtotal>(p_purchase->>'total')::numeric+.01 then raise exception 'Total is below item subtotal';end if;
 insert into public.purchases(id,user_id,store_id,store_name,purchased_on,currency,total,notes) values(pid,uid,nullif(p_purchase->>'store_id','')::uuid,storelabel,(p_purchase->>'purchased_on')::date,p_purchase->>'currency',(p_purchase->>'total')::numeric,coalesce(p_purchase->>'notes','')) on conflict(id) do update set store_id=excluded.store_id,store_name=excluded.store_name,purchased_on=excluded.purchased_on,currency=excluded.currency,total=excluded.total,notes=excluded.notes;
 delete from public.purchase_items where purchase_id=pid;
 for it in select * from jsonb_array_elements(p_items) loop
  if nullif(it->>'retail_product_id','') is not null and nullif(it->>'food_id','') is not null and not exists(select 1 from public.retail_products where id=(it->>'retail_product_id')::uuid and food_id=(it->>'food_id')::uuid) then raise exception 'Product and food do not match';end if;
  insert into public.purchase_items(user_id,purchase_id,food_id,retail_product_id,name,quantity,unit,unit_price) values(uid,pid,nullif(it->>'food_id','')::uuid,nullif(it->>'retail_product_id','')::uuid,it->>'name',(it->>'quantity')::numeric,it->>'unit',(it->>'unit_price')::numeric);
 end loop;
 return pid;
end $$;
revoke all on function public.save_purchase(jsonb,jsonb) from public,anon;
grant execute on function public.save_purchase(jsonb,jsonb) to authenticated;
create function public.purchase_months() returns table(month text,currency text,total numeric,purchase_count bigint,shopping_days bigint) language sql stable security invoker set search_path='' as $$
 select to_char(p.purchased_on,'YYYY-MM'),p.currency,sum(p.total),count(*),count(distinct p.purchased_on) from public.purchases p where p.user_id=auth.uid() group by 1,2 order by 1 desc;
$$;
revoke all on function public.purchase_months() from public,anon;
grant execute on function public.purchase_months() to authenticated;
