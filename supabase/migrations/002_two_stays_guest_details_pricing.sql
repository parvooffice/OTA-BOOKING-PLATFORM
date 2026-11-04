create extension if not exists btree_gist;
create extension if not exists pg_cron;

create or replace function public.is_clerk_admin() returns boolean
language sql stable security invoker set search_path = '' as $$
  select coalesce(auth.jwt() -> 'metadata' ->> 'role', '') = 'admin'
$$;

alter table public.properties
  add column if not exists included_guests integer not null default 2,
  add column if not exists extra_guest_fee_inr integer not null default 500,
  add column if not exists extra_guest_fee_mode text not null default 'per_night';

alter table public.bookings
  add column if not exists guest_id_name text not null default '',
  add column if not exists guest_phone text not null default '',
  add column if not exists extra_guests integer not null default 0,
  add column if not exists extra_guest_total_inr integer not null default 0;

alter table public.bookings
  drop constraint if exists bookings_extra_guests_check,
  add constraint bookings_extra_guests_check check (extra_guests >= 0),
  drop constraint if exists bookings_extra_guest_total_inr_check,
  add constraint bookings_extra_guest_total_inr_check check (extra_guest_total_inr >= 0);

update public.bookings b
set guest_id_name = coalesce(nullif(p.full_name, ''), 'Guest'),
    guest_phone = coalesce(p.phone, '')
from public.profiles p
where p.id = b.guest_id and (b.guest_id_name = '' or b.guest_phone = '');

-- Retire the old generated Property 2 record as Village Retreat, retaining its editable map point.
delete from public.conversations c
where c.property_id in (select id from public.properties where slug in ('chilika', 'gopalpur', 'similipal'))
   or c.booking_id in (select b.id from public.bookings b join public.properties p on p.id = b.property_id where p.slug in ('chilika', 'gopalpur', 'similipal'));

delete from public.bookings b
using public.properties p
where b.property_id = p.id and p.slug in ('chilika', 'gopalpur', 'similipal');

do $$
begin
  if exists (select 1 from public.properties where slug = 'chilika') then
    if exists (select 1 from public.properties where slug = 'village-retreat') then
      delete from public.properties where slug = 'chilika';
    else
      update public.properties set slug = 'village-retreat' where slug = 'chilika';
    end if;
  end if;
end $$;

delete from public.conversations c
where c.property_id in (select id from public.properties where slug not in ('puri', 'village-retreat'))
   or c.booking_id in (select b.id from public.bookings b join public.properties p on p.id = b.property_id where p.slug not in ('puri', 'village-retreat'));
delete from public.bookings b
using public.properties p
where b.property_id = p.id and p.slug not in ('puri', 'village-retreat');
delete from public.properties where slug not in ('puri', 'village-retreat');

update public.properties
set name = 'Puri', district = 'Puri', address = '', tagline = '', description = '', base_price_inr = 0,
    cleaning_fee_inr = 0, max_guests = 2, included_guests = 2, extra_guest_fee_inr = 500,
    extra_guest_fee_mode = 'per_night', bedrooms = 0, bathrooms = 0, amenities = '[]'::jsonb,
    house_rules = '[]'::jsonb, checkin_start = '10:00', checkin_end = '20:00', checkout_latest = '09:00', is_active = true
where slug = 'puri';

update public.properties
set name = 'Village Retreat', district = 'Odisha', address = '', tagline = '', description = '', base_price_inr = 0,
    cleaning_fee_inr = 0, max_guests = 2, included_guests = 2, extra_guest_fee_inr = 500,
    extra_guest_fee_mode = 'per_night', bedrooms = 0, bathrooms = 0, amenities = '[]'::jsonb,
    house_rules = '[]'::jsonb, checkin_start = '10:00', checkin_end = '20:00', checkout_latest = '09:00', is_active = true
where slug = 'village-retreat';

alter table public.properties
  drop constraint if exists properties_included_guests_check,
  add constraint properties_included_guests_check check (included_guests between 0 and max_guests),
  drop constraint if exists properties_extra_guest_fee_inr_check,
  add constraint properties_extra_guest_fee_inr_check check (extra_guest_fee_inr >= 0),
  drop constraint if exists properties_extra_guest_fee_mode_check,
  add constraint properties_extra_guest_fee_mode_check check (extra_guest_fee_mode in ('per_night', 'per_stay'));

-- The starter seed uploaded generated artwork. The owner will add real PNG photos in /admin.
delete from public.property_images;

create or replace function public.create_booking_hold(
  p_property_id uuid, p_checkin date, p_checkout date, p_guests integer, p_expected_arrival time default '15:00'
) returns public.bookings
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_guest uuid := auth.uid();
  v_property public.properties%rowtype;
  v_nights integer;
  v_cleaning integer;
  v_tax_percent integer := 5;
  v_base_total integer := 0;
  v_extra_guests integer;
  v_extra_total integer;
  v_subtotal integer;
  v_taxes integer;
  v_night integer;
  v_night_rate integer;
  v_booking public.bookings%rowtype;
