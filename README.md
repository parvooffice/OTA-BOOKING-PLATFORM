# Odisha Retreat

Odisha Retreat is a Next.js booking site for two owner-managed stays: **Puri** (`puri`) and **Village Retreat** (`village-retreat`). Supabase provides the database, guest authentication, storage, realtime and Edge Functions. Vercel hosts the Next.js frontend.

## Local setup

Use Node 20.9 or newer.

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev -- --hostname 0.0.0.0
```

The public pages read properties from Supabase. There is no local preview database or sample-property fallback. Add the Supabase values to `.env.local` before running the app. To view the site from another device on the same Wi-Fi, open `http://<computer-LAN-IP>:3000` on that device.

The seed creates only the Puri and Village Retreat property records. The Village Retreat map point starts at the former second map location and can be corrected in **/admin → Properties**. The property name, location, pricing, details and photos are editable there. Prices start at ₹0 so payment stays disabled until a nightly price is set.

## Supabase schema and seed

Migration `001_initial_schema.sql` creates the existing schema, date-overlap exclusion constraints, RLS policies, realtime availability notifications and booking hold functions. Migration `002_two_stays_guest_details_pricing.sql` adds guest identity and extra-guest pricing, removes the obsolete property records and their placeholder photos, makes property photos public-read/admin-write, configures private chat storage and schedules held-booking expiry once a minute.

Apply migrations before seeding:

```powershell
supabase login
supabase link --project-ref <SUPABASE_PROJECT_REF>
supabase db push
npm run cleanup:property-images
npm run seed
```

Run `cleanup:property-images` once after the migration and before uploading real photos. It uses the Storage API to remove the generated starter images; it deletes every object in `property-images`, so do not run it again after adding real photos. The seed inserts the two editable property rows only. It creates no guest accounts, bookings, conversations, messages, payments or images. Apply migrations and seed against the intended Supabase project; do not run them against a database containing records you need to keep without reviewing migration `002` first.

## Guest checkout and pricing

Before opening Razorpay, the guest saves the name shown on their government ID, a 10-digit Indian mobile number and guest count. The app validates these values in the browser and on the server. The mobile is stored in E.164 format (`+91…`).

The host controls the base nightly price, maximum guests, **COMPLIMENTARY TILL** guest count, per-extra-guest fee and per-night/per-stay fee mode under **/admin → Properties → Pricing**. Set each property's maximum to the real allowed capacity before accepting bookings; it must be at least the complimentary guest count. The server recalculates seasonal nightly price, extra guests, cleaning and GST when it creates the Razorpay order; the browser never supplies the payable amount.

## How host-editable data flows

1. The host edits a property in `/admin → Properties`.
2. The form sends typed rupee values to `PUT /api/admin/properties` using the Clerk-authorised host session.
3. The API validates the fields, updates Supabase, checks that a row was returned, and reloads the saved row before showing success.
4. Public pages use `getProperties()` / `getProperty(slug)` from `lib/property-data.ts`, selecting the same pricing columns from active Supabase rows.
5. Booking quote and order routes read pricing directly from Supabase on the server and recompute the total.
6. `npm run check:data` checks both properties for a positive price, guest rules, timings, active state and a cover image before deployment.

## Add property photos

1. Sign in to `/admin`, open **Image manager**, and choose Puri or Village Retreat.
2. Upload PNG files only (up to 12 MiB each). The storage bucket keeps PNG originals and serves the cover, gallery and thumbnails from Supabase Storage.
3. Use the image manager to crop, reorder, set the cover image and edit alt text. The empty local folders `public/properties/<slug>/gallery/` and `public/properties/<slug>/thumbs/` are retained for organization; production photos are uploaded through `/admin`, not committed as seed images.

The `property-images` bucket is public-read and admin-write. The `chat-attachments` bucket is private and its storage policies limit access to conversation participants and admins.

## Numbered go-live checklist

