alter table public.shopping_list_items add column replenishment_ack_valid boolean not null default true;
-- Keep fulfilled rows as history; only one generated active requirement per food.
drop index public.generated_shopping_food;
create unique index generated_shopping_food on public.shopping_list_items(list_id,food_id) where source='generated' and fulfillment='needed';
create function public.reconcile_groceries_for(uid uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare today date;lastday date;lid uuid;r record;need numeric;active public.shopping_list_items;ack public.shopping_list_items;ids uuid[]='{}';begin
 select (now() at time zone timezone)::date into today from public.profiles where id=uid for update;
 if not found then return null;end if;
 select id,greatest(today+6,end_date) into lid,lastday from public.shopping_lists where user_id=uid;
 lastday=least(coalesce(lastday,today+6),today+30);
 if lid is null then insert into public.shopping_lists(user_id,start_date,end_date) values(uid,today,lastday) returning id into lid;end if;
 for r in
 with demand as (
  select (i->>'food_id')::uuid food_id,l.local_date,sum((i->>'quantity_g')::numeric) grams
  from public.daily_meal_logs l cross join lateral jsonb_array_elements(l.ingredients)i
  where l.user_id=uid and l.status='planned' and l.local_date between today and lastday group by 1,2
 ), totals as (
  select f.id,f.name,coalesce(sum(d.grams),0) planned,
   coalesce(p.quantity_g,0) stock,p.expires_on,p.low_threshold_g,
   coalesce(sum(case when p.expires_on is null or d.local_date<=p.expires_on then d.grams else 0 end),0) eligible,
   case when p.id is not null and (p.quantity_g<=p.low_threshold_g or p.expires_on<today) then greatest(p.low_threshold_g,coalesce(f.natural_unit_g,n.serving_g,0)) else 0 end reorder
  from public.foods f left join demand d on d.food_id=f.id left join public.pantry_items p on p.food_id=f.id and p.user_id=uid left join public.food_nutrition n on n.food_id=f.id
  where (f.user_id is null or f.user_id=uid) and (d.food_id is not null or p.id is not null)
  group by f.id,p.id,n.serving_g
 ) select *,greatest(planned,reorder) required,
 case when expires_on<today then 0 else least(stock,greatest(eligible,reorder)) end covered from totals
 loop
  ids=array_append(ids,r.id);need=greatest(0,r.required-r.covered);
  select * into active from public.shopping_list_items where list_id=lid and food_id=r.id and source='generated' and fulfillment='needed';
  select * into ack from public.shopping_list_items where list_id=lid and food_id=r.id and fulfillment='already_have' and replenishment_ack_valid order by updated_at desc limit 1;
  if need>0 and ack.id is not null and r.required<=coalesce(ack.required_g,0) and r.covered>=coalesce(ack.pantry_g,0) then need=0;
  elsif ack.id is not null and (r.required>coalesce(ack.required_g,0) or r.covered<coalesce(ack.pantry_g,0)) then update public.shopping_list_items set replenishment_ack_valid=false where id=ack.id;end if;
  -- Explicit manual requirements remain user-owned; don't create a second active row.
  if exists(select 1 from public.shopping_list_items where list_id=lid and food_id=r.id and source='manual' and fulfillment='needed') then need=0;end if;
  if need=0 then
   if active.id is not null then delete from public.shopping_list_items where id=active.id;end if;
  elsif active.id is null then
   insert into public.shopping_list_items(user_id,list_id,food_id,name,required_g,pantry_g,amount,unit,source) values(uid,lid,r.id,r.name,r.required,r.covered,need,'g','generated');
  elsif (active.required_g,active.pantry_g,active.amount) is distinct from (r.required,r.covered,need) then
   update public.shopping_list_items set required_g=r.required,pantry_g=r.covered,amount=need where id=active.id;
  end if;
 end loop;
 delete from public.shopping_list_items where list_id=lid and source='generated' and fulfillment='needed' and not(food_id=any(ids));
 return lid;
end $$;
revoke all on function public.reconcile_groceries_for(uuid) from public,anon,authenticated;
create function public.reconcile_groceries() returns uuid language plpgsql security definer set search_path='' as $$ begin
 if auth.uid() is null then raise exception 'Authentication required';end if;return public.reconcile_groceries_for(auth.uid());end $$;
revoke all on function public.reconcile_groceries() from public,anon;grant execute on function public.reconcile_groceries() to authenticated;
create function public.replenishment_changed() returns trigger language plpgsql security definer set search_path='' as $$ begin
 perform public.reconcile_groceries_for(case when tg_op='DELETE' then old.user_id else new.user_id end);return null;end $$;
revoke all on function public.replenishment_changed() from public,anon,authenticated;
-- Deferred execution sees final stock, meal status and fulfillment from the same transaction.
create constraint trigger replenish_pantry after insert or update or delete on public.pantry_items deferrable initially deferred for each row execute function public.replenishment_changed();
create constraint trigger replenish_meals after insert or update or delete on public.daily_meal_logs deferrable initially deferred for each row execute function public.replenishment_changed();
create constraint trigger replenish_purchases after insert or update or delete on public.shopping_fulfillments deferrable initially deferred for each row execute function public.replenishment_changed();
create or replace function public.refresh_shopping_list(p_start date,p_end date) returns uuid language plpgsql security definer set search_path='' as $$ declare today date;begin
 select (now() at time zone timezone)::date into today from public.profiles where id=auth.uid() for update;
 if auth.uid() is null or p_start is null or p_end is null or p_start<today or p_end<p_start or p_end>today+30 then raise exception 'Choose a shopping period within the next 30 days';end if;
 if exists(select 1 from public.shopping_sessions where user_id=auth.uid() and status='open') then raise exception 'Finish your shopping session before recalculating requirements';end if;
 insert into public.shopping_lists(user_id,start_date,end_date) values(auth.uid(),p_start,p_end) on conflict(user_id) do update set start_date=excluded.start_date,end_date=excluded.end_date;
 return public.reconcile_groceries_for(auth.uid());end $$;

-- If a reversal reactivates an old requirement, retire only its unsatisfied successor.
create function public.merge_reactivated_requirement() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if new.source='generated' and new.fulfillment='needed' and old.fulfillment<>'needed' then
  delete from public.shopping_list_items where list_id=new.list_id and food_id=new.food_id and id<>new.id and source='generated' and fulfillment='needed';
 end if;return new;end $$;
create trigger merge_reactivated_requirement before update of fulfillment on public.shopping_list_items for each row execute function public.merge_reactivated_requirement();
revoke all on function public.merge_reactivated_requirement() from public,anon,authenticated;
