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

## Add property photos

1. Sign in to `/admin`, open **Image manager**, and choose Puri or Village Retreat.
2. Upload PNG files only (up to 12 MiB each). The storage bucket keeps PNG originals and serves the cover, gallery and thumbnails from Supabase Storage.
3. Use the image manager to crop, reorder, set the cover image and edit alt text. The empty local folders `public/properties/<slug>/gallery/` and `public/properties/<slug>/thumbs/` are retained for organization; production photos are uploaded through `/admin`, not committed as seed images.

The `property-images` bucket is public-read and admin-write. The `chat-attachments` bucket is private and its storage policies limit access to conversation participants and admins.

## Numbered go-live checklist

1. **Supabase project:** create or select the production project. In **Project Settings → General**, copy the project reference for the CLI. In **Project Settings → API**, copy the project URL, publishable/anon key and service-role key into ignored `.env.local` and Vercel environment variables. The service-role key is server-only; keep the project ref, personal access token and database password out of Vercel.
2. **Supabase CLI:** install the CLI, run `supabase login`, then run `supabase link --project-ref <SUPABASE_PROJECT_REF>` and `supabase db push`. This applies both migrations, including `btree_gist`, overlap protection, RLS, Realtime tables, storage policies and the one-minute `pg_cron` job. Run `npm run seed` once afterward. The seed does not upload photos or create guest data.
3. **Guest Auth:** in **Authentication → URL Configuration**, set Site URL to `https://odisharetreat.com`. Add `https://odisharetreat.com/auth/callback`, `https://www.odisharetreat.com/auth/callback`, `http://localhost:3000/auth/callback`, and the Vercel preview callback pattern. Enable Email OTP/magic link. In **Authentication → Providers → Google**, enable Google and add the Supabase callback URL shown by that provider to the Google OAuth client.
4. **Clerk admin:** copy the Clerk publishable and secret keys into `.env.local` and Vercel. Set `ADMIN_EMAILS` to the exact Clerk owner email. In Clerk, enable its native Supabase integration; in Supabase **Authentication → Third-Party Auth**, add the Clerk domain shown in Clerk. In Clerk **Users → owner → Public metadata**, set `{"role":"admin"}`. Under **Sessions → Customize session token**, add `{"metadata":"{{user.public_metadata}}"}`. The database RLS helper reads `metadata.role`, while the Next.js host desk also enforces `ADMIN_EMAILS`. This uses the native third-party integration and does not need a legacy `supabase` JWT template.
5. **Storage and Realtime:** migration `002` creates/configures `property-images` and `chat-attachments`, removes legacy image metadata, and adds the publications for `bookings`, `conversations` and `messages`. Run the one-time Storage API cleanup in step 2 before uploading real photos. In Supabase verify both buckets and table publication membership after `db push`.
6. **Hold expiry:** deploy the existing endpoint with `supabase functions deploy expire-holds --no-verify-jwt`. Set a strong `CRON_SECRET` with `supabase secrets set CRON_SECRET=<random-secret>`. Migration `002` schedules `expire_stale_holds()` in Postgres every minute; the Edge Function uses the same database function for an authorized manual invocation. Verify the schedule in SQL Editor with `select jobname, schedule, command from cron.job;`.
7. **Razorpay test mode:** copy the test Key ID and Key Secret from **Razorpay Dashboard → Account & Settings → API Keys**. Set `NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_…` and `RAZORPAY_KEY_SECRET` in `.env.local` and Vercel Preview. Add this exact webhook URL in **Razorpay → Webhooks**: `https://odisharetreat.com/api/payments/webhook`. Subscribe to `payment.captured`, `payment.failed` and `refund.processed`; copy the webhook secret into `RAZORPAY_WEBHOOK_SECRET`.
8. **Email:** copy a Resend sending-only API key into `RESEND_API_KEY`, set `BOOKING_FROM_EMAIL` to an address on a verified Resend domain, and set `BOOKING_REPLY_TO` (for example `retreatodisha@gmail.com`) for guest replies. The reply-to address does not replace the verified sending domain.
9. **Vercel frontend:** import `parvooffice/OTA-BOOKING-PLATFORM` into Vercel, use the Next.js preset and deploy the `main` branch. Add the app runtime values from `.env.example` under **Project → Settings → Environment Variables** for Production: site URL, Supabase URL/anon key/service role key, Clerk keys, `ADMIN_EMAILS`, Razorpay keys, and optional Resend/WhatsApp settings. Set `CRON_SECRET` with Supabase Functions secrets, not Vercel. Redeploy after saving. Supabase does not host the Next.js frontend.
10. **Domain and DNS:** add `odisharetreat.com` and `www.odisharetreat.com` under **Vercel → Project → Settings → Domains**. Vercel will show the exact records for this project. The usual records are apex `A` host `@` → `76.76.21.21` and `CNAME` host `www` → `cname.vercel-dns-0.com`; use the values displayed in your Vercel dashboard if they differ. Choose one canonical hostname and redirect the other to it. Set `NEXT_PUBLIC_SITE_URL=https://odisharetreat.com` and redeploy.
11. **Live Razorpay:** after test-mode smoke checks pass, create/use Live API keys, change the public Key ID to `rzp_live_…`, replace `RAZORPAY_KEY_SECRET`, and set the webhook secret copied from the live webhook configuration. Keep the webhook URL and subscribed event names the same. Redeploy Vercel and make one low-value live payment before opening bookings widely.

Webhook URL to paste in Razorpay: `https://odisharetreat.com/api/payments/webhook`.

## Smoke test

With Supabase configured, set a property's `max_guests` to at least 3, and configure Razorpay test keys. Verify: create a held booking; complete payment and confirm it through the signed webhook; attempt an overlapping booking and confirm it is rejected; send a guest-to-admin chat message; upload a PNG through `/admin`; and verify the third guest adds ₹500 per night by default (or one ₹500 fee per stay when that mode is selected). The owner can switch to live Razorpay keys only after these checks pass.

## Checks

```powershell
npm test
npm run typecheck
npm run build
```

The test suite covers booking date rules, payment signatures, INR conversion and extra-guest pricing.