1. **Supabase project:** create or select the production project. In **Project Settings → General**, copy the project reference for the CLI. In **Project Settings → API**, copy the project URL, publishable/anon key and service-role key into ignored `.env.local` and Vercel environment variables. The service-role key is server-only; keep the project ref, personal access token and database password out of Vercel.
2. **Supabase CLI:** install the CLI, run `supabase login`, then run `supabase link --project-ref hwoovxewidcpbbpgqmmw`, `supabase config push` and `supabase db push`. This applies the Vercel Auth URLs and Clerk development trust config, plus both migrations, including `btree_gist`, overlap protection, RLS, Realtime tables, storage policies and the one-minute `pg_cron` job. Run `npm run seed` once afterward. The seed does not upload photos or create guest data.
3. **Guest Auth:** set Supabase **Authentication → URL Configuration** Site URL to `https://ota-booking-platform-nine.vercel.app`. Allow `https://ota-booking-platform-nine.vercel.app/auth/callback`, `http://localhost:3000/auth/callback`, and the Vercel preview callback pattern. Email OTP/magic link is enabled. Google sign-in requires a Google OAuth client ID/secret; add the Supabase callback URL shown by the Google provider to that OAuth client before enabling Google.
4. **Clerk admin:** Vercel uses the Clerk development instance because Clerk production keys require a custom domain you control. The development domain is configured in `supabase/config.toml` and connected in Supabase Third-Party Auth. Set `ADMIN_EMAILS` to `pravomishri98@gmail.com`. In Clerk **Users → owner → Public metadata**, set `{"role":"admin"}`. Under **Sessions → Customize session token**, add `{"metadata":"{{user.public_metadata}}"}`. The database RLS helper reads `metadata.role`, while the Next.js host desk also enforces `ADMIN_EMAILS`.
5. **Storage and Realtime:** migration `002` creates/configures `property-images` and `chat-attachments`, removes legacy image metadata, and adds the publications for `bookings`, `conversations` and `messages`. Run the one-time Storage API cleanup in step 2 before uploading real photos. In Supabase verify both buckets and table publication membership after `db push`.
6. **Hold expiry:** deploy the existing endpoint with `supabase functions deploy expire-holds --no-verify-jwt`. Set a strong `CRON_SECRET` with `supabase secrets set CRON_SECRET=<random-secret>`. Migration `002` schedules `expire_stale_holds()` in Postgres every minute; the Edge Function uses the same database function for an authorized manual invocation. Verify the schedule in SQL Editor with `select jobname, schedule, command from cron.job;`.
7. **Razorpay test mode:** copy the test Key ID and Key Secret from **Razorpay Dashboard → Account & Settings → API Keys**. Set `NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_…` and `RAZORPAY_KEY_SECRET` in `.env.local` and Vercel. Add this webhook URL in **Razorpay → Webhooks**: `https://ota-booking-platform-nine.vercel.app/api/payments/webhook`. Subscribe to `payment.captured`, `payment.failed` and `refund.processed`; copy the webhook secret into `RAZORPAY_WEBHOOK_SECRET`.
8. **Email:** the Resend API key is present, but outgoing email stays disabled until you verify a sender domain and set `BOOKING_FROM_EMAIL` to an address on it. `BOOKING_REPLY_TO=retreatodisha@gmail.com` is already configured for replies; a reply-to address does not replace a verified sending domain.
9. **Vercel frontend:** the existing `parvooffice/OTA-BOOKING-PLATFORM` Vercel project is connected to the `main` branch. It uses `https://ota-booking-platform-nine.vercel.app` and has the site URL, Supabase URL/anon/service keys, Clerk development keys and `ADMIN_EMAILS` configured. Add Razorpay test keys before payment smoke tests. Set `CRON_SECRET` with Supabase Functions secrets, not Vercel. Supabase does not host the Next.js frontend.
10. **Site URL:** the existing Vercel domain `https://ota-booking-platform-nine.vercel.app` is attached and valid, so no DNS changes are needed. If you later buy a custom domain, attach it in Vercel and update `NEXT_PUBLIC_SITE_URL` plus Supabase Auth URLs.
11. **Live Razorpay:** after test-mode smoke checks pass, create/use Live API keys, change the public Key ID to `rzp_live_…`, replace `RAZORPAY_KEY_SECRET`, and set the webhook secret copied from the live webhook configuration. Keep the webhook URL and subscribed event names the same. Redeploy Vercel and make one low-value live payment before opening bookings widely.

Webhook URL to paste in Razorpay: `https://ota-booking-platform-nine.vercel.app/api/payments/webhook`.

## Smoke test

With Supabase configured, set a property's `max_guests` to at least 3, and configure Razorpay test keys. Verify: create a held booking; complete payment and confirm it through the signed webhook; attempt an overlapping booking and confirm it is rejected; send a guest-to-admin chat message; upload a PNG through `/admin`; and verify the third guest adds ₹500 per night by default (or one ₹500 fee per stay when that mode is selected). The owner can switch to live Razorpay keys only after these checks pass.

## Checks

```powershell
npm test
npm run typecheck
npm run build
```

The test suite covers booking date rules, payment signatures, INR conversion and extra-guest pricing.