begin
  if v_guest is null then raise exception 'Authentication required'; end if;
  if p_checkout <= p_checkin or p_checkin < current_date or p_guests < 1 then raise exception 'Invalid stay dates or guest count'; end if;
  if p_expected_arrival < time '10:00' or p_expected_arrival > time '20:00' then raise exception 'Arrival time must be between 10:00 and 20:00'; end if;
  select * into v_property from public.properties where id = p_property_id and is_active;
  if not found then raise exception 'Property is not available'; end if;
  update public.bookings set status = 'cancelled', hold_expires_at = null
  where property_id = p_property_id and status = 'held' and hold_expires_at <= now();
  if p_guests > v_property.max_guests then raise exception 'Guest count exceeds this property capacity'; end if;
  if v_property.base_price_inr < 1 then raise exception 'Set a base nightly price before accepting bookings'; end if;
  if exists (select 1 from public.blocked_dates d where d.property_id = p_property_id and d.range && daterange(p_checkin, p_checkout, '[)')) then raise exception 'Selected dates are unavailable'; end if;
  if exists (select 1 from public.bookings b where b.property_id = p_property_id and b.status in ('held','confirmed') and (b.status <> 'held' or b.hold_expires_at > now()) and b.stay_range && daterange(p_checkin, p_checkout, '[)')) then raise exception 'Selected dates are unavailable'; end if;
  if not exists (select 1 from public.profiles where id = v_guest) then insert into public.profiles(id) values (v_guest); end if;

  v_nights := p_checkout - p_checkin;
  v_cleaning := v_property.cleaning_fee_inr;
  select coalesce((value #>> '{}')::integer, 5) into v_tax_percent from public.admin_settings where key = 'gst_percent';
  for v_night in 0..v_nights - 1 loop
    select coalesce((select r.nightly_rate_inr from public.seasonal_rates r where r.property_id = p_property_id and r.range @> (p_checkin + v_night) limit 1), v_property.base_price_inr) into v_night_rate;
    v_base_total := v_base_total + v_night_rate;
  end loop;
  v_extra_guests := greatest(0, p_guests - v_property.included_guests);
  v_extra_total := v_extra_guests * v_property.extra_guest_fee_inr * case when v_property.extra_guest_fee_mode = 'per_night' then v_nights else 1 end;
  v_subtotal := v_base_total + v_extra_total + v_cleaning;
  v_taxes := round(v_subtotal::numeric * v_tax_percent / 100);

  insert into public.bookings(property_id, guest_id, checkin_date, checkout_date, expected_arrival_time, guests, extra_guests, extra_guest_total_inr, status, hold_expires_at, subtotal_inr, taxes_inr, total_inr)
  values (p_property_id, v_guest, p_checkin, p_checkout, p_expected_arrival, p_guests, v_extra_guests, v_extra_total, 'held', now() + interval '10 minutes', v_subtotal, v_taxes, v_subtotal + v_taxes)
  returning * into v_booking;
  return v_booking;
exception when exclusion_violation then raise exception 'Selected dates are unavailable';
end $$;

revoke all on function public.create_booking_hold(uuid,date,date,integer,time) from public;
grant execute on function public.create_booking_hold(uuid,date,date,integer,time) to authenticated;

-- Property photos are public to read; only Clerk admins can mutate them.
update storage.buckets
set public = true, allowed_mime_types = array['image/png'], file_size_limit = 12582912
where id = 'property-images';
drop policy if exists "admins read property image objects" on storage.objects;
drop policy if exists "admin uploads property images" on storage.objects;
drop policy if exists "public reads property image objects" on storage.objects;
create policy "public reads property image objects" on storage.objects for select to anon, authenticated using (bucket_id = 'property-images');
create policy "admin uploads property images" on storage.objects for all to authenticated using (bucket_id = 'property-images' and public.is_clerk_admin()) with check (bucket_id = 'property-images' and public.is_clerk_admin());

insert into storage.buckets(id, name, public) values ('chat-attachments', 'chat-attachments', false) on conflict (id) do update set public = false;
drop policy if exists "guest chat attachment reads" on storage.objects;
drop policy if exists "guest chat attachment uploads" on storage.objects;
drop policy if exists "admin chat attachment access" on storage.objects;
create policy "guest chat attachment reads" on storage.objects for select to authenticated using (bucket_id = 'chat-attachments' and (storage.foldername(name))[1] in (select c.id::text from public.conversations c where c.guest_id::text = auth.jwt() ->> 'sub'));
create policy "guest chat attachment uploads" on storage.objects for insert to authenticated with check (bucket_id = 'chat-attachments' and (storage.foldername(name))[1] in (select c.id::text from public.conversations c where c.guest_id::text = auth.jwt() ->> 'sub'));
create policy "admin chat attachment access" on storage.objects for all to authenticated using (bucket_id = 'chat-attachments' and public.is_clerk_admin()) with check (bucket_id = 'chat-attachments' and public.is_clerk_admin());

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bookings') then alter publication supabase_realtime add table public.bookings; end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'conversations') then alter publication supabase_realtime add table public.conversations; end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then alter publication supabase_realtime add table public.messages; end if;
end $$;

do $$
declare v_job bigint;
begin
  for v_job in select jobid from cron.job where jobname = 'expire-held-bookings-every-minute' loop
    perform cron.unschedule(v_job);
  end loop;
  perform cron.schedule('expire-held-bookings-every-minute', '* * * * *', 'select public.expire_stale_holds();');
end $$;
