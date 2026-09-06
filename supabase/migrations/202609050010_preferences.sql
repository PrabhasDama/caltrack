alter table public.profiles add column country_code text not null default 'US' check(country_code in ('US','CA')),add column display_units_override text check(display_units_override in ('imperial','metric'));
-- Preserve existing explicit unit choices. New profiles inherit their country's default.
update public.profiles set display_units_override=units where onboarding_completed_at is not null;
create function public.save_preference_section(p_section text,p_data jsonb,p_expected jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare uid uuid=auth.uid();tbl text;allowed text[];old jsonb;selected jsonb;assignments text;col text;stores uuid[];begin
 if uid is null or jsonb_typeof(p_data)<>'object' or p_expected is null then raise exception 'Invalid preferences';end if;
 perform 1 from public.profiles where id=uid and onboarding_completed_at is not null for update;if not found then raise exception 'Complete onboarding first';end if;
 case p_section
 when 'goals' then tbl='user_goals';allowed=array['goal','goal_weight_kg','pace'];
 when 'macros' then tbl='macro_targets';allowed=array['calories','protein','carbs','fat','fiber','water_ml','source','warnings_acknowledged_at'];
 when 'budget' then tbl='budgets';allowed=array['monthly_amount','currency'];
 when 'cooking' then tbl='user_preferences';allowed=array['cooking_minutes','complexity','meals_per_day','prep_frequency','repeat_tolerance'];
 when 'diet' then tbl='user_preferences';allowed=array['restrictions','excluded_foods'];
 when 'foods' then tbl='user_preferences';allowed=array['preferred_proteins','preferred_carbs','preferred_vegetables','preferred_fiber','disliked_foods'];
 when 'shopping' then tbl='user_preferences';allowed=array['shopping_frequency','shopping_preference','zip_code'];
 when 'training' then tbl='user_preferences';allowed=array['activity','workout_days','training_types'];
 when 'profile' then tbl='profiles';allowed=array['first_name','timezone','height_cm','age','sex'];
 when 'units' then tbl='profiles';allowed=array['country_code','display_units_override'];
 when 'stores' then
  select coalesce(jsonb_agg(store_id order by store_id),'[]') into selected from public.store_preferences where user_id=uid;
  if selected is distinct from p_expected->'stores' then raise exception 'Store preferences changed. Reload and try again.';end if;
  if jsonb_typeof(p_data->'stores')<>'array' or jsonb_array_length(p_data->'stores') not between 1 and 20 then raise exception 'Select 1–20 stores';end if;
  delete from public.store_preferences where user_id=uid;
  insert into public.store_preferences(user_id,store_id) select uid,value::uuid from jsonb_array_elements_text(p_data->'stores') on conflict do nothing;return;
 else raise exception 'Unknown preference section';end case;
 if exists(select 1 from jsonb_object_keys(p_data) k where not(k=any(allowed))) or p_data='{}'::jsonb then raise exception 'Unexpected preference field';end if;
 execute format('select to_jsonb(t) from public.%I t where %I=$1',tbl,case when tbl='profiles' then 'id' else 'user_id' end) into old using uid;
 if old is null then raise exception 'Preference record missing';end if;
 select jsonb_object_agg(k,old->k) into selected from jsonb_object_keys(p_data)k;
 if selected is distinct from p_expected then raise exception 'These preferences changed. Reload and try again.';end if;
 if p_section='profile' and p_data ? 'timezone' and not exists(select 1 from pg_timezone_names where name=p_data->>'timezone') then raise exception 'Invalid timezone';end if;
 select string_agg(format('%I=v.%I',k,k),',') into assignments from jsonb_object_keys(p_data)k;
 execute format('update public.%I t set %s from jsonb_populate_record(null::public.%I,$1) v where t.%I=$2',tbl,assignments,tbl,case when tbl='profiles' then 'id' else 'user_id' end) using old||p_data,uid;
 if p_section='units' then update public.profiles set units=coalesce(display_units_override,case when country_code='CA' then 'metric' else 'imperial' end) where id=uid;end if;
end $$;
revoke all on function public.save_preference_section(text,jsonb,jsonb) from public,anon;
grant execute on function public.save_preference_section(text,jsonb,jsonb) to authenticated;
-- Prevent a stale completed wizard from overwriting independently edited preferences.
alter function public.save_onboarding(jsonb) rename to save_initial_onboarding_v6;
revoke all on function public.save_initial_onboarding_v6(jsonb) from public,anon,authenticated;
create function public.save_onboarding(p_data jsonb) returns void language plpgsql security definer set search_path='' as $$ begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 if exists(select 1 from public.profiles where id=auth.uid() and onboarding_completed_at is not null) then raise exception 'Use Preferences to edit an existing profile';end if;
 perform public.save_initial_onboarding_v6(p_data);
 update public.profiles set display_units_override=units where id=auth.uid();
end $$;
revoke all on function public.save_onboarding(jsonb) from public,anon;
grant execute on function public.save_onboarding(jsonb) to authenticated;
