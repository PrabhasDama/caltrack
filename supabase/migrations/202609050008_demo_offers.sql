-- Simulated packages, locations, and prices. Never live retailer observations.
insert into public.stores(slug,name) values('safeway','Safeway'),('whole-foods','Whole Foods'),('loblaws','Loblaws'),('no-frills','No Frills'),('superstore','Real Canadian Superstore'),('metro','Metro'),('sobeys','Sobeys') on conflict(slug) do nothing;
insert into public.store_locations(store_id,name,country_code,currency,is_demo)
select id,name||' · illustrative US location','US','USD',true from public.stores where slug in ('costco','walmart','target','aldi','kroger','safeway','whole-foods');
insert into public.store_locations(store_id,name,country_code,currency,is_demo)
select id,name||' · illustrative Canadian location','CA','CAD',true from public.stores where slug in ('costco','walmart','loblaws','no-frills','superstore','metro','sobeys');
insert into public.retail_products(food_id,name,sku,package_amount,package_unit,package_grams,is_demo)
select f.id,'Demo '||f.name||' package','demo-'||f.id::text,case when f.name='Eggs' then 12 else 1 end,case when f.name='Eggs' then 'piece' else 'kg' end,case when f.name='Eggs' then 600 else 1000 end,true from public.foods f join public.food_nutrition n on n.food_id=f.id;
insert into public.store_offers(product_id,location_id,price,currency,observed_at,provider,promotion,is_demo)
select p.id,l.id,round((case f.category when 'protein' then 8.0 when 'premium-protein' then 18.0 when 'fat' then 9.0 when 'carb' then 3.0 else 4.5 end)*(case l.currency when 'CAD' then 1.4 else 1 end),2),l.currency,'2026-09-05T12:00:00Z','demo',null,true
from public.retail_products p join public.foods f on f.id=p.food_id cross join public.store_locations l join public.stores s on s.id=l.store_id where p.is_demo and l.is_demo and s.slug='walmart';
insert into public.price_history(offer_id,price,currency,observed_at,source)
select o.id,round(o.price*v.factor,2),o.currency,o.observed_at-v.age,'demo' from public.store_offers o cross join (values(interval '21 days',1.10::numeric),(interval '14 days',.95::numeric),(interval '7 days',1.05::numeric),(interval '0 days',1::numeric))v(age,factor) where o.is_demo;
insert into public.deals(offer_id,description,starts_at,ends_at,is_demo) select o.id,'Illustrative promotion · not a real retailer offer','2026-09-01T00:00:00Z','2026-09-08T00:00:00Z',true from public.store_offers o join public.retail_products p on p.id=o.product_id join public.foods f on f.id=p.food_id where f.name='Rice' and o.is_demo;
