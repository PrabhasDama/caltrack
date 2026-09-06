-- User-reviewed labels create private foods; shared reference foods retain null ownership.
alter table public.foods add column user_id uuid references public.profiles(id) on delete cascade, add column reviewed_label jsonb;
alter table public.foods drop constraint foods_name_key;
create unique index shared_food_name on public.foods(name) where user_id is null;
create index private_food_owner on public.foods(user_id) where user_id is not null;
drop policy read_foods on public.foods;
create policy visible_foods on public.foods for select to authenticated using(user_id is null or user_id=(select auth.uid()));
alter table public.food_nutrition add column sugar numeric check(sugar between 0 and 100),add column sodium numeric check(sodium>=0);
drop policy catalog_read on public.food_nutrition;
create policy visible_food_nutrition on public.food_nutrition for select to authenticated using(exists(select 1 from public.foods f where f.id=food_id and (f.user_id is null or f.user_id=(select auth.uid()))));

-- Existing definer RPCs may receive guessed IDs. Enforce private-food ownership at every private reference write.
create function public.guard_private_food_reference() returns trigger language plpgsql security definer set search_path='' as $$
declare fid uuid;begin
 if tg_table_name='daily_meal_logs' then
  for fid in select (v->>'food_id')::uuid from jsonb_array_elements(new.ingredients) v loop
   if exists(select 1 from public.foods where id=fid and user_id is not null and user_id<>new.user_id) then raise exception 'Food is not available to this account';end if;
  end loop;
 else
  if exists(select 1 from public.foods where id=new.food_id and user_id is not null and user_id<>new.user_id) then raise exception 'Food is not available to this account';end if;
 end if;return new;
end $$;
revoke all on function public.guard_private_food_reference() from public,anon,authenticated;
do $$ declare t text;begin foreach t in array array['daily_meal_logs','pantry_items','purchase_items','shopping_list_items','pantry_movements','shopping_fulfillments'] loop execute format('create trigger private_food_guard before insert or update on public.%I for each row execute function public.guard_private_food_reference()',t);end loop;end $$;

create function public.save_reviewed_label(p_upload uuid,p_review jsonb,p_confirmed boolean) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid=auth.uid(); grams numeric; factor numeric; title text; serving numeric; u text;
begin
 if uid is null or p_confirmed is distinct from true or jsonb_typeof(p_review) is distinct from 'object' then raise exception 'Review and confirm the label before saving';end if;
 perform 1 from public.profiles where id=uid for update;
 if not exists(select 1 from public.user_uploads where id=p_upload and user_id=uid and bucket='nutrition-labels' and status='ready') then raise exception 'Label image not found';end if;
 if exists(select 1 from public.foods where id=p_upload and user_id=uid) then return p_upload;end if;
 grams=(p_review->>'servingGrams')::numeric;serving=(p_review->>'servingSize')::numeric;u=btrim(p_review->>'servingUnit');title=btrim(p_review->>'name');
 if grams is null or grams not between .001 and 10000 or serving is null or serving not between .001 and 10000 or char_length(title) not between 1 and 120 or title is null or u is null or char_length(u) not between 1 and 30 then raise exception 'Enter the food name, serving and its known gram weight';end if;
 if (lower(u)='g' and grams<>serving) or (lower(u)='kg' and grams<>serving*1000) then raise exception 'Serving weight does not match the label';end if;
 if p_review->>'servingsPerContainer' is not null and (p_review->>'servingsPerContainer')::numeric not between .001 and 10000 then raise exception 'Invalid servings per container';end if;
 factor=100/grams;
 insert into public.foods(id,user_id,name,category,preparation,reviewed_label) values(p_upload,uid,title,'staple','As described on your reviewed label',p_review);
 insert into public.food_nutrition(food_id,calories,protein,carbs,fat,fiber,serving_g,source,sugar,sodium)
 values(p_upload,(p_review->>'calories')::numeric*factor,(p_review->>'protein')::numeric*factor,(p_review->>'carbs')::numeric*factor,(p_review->>'fat')::numeric*factor,(p_review->>'fiber')::numeric*factor,grams,'User-reviewed label · manually entered',(p_review->>'sugar')::numeric*factor,(p_review->>'sodium')::numeric*factor);
 return p_upload;
end $$;
revoke all on function public.save_reviewed_label(uuid,jsonb,boolean) from public,anon;
grant execute on function public.save_reviewed_label(uuid,jsonb,boolean) to authenticated;
