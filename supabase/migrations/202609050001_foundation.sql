-- CalTrack Phases 1–3. No retailer pricing or shopping optimizer.
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 first_name text not null default '' check (char_length(first_name) <= 80),
 units text not null default 'imperial' check (units in ('imperial','metric')),
 timezone text not null default 'America/Los_Angeles',
 starting_weight_kg numeric check (starting_weight_kg between 25 and 500),
 height_cm numeric check (height_cm between 100 and 250),
 age integer check (age between 18 and 100),
 sex text check (sex in ('female','male','unspecified')),
 onboarding_step integer not null default 1 check (onboarding_step between 1 and 9),
 onboarding_draft jsonb not null default '{}' check (octet_length(onboarding_draft::text) < 32768),
 onboarding_completed_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.user_goals (
 id uuid primary key default gen_random_uuid(), user_id uuid not null unique references public.profiles(id) on delete cascade,
 goal text not null check (goal in ('lose','recomp','maintain','build')),
 goal_weight_kg numeric not null check (goal_weight_kg between 25 and 500),
 pace text not null check (pace in ('conservative','moderate','aggressive','no_deadline')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.macro_targets (
 id uuid primary key default gen_random_uuid(), user_id uuid not null unique references public.profiles(id) on delete cascade,
 calories integer not null check (calories between 1200 and 8000),
 protein numeric not null check (protein between 20 and 500), carbs numeric not null check (carbs between 0 and 1200),
 fat numeric not null check (fat between 10 and 400), fiber numeric not null check (fiber between 0 and 100),
 water_ml integer not null default 3000 check (water_ml between 500 and 6000),
 source text not null check (source in ('recommended','manual')), warnings_acknowledged_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.user_preferences (
 id uuid primary key default gen_random_uuid(), user_id uuid not null unique references public.profiles(id) on delete cascade,
 activity text not null check (activity in ('sedentary','light','moderate','very')),
 workout_days integer not null check (workout_days between 0 and 7), training_types text[] not null default '{}',
 preferred_proteins text[] not null default '{}', preferred_carbs text[] not null default '{}', preferred_vegetables text[] not null default '{}', preferred_fiber text[] not null default '{}',
 restrictions text[] not null default '{}', excluded_foods text[] not null default '{}', disliked_foods text[] not null default '{}',
 shopping_frequency text not null check (shopping_frequency in ('weekly','twice_monthly','monthly','flexible')),
 zip_code text not null check (zip_code ~ '^\d{5}$'), shopping_preference text not null check (shopping_preference in ('cheapest','fewest','balance','closest')),
 complexity integer not null check (complexity between 1 and 3), cooking_minutes integer not null check (cooking_minutes in (10,20,30,60)),
 prep_frequency text not null check (prep_frequency in ('daily','twice_weekly','weekly','flexible')),
 meals_per_day integer not null check (meals_per_day between 2 and 5), repeat_tolerance text not null check (repeat_tolerance in ('repeat','some','variety')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.stores (id uuid primary key default gen_random_uuid(), slug text not null unique, name text not null, created_at timestamptz not null default now());
create table public.store_preferences (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade, store_id uuid not null references public.stores(id), unique(user_id,store_id));
create table public.budgets (id uuid primary key default gen_random_uuid(), user_id uuid not null unique references public.profiles(id) on delete cascade, monthly_amount numeric not null check (monthly_amount between 20 and 10000), currency text not null default 'USD' check (currency='USD'), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.notification_preferences (id uuid primary key default gen_random_uuid(), user_id uuid not null unique references public.profiles(id) on delete cascade, deal_alerts boolean not null default false, meal_prep_reminders boolean not null default false, grocery_reminders boolean not null default false, weigh_in_reminders boolean not null default false, workout_reminders boolean not null default false);
create table public.daily_logs (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 local_date date not null, water_ml integer not null default 0 check (water_ml between 0 and 15000),
 breakfast boolean not null default false, lunch boolean not null default false, dinner boolean not null default false,
 protein boolean not null default false, fiber boolean not null default false, rest_day boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,local_date)
);
create table public.weight_entries (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade, local_date date not null, weight_kg numeric not null check (weight_kg between 25 and 500), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,local_date));
create table public.workouts (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade, local_date date not null, workout_type text not null check (workout_type in ('Push','Pull','Legs','Upper','Lower','Cardio','Sports','Full Body','Other')), duration_minutes integer check (duration_minutes between 1 and 600), notes text not null default '' check (char_length(notes)<=2000), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,local_date));
-- Minimal food/inventory foundation needed by atomic meal completion. No catalog recommendations yet.
create table public.foods (id uuid primary key default gen_random_uuid(), name text not null unique, unit text not null default 'g' check (unit='g'), created_at timestamptz not null default now());
create table public.pantry_items (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade, food_id uuid not null references public.foods(id), quantity_g numeric not null default 0 check (quantity_g between 0 and 1000000), low_threshold_g numeric not null default 100 check (low_threshold_g>=0), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,food_id));
create table public.daily_meal_logs (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade, local_date date not null,
 slot text not null check (slot in ('Breakfast','Lunch','Dinner','Snack')), name text not null check (char_length(name) between 1 and 120),
 calories numeric not null check (calories between 0 and 4000), protein numeric not null check (protein between 0 and 300), carbs numeric not null check (carbs between 0 and 600), fat numeric not null check (fat between 0 and 250), fiber numeric not null check (fiber between 0 and 100),
 estimated_cost numeric check (estimated_cost between 0 and 1000),
 ingredients jsonb not null default '[]' check (jsonb_typeof(ingredients)='array' and jsonb_array_length(ingredients)<=30),
 status text not null default 'planned' check (status in ('planned','completed','skipped')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.pantry_movements (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade, daily_meal_log_id uuid not null references public.daily_meal_logs(id) on delete cascade, food_id uuid not null references public.foods(id), quantity_g numeric not null check (quantity_g>0), created_at timestamptz not null default now(), unique(daily_meal_log_id, food_id));
create table public.extra_foods (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade, local_date date not null, name text not null check (char_length(name) between 1 and 120), calories numeric not null check (calories between 0 and 4000), protein numeric not null check (protein between 0 and 300), carbs numeric not null check (carbs between 0 and 600), fat numeric not null check (fat between 0 and 250), fiber numeric not null check (fiber between 0 and 100), cost numeric check (cost between 0 and 1000), created_at timestamptz not null default now());
create index daily_meal_user_date on public.daily_meal_logs(user_id,local_date);
create index extra_food_user_date on public.extra_foods(user_id,local_date);
create index pantry_movements_user on public.pantry_movements(user_id);

create function public.touch_updated_at() returns trigger language plpgsql set search_path='' as $$ begin new.updated_at=now(); return new; end $$;
do $$ declare t text; begin
 foreach t in array array['profiles','user_goals','macro_targets','user_preferences','budgets','daily_logs','weight_entries','workouts','pantry_items','daily_meal_logs'] loop
 execute format('create trigger touch_updated before update on public.%I for each row execute function public.touch_updated_at()',t);
 end loop;
end $$;
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$ begin insert into public.profiles(id) values(new.id) on conflict do nothing; return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
-- Existing authenticated users also receive an empty profile, never fabricated progress.
insert into public.profiles(id) select id from auth.users on conflict do nothing;

alter table public.profiles enable row level security;
create policy own_profile_select on public.profiles for select to authenticated using (id=(select auth.uid()));
create policy own_profile_update on public.profiles for update to authenticated using (id=(select auth.uid())) with check (id=(select auth.uid()));
grant select,update on public.profiles to authenticated;
do $$ declare t text; begin
 foreach t in array array['user_goals','macro_targets','user_preferences','store_preferences','budgets','notification_preferences','daily_logs','weight_entries','workouts','pantry_items','extra_foods'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy own_rows on public.%I for all to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()))',t);
 execute format('grant select,insert,update,delete on public.%I to authenticated',t);
 end loop;
end $$;
alter table public.stores enable row level security;
alter table public.foods enable row level security;
create policy read_stores on public.stores for select to authenticated using(true);
create policy read_foods on public.foods for select to authenticated using(true);
grant select on public.stores,public.foods to authenticated;
alter table public.daily_meal_logs enable row level security;
alter table public.pantry_movements enable row level security;
create policy read_meals on public.daily_meal_logs for select to authenticated using (user_id=(select auth.uid()));
create policy insert_meals on public.daily_meal_logs for insert to authenticated with check (user_id=(select auth.uid()) and status='planned');
create policy read_movements on public.pantry_movements for select to authenticated using (user_id=(select auth.uid()));
-- Status changes and deletion go through an ownership-checked transaction, never a client UPDATE.
revoke all on public.daily_meal_logs,public.pantry_movements from anon,authenticated;
grant select,insert on public.daily_meal_logs to authenticated;
grant select on public.pantry_movements to authenticated;

create function public.set_meal_status(p_meal_id uuid,p_status text) returns void
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
   select quantity_g into stock from public.pantry_items where user_id=auth.uid() and food_id=ingredient.food_id for update;
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

create function public.add_water(p_date date,p_amount integer) returns integer language plpgsql security definer set search_path='' as $$
declare total integer;
begin
 if auth.uid() is null or p_amount not in (-500,-250,250,500) or p_date is null then raise exception 'Invalid water request'; end if;
 insert into public.daily_logs(user_id,local_date,water_ml) values(auth.uid(),p_date,greatest(0,p_amount))
 on conflict(user_id,local_date) do update set water_ml=greatest(0,least(15000,public.daily_logs.water_ml+p_amount)) returning water_ml into total;
 return total;
end $$;
revoke all on function public.add_water(date,integer) from public,anon;
grant execute on function public.add_water(date,integer) to authenticated;

insert into public.stores(slug,name) values ('costco','Costco'),('walmart','Walmart'),('target','Target'),('kroger','Ralphs / Kroger'),('albertsons','Vons / Albertsons'),('trader-joes','Trader Joe’s'),('aldi','Aldi'),('sams-club','Sam’s Club');
insert into public.foods(name) values ('Chicken breast'),('Chicken thighs'),('Ground turkey'),('Lean beef'),('Eggs'),('Egg whites'),('Greek yogurt'),('Cottage cheese'),('Tuna'),('Salmon'),('Tofu'),('Beans'),('Protein powder'),('Rice'),('Oats'),('Potatoes'),('Pasta'),('Bread'),('Tortillas'),('Quinoa'),('Broccoli'),('Spinach'),('Carrots'),('Bell peppers'),('Green beans'),('Mixed vegetables'),('Berries'),('Lentils'),('Chia seeds'),('Apples');
