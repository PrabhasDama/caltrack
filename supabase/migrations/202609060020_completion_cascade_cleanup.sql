-- Account deletion must not recreate audit rows for a profile being removed.
create or replace function public.audit_meal_completion() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='DELETE' then
  if old.status='completed' and exists(select 1 from public.profiles where id=old.user_id) then insert into public.meal_completion_events(user_id,event) values(old.user_id,'undone');end if;return old;
 end if;
 if tg_op='UPDATE' and old.status=new.status then return new;end if;
 if new.status='completed' then insert into public.meal_completion_events(user_id,meal_log_id,event,occurred_at) values(new.user_id,new.id,'completed',new.completed_at);
 elsif tg_op='UPDATE' and old.status='completed' then insert into public.meal_completion_events(user_id,meal_log_id,event) values(new.user_id,new.id,'undone');end if;
 return new;
end $$;
