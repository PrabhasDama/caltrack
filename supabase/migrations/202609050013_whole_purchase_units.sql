-- Do not reinterpret legacy quantities; enforce whole discrete purchases on new writes.
alter table public.purchase_items add constraint whole_purchase_units check(unit not in ('piece','package') or quantity=trunc(quantity)) not valid;
