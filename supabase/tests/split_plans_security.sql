-- Disposable fixtures and assertions; every write is rolled back.
begin;
insert into auth.users(id,email) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','caltrack-split-a@example.invalid'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','caltrack-split-b@example.invalid');
update public.profiles set timezone='UTC' where id in ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
insert into public.foods(id,name) values('11111111-1111-4111-8111-111111111111','Split A'),('22222222-2222-4222-8222-222222222222','Split B');
insert into public.retail_products(id,food_id,name,package_amount,package_unit,package_grams,is_demo) values
 ('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','Split small',400,'g',400,true),
 ('44444444-4444-4444-8444-444444444444','22222222-2222-4222-8222-222222222222','Split large',600,'g',600,true);
insert into public.store_locations(id,store_id,name,country_code,currency,is_demo) values
 ('55555555-5555-4555-8555-555555555555',(select id from public.stores where slug='costco'),'QA Costco','US','USD',true),
 ('66666666-6666-4666-8666-666666666666',(select id from public.stores where slug='walmart'),'QA Walmart','US','USD',true);
insert into public.store_offers(id,product_id,location_id,price,currency,observed_at,provider,is_demo) values
 ('77777777-7777-4777-8777-777777777777','33333333-3333-4333-8333-333333333333','55555555-5555-4555-8555-555555555555',3,'USD',now(),'demo',true),
 ('88888888-8888-4888-8888-888888888888','44444444-4444-4444-8444-444444444444','66666666-6666-4666-8666-666666666666',5,'USD',now(),'demo',true);
insert into public.daily_meal_logs(user_id,local_date,slot,name,calories,protein,carbs,fat,fiber,ingredients) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',current_date,'Lunch','Split fixture',100,10,10,2,1,'[{"food_id":"11111111-1111-4111-8111-111111111111","quantity_g":300},{"food_id":"22222222-2222-4222-8222-222222222222","quantity_g":500}]');
set constraints all immediate;set constraints all deferred;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);set local role authenticated;
do $$ declare lines jsonb;pid uuid;begin
 select jsonb_agg(jsonb_build_object('item',i.id,'expected',i.updated_at,'product',p.id,'location',o.location_id,'count',1,'price',o.price,'source','demo','reference',o.id)) into lines from public.shopping_list_items i join public.retail_products p on p.food_id=i.food_id join public.store_offers o on o.product_id=p.id where i.fulfillment='needed';
 pid=public.apply_split_plan(lines,'USD',2,0,12);
 perform set_config('qa.split',pid::text,true);perform set_config('qa.lines',lines::text,true);
 if public.apply_split_plan(lines,'USD',2,0,12)<>pid then raise exception 'Duplicate application';end if;
 if (select count(*) from public.split_plans)<>1 or (select count(*) from public.split_assignments)<>2 or (select count(*) from public.shopping_list_items)<>2 then raise exception 'Plan cardinality incorrect';end if;
 if exists(select 1 from public.purchase_items) or exists(select 1 from public.purchases) or exists(select 1 from public.pantry_items where quantity_g>0) then raise exception 'Applying changed stock/spending';end if;
end $$;
-- A different owner cannot read, apply, abandon, start, or purchase this plan.
reset role;select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);set local role authenticated;
do $$ declare blocked boolean=false;begin
 if exists(select 1 from public.split_plans) or exists(select 1 from public.split_assignments) then raise exception 'Split owner data leaked';end if;
 begin perform public.apply_split_plan(current_setting('qa.lines')::jsonb,'USD',2,0,12);exception when others then blocked=true;end;if not blocked then raise exception 'Cross-user apply allowed';end if;
 blocked=false;begin perform public.abandon_split_plan(current_setting('qa.split')::uuid);exception when others then blocked=true;end;if not blocked then raise exception 'Cross-user abandon allowed';end if;
 blocked=false;begin perform public.start_split_store(current_setting('qa.split')::uuid,'55555555-5555-4555-8555-555555555555',gen_random_uuid(),current_date);exception when others then blocked=true;end;if not blocked then raise exception 'Cross-user store start allowed';end if;
