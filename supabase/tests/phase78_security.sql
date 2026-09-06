begin;
insert into auth.users(id,email) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','caltrack-phase78-a@example.invalid'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','caltrack-phase78-b@example.invalid');
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
set local role authenticated;
insert into public.body_measurements(user_id,local_date,waist) values(auth.uid(),current_date,80);
insert into public.user_uploads(id,user_id,bucket,path,local_date,status) values('dddddddd-dddd-4ddd-8ddd-dddddddddddd',auth.uid(),'nutrition-labels',auth.uid()::text||'/dddddddd-dddd-4ddd-8ddd-dddddddddddd.png',current_date,'ready');
select public.save_reviewed_label('dddddddd-dddd-4ddd-8ddd-dddddddddddd','{"name":"Private label fixture","servingSize":40,"servingUnit":"g","servingGrams":40,"calories":160,"protein":8,"carbs":20,"fat":5,"fiber":3}',true);
select public.save_reviewed_label('dddddddd-dddd-4ddd-8ddd-dddddddddddd','{}',true);
do $$ begin
 if (select calories from public.food_nutrition where food_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd')<>400 then raise exception 'Canonical nutrition failed';end if;
 if (select count(*) from public.foods where user_id=auth.uid())<>1 then raise exception 'Duplicate label save';end if;
 begin perform public.save_reviewed_label('dddddddd-dddd-4ddd-8ddd-dddddddddddd','{}',false);raise exception 'Review bypass';exception when raise_exception then if sqlerrm<>'Review and confirm the label before saving' then raise;end if;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.body_measurements) or exists(select 1 from public.user_uploads) or exists(select 1 from public.foods where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd') or exists(select 1 from public.food_nutrition where food_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd') then raise exception 'Private data leaked';end if;
 begin insert into public.pantry_items(user_id,food_id,quantity_g) values(auth.uid(),'dddddddd-dddd-4ddd-8ddd-dddddddddddd',100);raise exception 'Cross-owner food accepted';exception when raise_exception then if sqlerrm<>'Food is not available to this account' then raise;end if;end;
 begin insert into storage.objects(bucket_id,name) values('progress-photos','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/forged.png');raise exception 'Cross-owner storage accepted';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$ begin
 if (select count(*) from storage.buckets where id in ('progress-photos','receipts','nutrition-labels') and not public and file_size_limit=6291456)<>3 then raise exception 'Private buckets not configured';end if;
 if has_function_privilege('anon','public.save_reviewed_label(uuid,jsonb,boolean)','execute') then raise exception 'Anonymous label write allowed';end if;
 if not exists(select 1 from pg_policies where schemaname='storage' and policyname='caltrack_private_read') then raise exception 'Storage read policy missing';end if;
end $$;
rollback;
select 'PASS: private buckets, measurements, label review/idempotency, and owner isolation; fixtures rolled back' as result;
