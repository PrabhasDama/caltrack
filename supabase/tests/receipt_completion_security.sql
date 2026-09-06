begin;
insert into auth.users(id,email) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','caltrack-receipt-a@example.invalid'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','caltrack-receipt-b@example.invalid');
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
set local role authenticated;
insert into public.user_uploads(id,user_id,bucket,path,local_date,status) values('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',auth.uid(),'receipts',auth.uid()::text||'/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee.png',current_date-1,'ready');
do $$ declare f uuid;review jsonb;event uuid; begin
 select id into f from public.foods where user_id is null order by name limit 1;
 review=jsonb_build_object('store','QA reviewed receipt','date',current_date-1,'currency','USD','total',5,'items',jsonb_build_array(jsonb_build_object('name','QA food','quantity',1,'price',5,'foodId',f,'grams',500)));
 perform public.confirm_reviewed_receipt('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',review,true);
 perform public.confirm_reviewed_receipt('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',review,true);
 if (select count(*) from public.purchases)<>1 or (select quantity_g from public.pantry_items where food_id=f)<>500 then raise exception 'Receipt retry duplicated data';end if;
 begin perform public.confirm_reviewed_receipt('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',review,false);raise exception 'Review bypass';exception when raise_exception then if sqlerrm<>'Review and confirm every receipt detail first' then raise;end if;end;
 select id into event from public.shopping_fulfillments;
 perform public.undo_shopping_purchase(event);perform public.undo_shopping_purchase(event);
 if (select total from public.purchases)<>0 or (select quantity_g from public.pantry_items where food_id=f)<>0 then raise exception 'Receipt undo failed';end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.purchases) or exists(select 1 from public.shopping_fulfillments) or exists(select 1 from public.receipt_price_observations) or exists(select 1 from public.meal_completion_events) then raise exception 'Cross-owner data leaked';end if;
 begin perform public.confirm_reviewed_receipt('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','{}',true);raise exception 'Cross-owner receipt accepted';exception when raise_exception then if sqlerrm<>'Receipt image not found' then raise;end if;end;
end $$;
reset role;
do $$ begin
 if has_function_privilege('anon','public.confirm_reviewed_receipt(uuid,jsonb,boolean)','execute') or has_table_privilege('authenticated','public.meal_completion_events','insert') or has_table_privilege('authenticated','public.receipt_price_observations','insert') then raise exception 'Unexpected direct mutation grant';end if;
end $$;
rollback;
select 'PASS: reviewed receipt retry, reversal, review boundary and owner isolation; fixtures rolled back' as result;
