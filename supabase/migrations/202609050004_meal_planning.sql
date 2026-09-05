-- Phase 4: normalized foods, reusable templates, and per-user saved plans.
alter table public.foods add column category text not null default 'staple', add column aliases text[] not null default '{}', add column tags text[] not null default '{}', add column preparation text not null default 'As purchased', add column updated_at timestamptz not null default now();
create table public.food_nutrition (
 id uuid primary key default gen_random_uuid(),food_id uuid not null unique references public.foods(id) on delete cascade,
 calories numeric not null check(calories>=0 and calories<=1000),protein numeric not null check(protein between 0 and 100),carbs numeric not null check(carbs between 0 and 100),fat numeric not null check(fat between 0 and 100),fiber numeric not null check(fiber between 0 and 100),
 basis_g numeric not null default 100 check(basis_g=100),serving_g numeric not null check(serving_g>0),piece_g numeric check(piece_g>0),source text not null,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.meals (
 id uuid primary key default gen_random_uuid(),slug text not null unique,name text not null,slots text[] not null,instructions text[] not null default '{}',cooking_minutes integer not null check(cooking_minutes between 1 and 120),complexity integer not null check(complexity between 1 and 3),batch_friendly boolean not null default false,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.meal_items(id uuid primary key default gen_random_uuid(),meal_id uuid not null references public.meals(id) on delete cascade,food_id uuid not null references public.foods(id),quantity_g numeric not null check(quantity_g>0 and quantity_g<=2000),role text not null check(role in ('protein','carb','fat','fiber')),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(meal_id,food_id));
create table public.meal_plans(id uuid primary key default gen_random_uuid(),user_id uuid not null unique references public.profiles(id) on delete cascade,name text not null default 'My meal plan',revision integer not null default 0,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(id,user_id));
create table public.meal_plan_days(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,plan_id uuid not null,local_date date not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(user_id,local_date),unique(id,user_id),foreign key(plan_id,user_id) references public.meal_plans(id,user_id) on delete cascade);
alter table public.daily_meal_logs add constraint meal_logs_id_owner_unique unique(id,user_id);
alter table public.daily_meal_logs add column template_id uuid references public.meals(id),add column instructions text[] not null default '{}';
create table public.meal_plan_entries(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,day_id uuid not null,meal_log_id uuid not null unique,position integer not null check(position between 0 and 4),created_at timestamptz not null default now(),unique(day_id,position),foreign key(day_id,user_id) references public.meal_plan_days(id,user_id) on delete cascade,foreign key(meal_log_id,user_id) references public.daily_meal_logs(id,user_id) on delete cascade);
create index meal_items_food_idx on public.meal_items(food_id);
create index meal_plan_days_plan_idx on public.meal_plan_days(plan_id,user_id);
create index meal_plan_entries_user_idx on public.meal_plan_entries(user_id);
create index meal_logs_template_idx on public.daily_meal_logs(template_id);
do $$ declare t text;begin
 foreach t in array array['food_nutrition','meals','meal_items'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('create policy catalog_read on public.%I for select to authenticated using(true)',t);
 end loop;
 foreach t in array array['meal_plans','meal_plan_days','meal_plan_entries'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('create policy own_plan on public.%I for select to authenticated using(user_id=(select auth.uid()))',t);
 end loop;
 foreach t in array array['foods','food_nutrition','meals','meal_items','meal_plans','meal_plan_days'] loop
 execute format('create trigger touch_updated before update on public.%I for each row execute function public.touch_updated_at()',t);
 end loop;
end $$;

create function public.save_meal_plan(p_days jsonb,p_revision integer) returns integer language plpgsql security definer set search_path='' as $$
declare uid uuid=auth.uid(); pid uuid; rev integer; d jsonb; m jsonb; dt date; did uuid; mid uuid; old record; tmpl public.meals; ingr jsonb; vals record; pos integer; today date;
begin
 if uid is null or jsonb_typeof(p_days)<>'array' or jsonb_array_length(p_days) not between 1 and 14 then raise exception 'Invalid meal plan';end if;
 select (now() at time zone timezone)::date into today from public.profiles where id=uid for update;
 insert into public.meal_plans(user_id) values(uid) on conflict(user_id) do nothing;
 select id,revision into pid,rev from public.meal_plans where user_id=uid for update;
 if p_revision is null or rev<>p_revision then raise exception 'Your plan changed in another session. Reload before saving.';end if;
 if (select count(distinct x->>'date') from jsonb_array_elements(p_days)x)<>jsonb_array_length(p_days) then raise exception 'Duplicate plan date';end if;
 for d in select * from jsonb_array_elements(p_days) loop
  dt=(d->>'date')::date;
  if dt is null or dt<today or dt>today+90 or jsonb_array_length(d->'meals') not between 2 and 5 then raise exception 'Invalid plan day';end if;
  -- A completed/skipped generated day is immutable; its actual history is preserved.
  if exists(select 1 from public.meal_plan_entries e join public.meal_plan_days pd on pd.id=e.day_id join public.daily_meal_logs l on l.id=e.meal_log_id where pd.user_id=uid and pd.local_date=dt and l.status<>'planned') then raise exception 'This day already has a completed or skipped meal. Its saved plan is protected.';end if;
  for old in select e.meal_log_id from public.meal_plan_entries e join public.meal_plan_days pd on pd.id=e.day_id where pd.user_id=uid and pd.local_date=dt order by e.meal_log_id loop perform public.set_meal_status(old.meal_log_id,'deleted');end loop;
  insert into public.meal_plan_days(user_id,plan_id,local_date) values(uid,pid,dt) on conflict(user_id,local_date) do update set updated_at=now() returning id into did;
  pos=0;
  for m in select * from jsonb_array_elements(d->'meals') loop
   select * into tmpl from public.meals where id=(m->>'template_id')::uuid;
   if not found or not((m->>'slot')=any(tmpl.slots)) then raise exception 'Invalid meal template';end if;
   if jsonb_typeof(m->'ingredients')<>'array' or jsonb_array_length(m->'ingredients')<>(select count(*) from public.meal_items where meal_id=tmpl.id) then raise exception 'Template ingredients do not match';end if;
   if exists(select 1 from jsonb_array_elements(m->'ingredients') x left join public.meal_items mi on mi.meal_id=tmpl.id and mi.food_id=(x->>'food_id')::uuid where mi.id is null or (x->>'quantity_g')::numeric not between greatest(1,mi.quantity_g*.5) and mi.quantity_g*3) then raise exception 'Invalid ingredient portion';end if;
   if (select count(distinct x->>'food_id') from jsonb_array_elements(m->'ingredients')x)<>jsonb_array_length(m->'ingredients') then raise exception 'Duplicate ingredient';end if;
   select jsonb_agg(jsonb_build_object('food_id',f.id,'name',f.name,'quantity_g',(x->>'quantity_g')::numeric) order by f.name),sum(n.calories*(x->>'quantity_g')::numeric/100) calories,sum(n.protein*(x->>'quantity_g')::numeric/100) protein,sum(n.carbs*(x->>'quantity_g')::numeric/100) carbs,sum(n.fat*(x->>'quantity_g')::numeric/100) fat,sum(n.fiber*(x->>'quantity_g')::numeric/100) fiber into vals
   from jsonb_array_elements(m->'ingredients')x join public.foods f on f.id=(x->>'food_id')::uuid join public.food_nutrition n on n.food_id=f.id;
   ingr=vals.jsonb_agg;
   insert into public.daily_meal_logs(user_id,local_date,slot,name,calories,protein,carbs,fat,fiber,ingredients,template_id,instructions)
   values(uid,dt,m->>'slot',tmpl.name,round(vals.calories,1),round(vals.protein,1),round(vals.carbs,1),round(vals.fat,1),round(vals.fiber,1),ingr,tmpl.id,tmpl.instructions) returning id into mid;
   insert into public.meal_plan_entries(user_id,day_id,meal_log_id,position) values(uid,did,mid,pos);pos=pos+1;
  end loop;
 end loop;
 update public.meal_plans set revision=revision+1 where id=pid returning revision into rev;
 return rev;
end $$;
revoke all on function public.save_meal_plan(jsonb,integer) from public,anon;
grant execute on function public.save_meal_plan(jsonb,integer) to authenticated;
