create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create type public.booking_status as enum ('held', 'confirmed', 'cancelled', 'completed', 'refunded');
create type public.conversation_status as enum ('open', 'closed');
create type public.message_sender_role as enum ('guest', 'admin');
create type public.message_kind as enum ('text', 'time_request', 'time_approval', 'system');
create type public.payment_status as enum ('created', 'authorized', 'captured', 'failed', 'refund_pending', 'refunded', 'partially_refunded');

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  tagline text not null default '',
  description text not null default '',
  lat double precision not null,
  lng double precision not null,
  address text not null default '',
  district text not null,
  base_price_inr integer not null check (base_price_inr >= 0),
  cleaning_fee_inr integer not null default 0 check (cleaning_fee_inr >= 0),
  max_guests integer not null default 2 check (max_guests between 1 and 20),
  bedrooms integer not null default 1 check (bedrooms >= 0),
  bathrooms integer not null default 1 check (bathrooms >= 0),
  amenities jsonb not null default '[]'::jsonb,
  house_rules jsonb not null default '[]'::jsonb,
  checkin_start time not null default '10:00',
  checkin_end time not null default '20:00',
  checkout_latest time not null default '09:00',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.property_images (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  storage_path text not null,
  thumb_path text not null,
  original_path text,
  alt text not null default '',
  sort_order integer not null default 0,
  is_cover boolean not null default false,
  edit_params jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(property_id, sort_order)
);
create unique index property_images_one_cover on public.property_images(property_id) where is_cover;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id),
  guest_id uuid not null references public.profiles(id),
  checkin_date date not null,
  checkout_date date not null,
  stay_range daterange generated always as (daterange(checkin_date, checkout_date, '[)')) stored,
  expected_arrival_time time not null default '15:00',
  custom_checkin_time time,
  custom_checkout_time time,
  guests integer not null default 1 check (guests > 0),
  status public.booking_status not null default 'held',
  hold_expires_at timestamptz,
  subtotal_inr integer not null default 0 check (subtotal_inr >= 0),
  taxes_inr integer not null default 0 check (taxes_inr >= 0),
  total_inr integer not null default 0 check (total_inr >= 0),
  amount_paid_inr integer not null default 0 check (amount_paid_inr >= 0),
  custom_time_fee_inr integer not null default 0 check (custom_time_fee_inr >= 0),
  razorpay_order_id text unique,
  razorpay_payment_id text unique,
  notes text not null default '',
  deposit_percent integer check (deposit_percent between 1 and 100),
  created_at timestamptz not null default now(),
  check (checkout_date > checkin_date),
  check (expected_arrival_time between '10:00' and '20:00')
);
alter table public.bookings add constraint bookings_no_overlapping_stays
  exclude using gist (property_id with =, stay_range with &&)
  where (status in ('held', 'confirmed'));
create index bookings_guest_status_idx on public.bookings(guest_id, status, checkin_date);
create index bookings_property_checkin_idx on public.bookings(property_id, checkin_date);

create table public.blocked_dates (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  range daterange not null,
  reason text not null default 'Unavailable',
  created_at timestamptz not null default now(),
  check (not isempty(range))
);
alter table public.blocked_dates add constraint blocked_dates_no_overlap
  exclude using gist (property_id with =, range with &&);

create table public.seasonal_rates (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  range daterange not null,
  nightly_rate_inr integer not null check (nightly_rate_inr >= 0),
  label text not null default '',
  created_at timestamptz not null default now(),
  check (not isempty(range))
);
alter table public.seasonal_rates add constraint seasonal_rates_no_overlap
  exclude using gist (property_id with =, range with &&);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  razorpay_order_id text not null,
  razorpay_payment_id text unique,
  status public.payment_status not null default 'created',
  amount_inr integer not null check (amount_inr >= 0),
  refunded_inr integer not null default 0 check (refunded_inr >= 0),
  method text,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index payments_order_id_idx on public.payments(razorpay_order_id);

