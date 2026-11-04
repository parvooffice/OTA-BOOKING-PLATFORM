# OTA-BOOKING-PLATFORM

Odisha Retreat is a small, owner-run booking site for four independently owned stays in Odisha.

The starter records are called **Property 1–4** and are set in Puri, Chilika, Gopalpur and Similipal. Replace their copy and the generated illustration PNGs with the owner's real details before launch.

## Staged project structure

```text
app/                         Next.js App Router pages and trusted API routes
  page.tsx                   Editorial home, story and Odisha map
  properties/[slug]/         Stay details, gallery, availability and booking panel
  booking/[id]/               Guest checkout and confirmed-booking details
  account/                    Supabase guest login, bookings and messages
  admin/                      Clerk-only owner dashboard
  api/                        Holds, payments, chat, images, invoices and calendar feeds
components/                  Responsive design and booking/admin UI
lib/                         Property data, Supabase, Clerk, pricing, invoice and payment helpers
public/brand/                 Konark mark, logo PNG and ikat border PNG
public/properties/{slug}/     hero.png, gallery/*.png and thumbs/*.png
scripts/                      Placeholder generator, MapLibre worker copy and four-stay seed
supabase/migrations/          Schema, exclusions, RLS, realtime and booking functions
supabase/functions/           Ten-minute hold expiry endpoint
tests/                        Booking-overlap and Razorpay signature tests
```

## Run the site

Use Node 20.9 or newer (Node 22 LTS is recommended).

```bash
npm install
Copy-Item .env.example .env.local
npm run dev
```

The public home and property pages render with the local placeholders before external services are configured. Booking, guest authentication, the host desk and online payments need the corresponding credentials in `.env.local`.

To open the dev site from another device on the same Wi-Fi, run `npm run dev -- --hostname 0.0.0.0`, then visit `http://<this-computer-LAN-IP>:3000` on that device. The Next.js dev config discovers this computer's active IPv4 addresses automatically.

## Supabase setup

1. Create a Supabase project. Enable Email OTP and configure Google under **Authentication → Providers** if you want Google sign-in.
2. Copy the project URL, anon key and service-role key into `.env.local`. Keep the service-role key server-only; never prefix it with `NEXT_PUBLIC_`.
3. Install the Supabase CLI, link the project, then apply the migration:

   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   supabase db push
   npm run seed
   ```

   `npm run seed` creates the four starter property records and uploads their PNG display files, thumbnails and untouched originals to the private `property-images` bucket. The migration creates the private chat-attachment bucket, RLS policies, public date-only availability view, realtime broadcasts, booking hold RPC and exclusion constraints.
4. Add the Supabase redirect URLs for `http://localhost:3000/auth/callback` and `https://odisharetreat.com/auth/callback`. Set the email template to deliver the one-time token used by the account page.
5. For local Supabase, start the CLI stack and run `supabase db reset` before seeding.

The database rejects overlapping held or confirmed stays with a `btree_gist` exclusion constraint. Booking holds expire after ten minutes. Deploy `supabase/functions/expire-holds` and invoke it every minute with `Authorization: Bearer $CRON_SECRET`; set the function's `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET` secrets. Supabase Cron with `pg_net` or a trusted external scheduler can invoke the function.

Availability subscribers receive a small broadcast containing only the property and affected dates. Guest names, messages and booking details never appear in the public availability view or its broadcast.

## Clerk admin setup

1. Create a Clerk application and add its publishable and secret keys to `.env.local`.
2. Set `ADMIN_EMAILS` to the one owner's Clerk email address. Server pages and every `/api/admin/*` route check the authenticated Clerk user's primary email; signed-in users outside this list receive a 404.
3. Add Clerk as a third-party JWT provider in the Supabase project's **Authentication → Third-Party Auth** settings.
4. In Clerk, create a JWT template named `supabase` with the Supabase project audience and `role: "authenticated"`. Include `app_metadata.role: "admin"` only for the owner account (for example, map a server-managed `user.public_metadata.supabase_role` value). The migration's RLS policies use that claim to grant admin access to Supabase Realtime. The application's email allowlist remains the server-side authorization check.

Guest sessions use Supabase Auth. Clerk protects the host desk only.

## Razorpay test mode

1. Add the Razorpay test key ID and secret to `.env.local`. The key ID is public and is used by Checkout; the secret stays server-side.
2. Configure a Razorpay webhook at `https://odisharetreat.com/api/payments/webhook` (use a tunnel URL for local development). Subscribe to `payment.captured`, `payment.failed` and `refund.processed`, then add the webhook secret to `RAZORPAY_WEBHOOK_SECRET`.
3. The server creates INR orders in paise. The browser callback's signature is checked, but a booking becomes confirmed only when the signed, idempotent webhook arrives. Late captured payments are refunded if their hold has already expired.
4. Deposit payments can be enabled in the owner dashboard. The admin's GST, cancellation, legal-name and GSTIN settings are used for new booking totals and PDF receipts.

## Email and WhatsApp

Add a Resend API key and a verified sender in `BOOKING_FROM_EMAIL`. The app emails booking confirmation and a GST-friendly PDF invoice, and sends owner/guest message notifications. Set `NEXT_PUBLIC_WHATSAPP_NUMBER` to show the host's WhatsApp link; the owner inbox can also open a guest's supplied phone number in WhatsApp.

## Images

The repository contains generated postcard illustrations, not photographs of actual properties. Replace them with licensed owner photography before launch. Put the images in the folder matching the stay slug (`puri`, `chilika`, `gopalpur` or `similipal`) and keep these names and folders:

```text
public/properties/{slug}/hero.png
public/properties/{slug}/gallery/01.png
public/properties/{slug}/gallery/02.png
public/properties/{slug}/thumbs/01.png
public/properties/{slug}/thumbs/02.png
```

For example, replace Chilika's cover at `public/properties/chilika/hero.png` and its gallery images under `public/properties/chilika/gallery/`. Keep the current files' dimensions/aspect ratios where possible. Regenerate the placeholder set with `npm run assets:placeholders` if needed. After replacing local files, commit and push them so Vercel receives the new images. The owner image manager is another option once Supabase is configured; it uploads originals and saves processed display images to the private `property-images` bucket.

The image manager accepts browser-supported JPEG, WebP, PNG and HEIC uploads. It preserves the uploaded original under `originals/` and writes display and thumbnail PNGs. Crop, rotate, flip, brightness, contrast, saturation, sort order, cover choice and alt text are saved through the owner-only API.

## Tests and checks

```bash
npm test
npm run typecheck
npm run build
```

The tests cover half-open booking overlap semantics, ISO date validation, Razorpay checkout and webhook signatures, and INR-to-paise conversion.

## Vercel deployment

Import `parvooffice/OTA-BOOKING-PLATFORM` into Vercel and keep the Next.js framework preset and default `npm run build` command. No `vercel.json` is needed. Add the required values from `.env.example` under **Project → Settings → Environment Variables**, choosing Preview and/or Production as appropriate. Set `NEXT_PUBLIC_SITE_URL` to the deployment's public URL. Configure Supabase, Clerk, Razorpay and email credentials before enabling those features; then redeploy so the build and functions receive the values.

For the production domain, add `odisharetreat.com` and `www.odisharetreat.com` under **Project → Settings → Domains**. Apply the DNS records Vercel shows at the domain registrar, choose the canonical domain and redirect the other host to it, then set `NEXT_PUBLIC_SITE_URL=https://odisharetreat.com`. Add the production auth callback and Razorpay webhook URLs before taking live payments.

Do not commit `.env.local`, service-role keys, Clerk secrets or Razorpay secrets.
