create table public.meal_prep_sessions (
 id uuid primary key, user_id uuid not null references public.profiles(id) on delete cascade,
 local_date date not null,start_date date not null,end_date date not null,source_revision integer not null,
 tasks jsonb not null check(jsonb_typeof(tasks)='array' and jsonb_array_length(tasks) between 1 and 150),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(end_date>=start_date and end_date<=start_date+13)
);
alter table public.meal_prep_sessions enable row level security;
revoke all on public.meal_prep_sessions from anon,authenticated;
grant select,insert,update,delete on public.meal_prep_sessions to authenticated;
create policy own_prep on public.meal_prep_sessions for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create trigger touch_updated before update on public.meal_prep_sessions for each row execute function public.touch_updated_at();
