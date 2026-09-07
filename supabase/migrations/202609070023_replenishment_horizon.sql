-- Correct explicit shopping dates; allocate earlier planned consumption before a future shopping horizon.
create or replace function public.reconcile_groceries_for(uid uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare today date;firstday date;lastday date;lid uuid;r record;need numeric;active public.shopping_list_items;ack public.shopping_list_items;ids uuid[]='{}';begin
 select (now() at time zone timezone)::date into today from public.profiles where id=uid for update;
 if not found then return null;end if;
 select id,start_date,end_date into lid,firstday,lastday from public.shopping_lists where user_id=uid;
 if lastday is null or lastday<today then firstday=today;lastday=today+6;end if;
 firstday=greatest(today,firstday);lastday=least(lastday,today+30);
 if lid is not null then update public.shopping_lists set start_date=firstday,end_date=lastday where id=lid and (start_date,end_date) is distinct from (firstday,lastday);end if;
 if lid is null then insert into public.shopping_lists(user_id,start_date,end_date) values(uid,firstday,lastday) returning id into lid;end if;
 for r in
 with demand as (
  select (i->>'food_id')::uuid food_id,l.local_date,sum((i->>'quantity_g')::numeric) grams
  from public.daily_meal_logs l cross join lateral jsonb_array_elements(l.ingredients)i
  where l.user_id=uid and l.status='planned' and l.local_date between today and lastday group by 1,2
 ), totals as (
  select f.id,f.name,coalesce(sum(d.grams) filter(where d.local_date>=firstday),0) planned,
   coalesce(p.quantity_g,0) stock,p.expires_on,p.low_threshold_g,
   coalesce(sum(case when d.local_date>=firstday and (p.expires_on is null or d.local_date<=p.expires_on) then d.grams else 0 end),0) eligible,
   coalesce(sum(case when d.local_date<firstday and (p.expires_on is null or d.local_date<=p.expires_on) then d.grams else 0 end),0) before_g,
   case when p.id is not null and (p.quantity_g<=p.low_threshold_g or p.expires_on<today) then greatest(p.low_threshold_g,coalesce(f.natural_unit_g,n.serving_g,0)) else 0 end reorder
  from public.foods f left join demand d on d.food_id=f.id left join public.pantry_items p on p.food_id=f.id and p.user_id=uid left join public.food_nutrition n on n.food_id=f.id
  where (f.user_id is null or f.user_id=uid) and (d.food_id is not null or p.id is not null)
  group by f.id,p.id,n.serving_g
 ) select *,greatest(planned,reorder) required,
 case when expires_on<firstday then 0 else least(greatest(stock-before_g,0),greatest(eligible,reorder)) end covered from totals
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