end $$;
reset role;select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);set local role authenticated;
do $$ declare a public.split_assignments;b public.split_assignments;s uuid=gen_random_uuid();ev uuid=gen_random_uuid();blocked boolean=false;begin
 select * into a from public.split_assignments where location_id='55555555-5555-4555-8555-555555555555';select * into b from public.split_assignments where id<>a.id;
 perform set_config('qa.assignment',a.id::text,true);perform set_config('qa.session',s::text,true);perform set_config('qa.event',ev::text,true);
 perform public.start_split_store(a.plan_id,a.location_id,s,current_date);
 begin perform public.purchase_split_assignment(b.id,gen_random_uuid(),s,(select updated_at from public.shopping_list_items where id=b.item_id),b.product_id,1,'package',7,null);exception when others then blocked=true;end;if not blocked then raise exception 'Wrong-store purchase allowed';end if;
 perform public.purchase_split_assignment(a.id,ev,s,(select updated_at from public.shopping_list_items where id=a.item_id),a.product_id,1,'package',4,null);
 perform public.purchase_split_assignment(a.id,ev,s,now(),a.product_id,1,'package',4,null);
end $$;
set constraints all immediate;set constraints all deferred;
do $$ begin
 if (select status from public.split_plans)<>'partial' or (select count(*) from public.split_assignments where state='pending')<>1 then raise exception 'Partial state incorrect';end if;
 if (select count(*) from public.shopping_list_items where fulfillment='needed')<>1 or (select quantity_g from public.pantry_items where food_id='11111111-1111-4111-8111-111111111111')<>400 or (select sum(total) from public.purchases)<>4 or (select count(*) from public.purchase_items)<>1 then raise exception 'Partial stock/spending/needs incorrect';end if;
end $$;
reset role;select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);set local role authenticated;
do $$ declare blocked boolean=false;begin
 begin perform public.purchase_split_assignment(current_setting('qa.assignment')::uuid,gen_random_uuid(),current_setting('qa.session')::uuid,now(),null,300,'g',1,null);exception when others then blocked=true;end;if not blocked then raise exception 'Cross-user purchase allowed';end if;
 blocked=false;begin update public.split_assignments set state='purchased';exception when insufficient_privilege then blocked=true;end;if not blocked then raise exception 'Direct assignment writes allowed';end if;
 if exists(select 1 from public.purchases) or exists(select 1 from public.shopping_fulfillments) or exists(select 1 from public.pantry_items) then raise exception 'Purchase owner data leaked';end if;
end $$;
reset role;select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);set local role authenticated;
do $$ declare a public.split_assignments;s uuid=gen_random_uuid();begin
 perform public.finish_shopping_session(current_setting('qa.session')::uuid);
 select * into a from public.split_assignments where state='pending';
 perform public.start_split_store(a.plan_id,a.location_id,s,current_date);
 perform public.purchase_split_assignment(a.id,gen_random_uuid(),s,(select updated_at from public.shopping_list_items where id=a.item_id),a.product_id,1,'package',7,null);
 perform public.finish_shopping_session(s);
 perform public.correct_shopping_purchase(current_setting('qa.event')::uuid,6);
end $$;
set constraints all immediate;set constraints all deferred;
do $$ begin
 if (select status from public.split_plans)<>'completed' or (select expected_total from public.split_plans)<>8 then raise exception 'Completion/provenance incorrect';end if;
 if exists(select 1 from public.shopping_list_items where fulfillment='needed') or (select sum(quantity_g) from public.pantry_items)<>1000 or (select sum(total) from public.purchases)<>13 or (select count(*) from public.purchase_items)<>2 then raise exception 'Final stock/spending/needs incorrect';end if;
end $$;
reset role;
do $$ declare sig text;begin
 if has_function_privilege('authenticated','public.record_shopping_purchase(uuid,uuid,uuid,timestamptz,uuid,uuid,numeric,text,numeric,text,date,uuid)','execute') or has_function_privilege('authenticated','public.reconcile_splits_for(uuid)','execute') then raise exception 'Private split entry point exposed';end if;
 foreach sig in array array['sync_split_plans()','apply_split_plan(jsonb,text,integer,numeric,numeric)','abandon_split_plan(uuid)','start_split_store(uuid,uuid,uuid,date)','purchase_split_assignment(uuid,uuid,uuid,timestamptz,uuid,numeric,text,numeric,date)'] loop
  if has_function_privilege('anon','public.'||sig,'execute') then raise exception 'Anonymous split action exposed';end if;
 end loop;
 if exists(select 1 from pg_class where relname in ('split_plans','split_assignments') and not relrowsecurity) then raise exception 'Split RLS disabled';end if;
end $$;
rollback;
select 'PASS: split apply/retry, separate stores, actual prices, stock/spending, RLS and private/anonymous privilege gates; rolled back' as result;
