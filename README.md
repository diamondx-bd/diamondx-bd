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

The app intentionally creates seeded packages with price 0 and disabled status; set a real price and activate each package in Admin before customers can order it.

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
