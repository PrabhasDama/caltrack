-- Browser JSON numbers use double precision. Imperial onboarding can store a
-- more precise numeric value, causing an unchanged section to look stale.
-- Compare numeric expectations at the transport's precision, retaining exact
-- comparison for all other fields and the existing owner/section protections.
do $migration$
declare definition text; needle text := 'if selected is distinct from p_expected then';
begin
  definition := pg_get_functiondef('public.save_preference_section(text,jsonb,jsonb)'::regprocedure);
  if position(needle in definition) = 0 then
    raise exception 'Preference comparison definition was not found';
  end if;
  definition := replace(definition, needle, $replacement$
  for col in select jsonb_object_keys(selected) loop
    if jsonb_typeof(selected->col) = 'number'
       and jsonb_typeof(p_expected->col) = 'number'
       and (selected->>col)::double precision = (p_expected->>col)::double precision then
      selected := jsonb_set(selected, array[col], p_expected->col);
    end if;
  end loop;
  if selected is distinct from p_expected then$replacement$);
  execute definition;
end $migration$;
