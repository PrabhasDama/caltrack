begin;
insert into auth.users(id,email) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','caltrack-provider-a@example.invalid'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','caltrack-provider-b@example.invalid');
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);set local role authenticated;
select public.save_location_settings('90815',15,false);
insert into public.location_preferences(user_id,location_id,state) select auth.uid(),id,'selected' from public.store_locations limit 1;
reset role;select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);set local role authenticated;
do $$ begin if exists(select 1 from public.location_preferences) or exists(select 1 from public.location_search_settings) or exists(select 1 from public.product_food_matches) or exists(select 1 from public.receipt_price_observations) then raise exception 'Private provider data leaked';end if;end $$;
reset role;
do $$ begin
 if has_function_privilege('authenticated','public.import_kroger_location(jsonb)','execute') or has_function_privilege('authenticated','public.import_kroger_products(uuid,jsonb)','execute') or has_function_privilege('anon','public.effective_products()','execute') or has_function_privilege('authenticated','public.sync_purchase_price(uuid)','execute') then raise exception 'Unsafe provider write access';end if;
 if has_table_privilege('authenticated','public.shared_price_observations','insert') or has_table_privilege('authenticated','public.product_food_matches','update') then raise exception 'Direct shared/match writes exposed';end if;
 if exists(select 1 from information_schema.columns where table_schema='public' and table_name='shared_price_observations' and column_name in ('user_id','purchase_item_id','receipt_id','image','email')) then raise exception 'Shared price contains private columns';end if;
 if exists(select 1 from pg_class where relname in ('location_preferences','location_search_settings','product_food_matches','shared_price_observations') and not relrowsecurity) then raise exception 'RLS disabled';end if;
end $$;
rollback;
select 'PASS: provider imports restricted to server, owner-scoped preferences/matches, minimal shared prices; rolled back' as result;
