begin;
insert into auth.users(id,email) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','caltrack-phase9-a@example.invalid'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','caltrack-phase9-b@example.invalid');
-- Fixture dates use SQL current_date, independent of the time this suite runs.
update public.profiles set timezone='UTC' where id in ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
insert into public.foods(id,name) values('ffffffff-ffff-4fff-8fff-ffffffffffff','Phase 9 test food');
insert into public.pantry_items(user_id,food_id,quantity_g) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ffffffff-ffff-4fff-8fff-ffffffffffff',200);
insert into public.daily_meal_logs(user_id,local_date,slot,name,calories,protein,carbs,fat,fiber,ingredients) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',current_date,'Lunch','QA',100,10,10,1,1,'[{"food_id":"ffffffff-ffff-4fff-8fff-ffffffffffff","quantity_g":500}]');
set constraints all immediate;set constraints all deferred;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);set local role authenticated;
do $$ declare item public.shopping_list_items;sid uuid='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';begin
 select * into item from public.shopping_list_items where fulfillment='needed';if item.amount<>300 then raise exception 'Low stock reconciliation failed';end if;
 perform public.reconcile_groceries();if (select count(*) from public.shopping_list_items where fulfillment='needed')<>1 then raise exception 'Duplicate active requirement';end if;
 perform public.start_shopping_session(sid,null,null,'Phase 9 shop','USD',current_date);
 perform public.fulfill_shopping_item('dddddddd-dddd-4ddd-8ddd-dddddddddddd',sid,item.id,item.updated_at,null,null,300,'g',.01,'manual',null);
end $$;
set constraints all immediate;set constraints all deferred;
do $$ begin
 if exists(select 1 from public.shopping_list_items where fulfillment='needed') then raise exception 'Bought item remained active';end if;
 if (select quantity_g from public.pantry_items)<>500 then raise exception 'Purchase stock missing';end if;
 if (select total from public.purchases)<>3 then raise exception 'Receipt total incorrect';end if;
end $$;
update public.pantry_items set quantity_g=0;set constraints all immediate;set constraints all deferred;
do $$ begin
 if (select count(*) from public.shopping_list_items where fulfillment='needed')<>1 or (select amount from public.shopping_list_items where fulfillment='needed')<>500 then raise exception 'Depletion did not restore need';end if;
 if (select count(*) from public.shopping_fulfillments)<>1 then raise exception 'Purchase history changed';end if;
end $$;
reset role;select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);set local role authenticated;
do $$ begin
 if exists(select 1 from public.shopping_list_items) or exists(select 1 from public.pantry_items) or exists(select 1 from public.purchases) or exists(select 1 from public.food_waste_events) then raise exception 'Owner data leaked';end if;
end $$;
reset role;
do $$ begin if has_function_privilege('authenticated','public.reconcile_groceries_for(uuid)','execute') or has_function_privilege('anon','public.record_food_waste(uuid,uuid,timestamptz,text)','execute') then raise exception 'Unsafe write privilege';end if;end $$;
rollback;
select 'PASS: automatic replenishment, purchase removal/restock, budget, idempotency and owner isolation; rolled back' as result;
