-- Live verification: all test users, plans and purchases are rolled back.
begin;
insert into auth.users(id,email) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','caltrack-rls-a@example.invalid'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','caltrack-rls-b@example.invalid');
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
set local role authenticated;
do $$ declare template uuid;ingredients jsonb;meal jsonb;purchase jsonb;items jsonb;dt date;
begin
 select id into template from public.meals where slug='yogurt-oats';
 select jsonb_agg(jsonb_build_object('food_id',food_id,'quantity_g',quantity_g)) into ingredients from public.meal_items where meal_id=template;
 select (now() at time zone timezone)::date into dt from public.profiles where id=auth.uid();
 meal=jsonb_build_object('template_id',template,'slot','Breakfast','ingredients',ingredients);
 perform public.save_meal_plan(jsonb_build_array(jsonb_build_object('date',dt,'meals',jsonb_build_array(meal,meal))),0);
 perform public.refresh_shopping_list(dt,dt);
 if (select count(*) from public.meal_plan_days)<>1 or (select count(*) from public.shopping_list_items)=0 then raise exception 'Plan or shopping persistence failed';end if;
 purchase=jsonb_build_object('id','cccccccc-cccc-4ccc-8ccc-cccccccccccc','store_name','QA receipt','purchased_on',dt,'currency','CAD','total',7);
 items='[{"name":"Manual item","quantity":2,"unit":"package","unit_price":3.5}]'::jsonb;
 perform public.save_purchase(purchase,items);perform public.save_purchase(purchase,items);
 if (select count(*) from public.purchases)<>1 or (select total from public.purchase_months())<>7 then raise exception 'Duplicate receipt or wrong total';end if;
 begin update public.store_offers set price=0;raise exception 'Catalog write accepted';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
set local role authenticated;
do $$ declare t text;n integer;begin
 foreach t in array array['meal_plans','meal_plan_days','meal_plan_entries','shopping_lists','shopping_list_items','purchases','purchase_items'] loop execute format('select count(*) from public.%I',t) into n;if n<>0 then raise exception 'Cross-user data visible in %',t;end if;end loop;
 if exists(select 1 from public.purchase_months()) then raise exception 'Cross-user monthly total visible';end if;
end $$;
reset role;
do $$ begin
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity) then raise exception 'Public table missing RLS';end if;
 if has_function_privilege('anon','public.save_purchase(jsonb,jsonb)','execute') or has_function_privilege('anon','public.save_meal_plan(jsonb,integer)','execute') then raise exception 'Anonymous write RPC allowed';end if;
end $$;
rollback;
select 'PASS: Phase 4-6 persistence, idempotency, private RLS and read-only pricing; all fixtures rolled back' as result;
