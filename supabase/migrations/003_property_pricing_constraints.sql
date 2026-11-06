-- Property pricing invariants. Run this after 002_two_stays_guest_details_pricing.sql.
alter table public.properties
  drop constraint if exists properties_base_price_inr_check,
  add constraint properties_base_price_inr_check check (base_price_inr >= 0),
  drop constraint if exists properties_cleaning_fee_inr_check,
  add constraint properties_cleaning_fee_inr_check check (cleaning_fee_inr >= 0),
  drop constraint if exists properties_max_guests_check,
  add constraint properties_max_guests_check check (max_guests between 1 and 20),
  drop constraint if exists properties_included_guests_check,
  add constraint properties_included_guests_check check (included_guests between 1 and max_guests),
  drop constraint if exists properties_extra_guest_fee_inr_check,
  add constraint properties_extra_guest_fee_inr_check check (extra_guest_fee_inr >= 0),
  drop constraint if exists properties_extra_guest_fee_mode_check,
  add constraint properties_extra_guest_fee_mode_check check (extra_guest_fee_mode in ('per_night', 'per_stay'));
