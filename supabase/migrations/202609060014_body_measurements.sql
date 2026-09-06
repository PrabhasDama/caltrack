create table public.body_measurements (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 local_date date not null, waist numeric check(waist between 1 and 400), chest numeric check(chest between 1 and 400),
 hips numeric check(hips between 1 and 400), arms numeric check(arms between 1 and 400), thighs numeric check(thighs between 1 and 400),
 notes text not null default '' check(char_length(notes)<=1000), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(user_id,local_date), check(num_nonnulls(waist,chest,hips,arms,thighs)>0)
);
alter table public.body_measurements enable row level security;
revoke all on public.body_measurements from anon,authenticated;
grant select,insert,update,delete on public.body_measurements to authenticated;
create policy own_measurements on public.body_measurements for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create trigger touch_updated before update on public.body_measurements for each row execute function public.touch_updated_at();
