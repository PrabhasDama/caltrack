-- Historical rows remain unknown; planned dates/times are never inferred as eaten time.
alter table public.daily_meal_logs add column completed_at timestamptz;
create table public.meal_completion_events (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 meal_log_id uuid references public.daily_meal_logs(id) on delete set null,
 event text not null check(event in ('completed','undone')), occurred_at timestamptz not null default clock_timestamp()
);
alter table public.meal_completion_events enable row level security;
create policy owner_read on public.meal_completion_events for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.meal_completion_events from anon,authenticated;
grant select on public.meal_completion_events to authenticated;
create function public.record_meal_completion() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and old.status=new.status then new.completed_at=old.completed_at;return new;end if;
 if new.status='completed' then new.completed_at=clock_timestamp();else new.completed_at=null;end if;
 return new;
end $$;
create function public.audit_meal_completion() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='DELETE' then
  if old.status='completed' then insert into public.meal_completion_events(user_id,event) values(old.user_id,'undone');end if;return old;
 end if;
 if tg_op='UPDATE' and old.status=new.status then return new;end if;
 if new.status='completed' then insert into public.meal_completion_events(user_id,meal_log_id,event,occurred_at) values(new.user_id,new.id,'completed',new.completed_at);
 elsif tg_op='UPDATE' and old.status='completed' then insert into public.meal_completion_events(user_id,meal_log_id,event) values(new.user_id,new.id,'undone');end if;
 return new;
end $$;
create trigger record_meal_completion before insert or update on public.daily_meal_logs for each row execute function public.record_meal_completion();
create trigger audit_meal_completion after insert or update or delete on public.daily_meal_logs for each row execute function public.audit_meal_completion();
revoke all on function public.record_meal_completion(), public.audit_meal_completion() from public,anon,authenticated;
