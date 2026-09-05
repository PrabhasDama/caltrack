-- Live-project smoke test. Every fixture is rolled back; no user data survives.
begin;
insert into auth.users(id,email) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','caltrack-rls-a@example.invalid'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','caltrack-rls-b@example.invalid');
insert into public.weight_entries(user_id,local_date,weight_kg) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','2026-09-05',80);
insert into public.foods(id,name) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','CalTrack transaction fixture');
insert into public.pantry_items(user_id,food_id,quantity_g) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cccccccc-cccc-4ccc-8ccc-cccccccccccc',100);
insert into public.daily_meal_logs(id,user_id,local_date,slot,name,calories,protein,carbs,fat,fiber,ingredients) values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2026-09-05','Lunch','Fixture meal',400,30,40,10,5,'[{"food_id":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","quantity_g":150}]');
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
set local role authenticated;
do $$ begin
 if (select count(*) from public.profiles)<>1 then raise exception 'Profile isolation failed'; end if;
 if (select count(*) from public.weight_entries)<>0 then raise exception 'Weight isolation failed'; end if;
 begin
  insert into public.weight_entries(user_id,local_date,weight_kg) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','2026-09-06',70);
  raise exception 'Forged owner was accepted';
 exception when insufficient_privilege then null; end;
end $$;
select public.set_meal_status('dddddddd-dddd-4ddd-8ddd-dddddddddddd','completed');
select public.set_meal_status('dddddddd-dddd-4ddd-8ddd-dddddddddddd','completed');
do $$ begin if (select quantity_g from public.pantry_items where food_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc')<>0 then raise exception 'Pantry deduction failed'; end if; if (select count(*) from public.pantry_movements)<>1 then raise exception 'Duplicate consumption'; end if; end $$;
select public.set_meal_status('dddddddd-dddd-4ddd-8ddd-dddddddddddd','planned');
do $$ begin if (select quantity_g from public.pantry_items where food_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc')<>100 then raise exception 'Pantry restoration failed'; end if; end $$;
reset role;
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
set local role authenticated;
do $$ begin
 begin perform public.set_meal_status('dddddddd-dddd-4ddd-8ddd-dddddddddddd','completed');raise exception 'Cross-user meal access allowed';exception when raise_exception then if sqlerrm<>'Meal not found' then raise; end if;end;
end $$;
reset role;
rollback;
select 'PASS: live RLS isolation and atomic meal completion; fixtures rolled back' as result;
