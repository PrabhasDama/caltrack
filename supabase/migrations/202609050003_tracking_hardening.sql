revoke all on function public.handle_new_user() from public,anon,authenticated;
revoke all on function public.touch_updated_at() from public,anon,authenticated;
-- These functions can rely on ordinary row-level policies; only meal completion
-- needs elevated rights to update the protected ledger.
alter function public.add_water(date,integer) security invoker;
alter function public.save_onboarding(jsonb) security invoker;
create function public.complete_water_goal(p_date date) returns void language plpgsql security invoker set search_path='' as $$
declare target integer;
begin
 select water_ml into target from public.macro_targets where user_id=auth.uid();
 if target is null or p_date is null then raise exception 'Set your water target first'; end if;
 insert into public.daily_logs(user_id,local_date,water_ml) values(auth.uid(),p_date,target)
 on conflict(user_id,local_date) do update set water_ml=greatest(public.daily_logs.water_ml,excluded.water_ml);
end $$;
revoke all on function public.complete_water_goal(date) from public,anon;
grant execute on function public.complete_water_goal(date) to authenticated;