create table public.payment_events (
  event_id text primary key,
  event_type text not null,
  received_at timestamptz not null default now()
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references public.profiles(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,
  booking_id uuid references public.bookings(id) on delete set null,
  subject text not null default 'A note for your host',
  status public.conversation_status not null default 'open',
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create unique index one_open_property_thread on public.conversations(guest_id, property_id) where booking_id is null and status = 'open' and property_id is not null;
create unique index one_booking_thread on public.conversations(booking_id) where booking_id is not null;

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_role public.message_sender_role not null,
  sender_id text not null,
  body text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  kind public.message_kind not null default 'text',
  meta jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check (length(body) <= 10000)
);
create index messages_conversation_created_idx on public.messages(conversation_id, created_at);

create table public.admin_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into public.admin_settings(key, value) values
  ('deposit_enabled', 'false'::jsonb),
  ('deposit_percent', '30'::jsonb),
  ('gst_percent', '5'::jsonb),
  ('cancellation_policy', '{"free_cancellation_hours":72,"refund_percent_after_window":50}'::jsonb)
on conflict (key) do nothing;

create or replace function public.is_clerk_admin() returns boolean
language sql stable security invoker set search_path = '' as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
$$;

alter table public.properties enable row level security;
alter table public.property_images enable row level security;
alter table public.profiles enable row level security;
alter table public.bookings enable row level security;
alter table public.blocked_dates enable row level security;
alter table public.seasonal_rates enable row level security;
alter table public.payments enable row level security;
alter table public.payment_events enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.admin_settings enable row level security;

create policy "active properties are public" on public.properties for select to anon, authenticated using (is_active or public.is_clerk_admin());
create policy "admins manage properties" on public.properties for all to authenticated using (public.is_clerk_admin()) with check (public.is_clerk_admin());
create policy "active property image metadata is public" on public.property_images for select to anon, authenticated using (exists (select 1 from public.properties p where p.id = property_id and p.is_active) or public.is_clerk_admin());
create policy "admins manage property images" on public.property_images for all to authenticated using (public.is_clerk_admin()) with check (public.is_clerk_admin());
create policy "guest manages own profile" on public.profiles for all to authenticated using (id::text = auth.jwt() ->> 'sub' or public.is_clerk_admin()) with check (id::text = auth.jwt() ->> 'sub' or public.is_clerk_admin());
create policy "guest reads own bookings" on public.bookings for select to authenticated using (guest_id::text = auth.jwt() ->> 'sub' or public.is_clerk_admin());
create policy "admins manage bookings" on public.bookings for all to authenticated using (public.is_clerk_admin()) with check (public.is_clerk_admin());
create policy "date-only blocks are public" on public.blocked_dates for select to anon, authenticated using (true);
create policy "admins manage blocked dates" on public.blocked_dates for all to authenticated using (public.is_clerk_admin()) with check (public.is_clerk_admin());
create policy "active seasonal rates are public" on public.seasonal_rates for select to anon, authenticated using (true);
create policy "admins manage seasonal rates" on public.seasonal_rates for all to authenticated using (public.is_clerk_admin()) with check (public.is_clerk_admin());
create policy "guest reads own payments" on public.payments for select to authenticated using (exists (select 1 from public.bookings b where b.id = booking_id and b.guest_id::text = auth.jwt() ->> 'sub') or public.is_clerk_admin());
create policy "admins manage payments" on public.payments for all to authenticated using (public.is_clerk_admin()) with check (public.is_clerk_admin());
create policy "admins manage payment events" on public.payment_events for all to authenticated using (public.is_clerk_admin()) with check (public.is_clerk_admin());
create policy "guest manages own conversations" on public.conversations for all to authenticated using (guest_id::text = auth.jwt() ->> 'sub' or public.is_clerk_admin()) with check (guest_id::text = auth.jwt() ->> 'sub' or public.is_clerk_admin());
create policy "guest reads own messages" on public.messages for select to authenticated using (exists (select 1 from public.conversations c where c.id = conversation_id and c.guest_id::text = auth.jwt() ->> 'sub') or public.is_clerk_admin());
create policy "guest sends own messages" on public.messages for insert to authenticated with check (sender_role = 'guest' and sender_id = auth.jwt() ->> 'sub' and exists (select 1 from public.conversations c where c.id = conversation_id and c.guest_id::text = auth.jwt() ->> 'sub'));
create policy "guest marks own messages read" on public.messages for update to authenticated using (exists (select 1 from public.conversations c where c.id = conversation_id and c.guest_id::text = auth.jwt() ->> 'sub')) with check (exists (select 1 from public.conversations c where c.id = conversation_id and c.guest_id::text = auth.jwt() ->> 'sub'));
revoke update on public.messages from authenticated;
grant update(read_at) on public.messages to authenticated;
create policy "admins manage messages" on public.messages for all to authenticated using (public.is_clerk_admin()) with check (public.is_clerk_admin());
create policy "admin settings public-safe read" on public.admin_settings for select to authenticated using (key in ('deposit_percent', 'gst_percent', 'cancellation_policy') or public.is_clerk_admin());
create policy "admins manage settings" on public.admin_settings for all to authenticated using (public.is_clerk_admin()) with check (public.is_clerk_admin());

create or replace view public.public_availability as
  select b.property_id, b.checkin_date, b.checkout_date
  from public.bookings b
  where b.status in ('held', 'confirmed') and (b.status <> 'held' or b.hold_expires_at > now())
  union all
  select d.property_id, lower(d.range)::date, upper(d.range)::date from public.blocked_dates d;
grant select on public.public_availability to anon, authenticated;

create or replace function public.prevent_booking_block_overlap() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform id from public.properties where id = new.property_id for update;
  if tg_table_name = 'bookings' then
    if new.status in ('held', 'confirmed') and exists (select 1 from public.blocked_dates d where d.property_id = new.property_id and d.range && new.stay_range) then
      raise exception 'Stay overlaps owner-blocked dates' using errcode = '23P01';
    end if;
  elsif exists (select 1 from public.bookings b where b.property_id = new.property_id and b.status in ('held', 'confirmed') and b.stay_range && new.range) then
    raise exception 'Owner block overlaps an active stay' using errcode = '23P01';
  end if;
  return new;
end $$;
create trigger booking_block_overlap_guard before insert or update of property_id, checkin_date, checkout_date, status on public.bookings for each row execute function public.prevent_booking_block_overlap();
create trigger blocked_date_overlap_guard before insert or update of property_id, range on public.blocked_dates for each row execute function public.prevent_booking_block_overlap();

-- Publish a small date-only signal. Raw booking rows remain private while calendars refresh live.
create or replace function public.notify_public_availability() returns trigger
language plpgsql security definer set search_path = public, realtime, pg_temp as $$
declare
  v_property_id uuid;
  v_start date;
  v_end date;
begin
  if tg_op = 'DELETE' then
    v_property_id := old.property_id;
    if tg_table_name = 'bookings' then v_start := old.checkin_date; v_end := old.checkout_date;
    else v_start := lower(old.range); v_end := upper(old.range); end if;
  else
    v_property_id := new.property_id;
    if tg_table_name = 'bookings' then v_start := new.checkin_date; v_end := new.checkout_date;
    else v_start := lower(new.range); v_end := upper(new.range); end if;
  end if;
  perform realtime.send(jsonb_build_object('property_id', v_property_id, 'start_date', v_start, 'end_date', v_end), 'availability_changed', 'availability:' || v_property_id::text, false);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger bookings_availability_broadcast after insert or update or delete on public.bookings for each row execute function public.notify_public_availability();
create trigger blocked_dates_availability_broadcast after insert or update or delete on public.blocked_dates for each row execute function public.notify_public_availability();

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
  if exists (select 1 from public.blocked_dates d where d.property_id = p_property_id and d.range && daterange(p_checkin, p_checkout, '[)')) then raise exception 'Selected dates are unavailable'; end if;
  if exists (select 1 from public.bookings b where b.property_id = p_property_id and b.status in ('held','confirmed') and (b.status <> 'held' or b.hold_expires_at > now()) and b.stay_range && daterange(p_checkin, p_checkout, '[)')) then raise exception 'Selected dates are unavailable'; end if;
  if not exists (select 1 from public.profiles where id = v_guest) then insert into public.profiles(id) values (v_guest); end if;
  v_nights := p_checkout - p_checkin;
  v_cleaning := v_property.cleaning_fee_inr;
  select coalesce((value #>> '{}')::integer, 5) into v_tax_percent from public.admin_settings where key = 'gst_percent';
  v_subtotal := 0;
  for v_night in 0..v_nights - 1 loop
    select coalesce((select r.nightly_rate_inr from public.seasonal_rates r where r.property_id = p_property_id and r.range @> (p_checkin + v_night) limit 1), v_property.base_price_inr) into v_night_rate;
    v_subtotal := v_subtotal + v_night_rate;
  end loop;
  v_taxes := round((v_subtotal + v_cleaning)::numeric * v_tax_percent / 100);
  insert into public.bookings(property_id, guest_id, checkin_date, checkout_date, expected_arrival_time, guests, status, hold_expires_at, subtotal_inr, taxes_inr, total_inr)
  values (p_property_id, v_guest, p_checkin, p_checkout, p_expected_arrival, p_guests, 'held', now() + interval '10 minutes', v_subtotal, v_taxes, v_subtotal + v_cleaning + v_taxes)
  returning * into v_booking;
  return v_booking;
exception when exclusion_violation then raise exception 'Selected dates are unavailable';
end $$;
revoke all on function public.create_booking_hold(uuid,date,date,integer,time) from public;
grant execute on function public.create_booking_hold(uuid,date,date,integer,time) to authenticated;

create or replace function public.expire_stale_holds() returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_count integer;
begin
  update public.bookings set status = 'cancelled', hold_expires_at = null
  where status = 'held' and hold_expires_at < now();
  get diagnostics v_count = row_count;
  return v_count;
end $$;
revoke all on function public.expire_stale_holds() from public, anon, authenticated;
grant execute on function public.expire_stale_holds() to service_role;

alter publication supabase_realtime add table public.bookings;
alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.messages;

insert into storage.buckets(id, name, public) values ('property-images', 'property-images', false) on conflict (id) do update set public = false;
insert into storage.buckets(id, name, public) values ('chat-attachments', 'chat-attachments', false) on conflict (id) do nothing;
create policy "admins read property image objects" on storage.objects for select to authenticated using (bucket_id = 'property-images' and public.is_clerk_admin());
create policy "admin uploads property images" on storage.objects for all to authenticated using (bucket_id = 'property-images' and public.is_clerk_admin()) with check (bucket_id = 'property-images' and public.is_clerk_admin());
create policy "guest chat attachment reads" on storage.objects for select to authenticated using (bucket_id = 'chat-attachments' and (storage.foldername(name))[1] in (select c.id::text from public.conversations c where c.guest_id::text = auth.jwt() ->> 'sub'));
create policy "guest chat attachment uploads" on storage.objects for insert to authenticated with check (bucket_id = 'chat-attachments' and (storage.foldername(name))[1] in (select c.id::text from public.conversations c where c.guest_id::text = auth.jwt() ->> 'sub'));
create policy "admin chat attachment access" on storage.objects for all to authenticated using (bucket_id = 'chat-attachments' and public.is_clerk_admin()) with check (bucket_id = 'chat-attachments' and public.is_clerk_admin());
