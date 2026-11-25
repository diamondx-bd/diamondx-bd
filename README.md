# DiamondX BD

Free Fire diamond top-up storefront — Bengali, mobile-friendly, Black & Gold design.

## Current implementation
- Responsive storefront and package cards
- Supabase product loading from `public.products`
- Email/password sign-in and sign-up via Supabase Auth
- Authenticated order requests written to `public.orders`
- Admin role detection from `public.profiles.role = 'admin'`
- Admin product add/update/activate controls
- Admin recent-order list and status updates

## Supabase setup
1. Open `config.js`.
2. Replace `PASTE_SUPABASE_PUBLISHABLE_OR_ANON_KEY_HERE` with the project's **Publishable key** (or legacy **anon** key).
3. Never put a `service_role` or secret key in browser code.
4. Confirm Row Level Security policies allow public read of active products, authenticated users to create only their own pending orders, and Admins to manage products and orders.

The frontend expects these columns:
- `products`: `id` (UUID default), `name`, `category`, `diamonds`, `price`, `is_active`, `sort_order`
- `profiles`: `id`, `role` (Admin role value: `admin`)
- `orders`: `id`, `user_id`, `product_id`, `product_name`, `player_id`, `payment_method`, `transaction_id`, `price`, `status`, `created_at`

The seed includes draft Free Fire prices (25/40/85/160/240/320/400/800 BDT for 25/50/115/240/355/480/610/1240 diamonds) and keeps every seeded package disabled. These are suggested starting prices, not verified supplier rates. Review/change them in Admin before activation; set PUBG UC and Subscription prices there as well.

## Safety before launch
- Verify RLS policies in Supabase before accepting real orders.
- Add verified payment instructions and support contact.
- Test signup/login, product updates, order submission, and order status changes.
- Do not accept or publish payment details until verified.

## Deploy with GitHub Pages
1. Open repository **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Select branch **main** and folder **/(root)**, then Save.
4. Wait for GitHub Pages to publish the site.

## Wallet, payment approval and digital codes (new)
1. **Already applied to the connected DiamondX-BD Supabase project** as migration `diamondx_wallet_codes_secure`. For a fresh project only, run `supabase-wallet-codes.sql` once in Supabase SQL Editor.
2. The connected project currently has one Admin profile. For a fresh project, sign up on the website with the email you want to use for Admin.
3. In Supabase SQL Editor, promote that account (replace the email):
   ```sql
   update public.profiles
   set role='admin'
   where id=(select id from auth.users where email='YOUR_ADMIN_EMAIL');
   ```
4. Admin can set package prices and activate packages, approve/reject top-up requests, approve/reject orders, mark approved orders completed, and assign a digital code using the Order ID.
5. Fourteen starter packages (8 Free Fire, 3 PUBG UC, 2 memberships, 1 Level Up Pass) have been inserted into the connected database; all are disabled until Admin reviews and activates them. A top-up is credited only by the Admin approval RPC. Wallet orders are debited server-side and refunded if Admin rejects the pending order. Codes are visible only to the assigned customer and Admin.

**Important:** No payment recipient/account number is configured in this repository. Do not send money until you add and verify your official payment instructions. Keep the Supabase service-role/secret key out of `config.js`; only the browser publishable/anon key belongs there.
