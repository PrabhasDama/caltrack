alter table public.pantry_items add column display_unit text not null default 'g' check(display_unit in ('g','kg','oz','lb','piece','serving')),add column purchased_on date,add column expires_on date,add constraint pantry_dates_check check(purchased_on is null or expires_on is null or expires_on>=purchased_on);
create table public.shopping_lists(id uuid primary key default gen_random_uuid(),user_id uuid not null unique references public.profiles(id) on delete cascade,start_date date not null,end_date date not null check(end_date>=start_date and end_date<=start_date+30),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(id,user_id));
create table public.shopping_list_items(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,list_id uuid not null,food_id uuid references public.foods(id),name text not null check(char_length(name) between 1 and 120),required_g numeric check(required_g>=0),pantry_g numeric check(pantry_g>=0),amount numeric not null check(amount>=0 and amount<=1000000),unit text not null check(unit in ('g','kg','oz','lb','piece','serving')),source text not null check(source in ('generated','manual')),purchased boolean not null default false,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),foreign key(list_id,user_id) references public.shopping_lists(id,user_id) on delete cascade,check(source<>'generated' or (food_id is not null and unit='g')));
create unique index generated_shopping_food on public.shopping_list_items(list_id,food_id) where source='generated';
create index shopping_list_items_owner on public.shopping_list_items(user_id,list_id);
create index shopping_list_items_food on public.shopping_list_items(food_id);
do $$ declare t text;begin foreach t in array array['shopping_lists','shopping_list_items'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy own_shopping on public.%I for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()))',t);
 execute format('grant select,insert,update,delete on public.%I to authenticated',t);
 execute format('create trigger touch_updated before update on public.%I for each row execute function public.touch_updated_at()',t);
 end loop;end $$;
create function public.refresh_shopping_list(p_start date,p_end date) returns uuid language plpgsql security invoker set search_path='' as $$
declare uid uuid=auth.uid();lid uuid;today date;r record;fresh_ids uuid[]='{}';
begin
 select (now() at time zone timezone)::date into today from public.profiles where id=uid;
 if uid is null or p_start is null or p_end is null or p_start<today or p_end>today+30 or p_end<p_start then raise exception 'Choose a shopping period within the next 30 days';end if;
 insert into public.shopping_lists(user_id,start_date,end_date) values(uid,p_start,p_end) on conflict(user_id) do update set start_date=excluded.start_date,end_date=excluded.end_date returning id into lid;
 -- The list row serializes recalculation. Generated quantities are a dated snapshot.
 for r in
 select f.id food_id,f.name,sum((i->>'quantity_g')::numeric) required_g,coalesce(max(case when p.expires_on is null or p.expires_on>=p_end then p.quantity_g else 0 end),0) pantry_g
 from public.daily_meal_logs l cross join lateral jsonb_array_elements(l.ingredients)i join public.foods f on f.id=(i->>'food_id')::uuid left join public.pantry_items p on p.food_id=f.id and p.user_id=uid
 where l.user_id=uid and l.local_date between p_start and p_end and l.status='planned' group by f.id,f.name
 loop
  fresh_ids=array_append(fresh_ids,r.food_id);
  insert into public.shopping_list_items(user_id,list_id,food_id,name,required_g,pantry_g,amount,unit,source)
  values(uid,lid,r.food_id,r.name,r.required_g,r.pantry_g,greatest(0,r.required_g-r.pantry_g),'g','generated')
  on conflict(list_id,food_id) where source='generated' do update set name=excluded.name,required_g=excluded.required_g,pantry_g=excluded.pantry_g,amount=excluded.amount,purchased=case when excluded.amount>public.shopping_list_items.amount then false else public.shopping_list_items.purchased end;
 end loop;
 delete from public.shopping_list_items where list_id=lid and source='generated' and not(food_id=any(fresh_ids));
 return lid;
end $$;
revoke all on function public.refresh_shopping_list(date,date) from public,anon;
grant execute on function public.refresh_shopping_list(date,date) to authenticated;

-- Preserve the tested ledger transaction, excluding stock expired before the meal date.
create or replace function public.set_meal_status(p_meal_id uuid,p_status text) returns void
language plpgsql security definer set search_path='' as $$
declare m public.daily_meal_logs; ingredient record; stock numeric; used numeric;
begin
 if auth.uid() is null or p_status not in ('planned','completed','skipped','deleted') then raise exception 'Invalid request'; end if;
 select * into m from public.daily_meal_logs where id=p_meal_id and user_id=auth.uid() for update;
 if not found then raise exception 'Meal not found'; end if;
 if m.status=p_status then return; end if;
 -- Restore only the amount actually deducted on the prior completion.
 if m.status='completed' then
  for ingredient in select * from public.pantry_movements where daily_meal_log_id=m.id order by food_id loop
   insert into public.pantry_items(user_id,food_id,quantity_g) values(auth.uid(),ingredient.food_id,ingredient.quantity_g)
   on conflict(user_id,food_id) do update set quantity_g=public.pantry_items.quantity_g+excluded.quantity_g;
  end loop;
  delete from public.pantry_movements where daily_meal_log_id=m.id;
 end if;
 if p_status='completed' then
  -- Group repeated foods and lock in consistent order to prevent deadlocks.
  for ingredient in select (x->>'food_id')::uuid as food_id,sum((x->>'quantity_g')::numeric) as quantity_g from jsonb_array_elements(m.ingredients) x group by 1 order by 1 loop
   if ingredient.quantity_g is null or ingredient.quantity_g<=0 or ingredient.quantity_g>100000 then raise exception 'Invalid ingredient quantity'; end if;
   if not exists(select 1 from public.foods where id=ingredient.food_id) then raise exception 'Unknown food'; end if;
   select quantity_g into stock from public.pantry_items where user_id=auth.uid() and food_id=ingredient.food_id and (expires_on is null or expires_on>=m.local_date) for update;
   used=least(coalesce(stock,0),ingredient.quantity_g);
   if used>0 then
    update public.pantry_items set quantity_g=quantity_g-used where user_id=auth.uid() and food_id=ingredient.food_id;
    insert into public.pantry_movements(user_id,daily_meal_log_id,food_id,quantity_g) values(auth.uid(),m.id,ingredient.food_id,used);
   end if;
  end loop;
 end if;
 if p_status='deleted' then delete from public.daily_meal_logs where id=m.id;
 else update public.daily_meal_logs set status=p_status where id=m.id; end if;
end $$;
revoke all on function public.set_meal_status(uuid,text) from public,anon;
grant execute on function public.set_meal_status(uuid,text) to authenticated;

