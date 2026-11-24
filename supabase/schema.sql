-- DiamondX BD: Supabase database setup
-- Run this in Supabase SQL Editor. Never put the service-role key in the website.

create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id text primary key,
  name text not null,
  category text not null check (category in ('diamond','membership','pass')),
  price_bdt integer check (price_bdt is null or price_bdt >= 0),
  active boolean not null default true,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  player_id text not null,
  product_id text not null references public.products(id),
  product_name text not null,
  price_bdt integer,
  customer_phone text not null,
  payment_method text not null check (payment_method in ('bKash','Nagad','Rocket')),
  transaction_id text,
  status text not null default 'pending' check (status in ('pending','paid','processing','completed','rejected')),
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;

create or replace function public.is_diamondx_admin()
returns boolean language sql stable security definer
set search_path = public
as $$
  select exists(select 1 from public.admin_users where user_id = auth.uid());
$$;

drop policy if exists "Anyone can view active products" on public.products;
create policy "Anyone can view active products" on public.products
for select using (active = true);

drop policy if exists "Admins manage products" on public.products;
create policy "Admins manage products" on public.products
for all to authenticated using (public.is_diamondx_admin())
with check (public.is_diamondx_admin());

drop policy if exists "Admins view orders" on public.orders;
create policy "Admins view orders" on public.orders
for select to authenticated using (public.is_diamondx_admin());

drop policy if exists "Admins update orders" on public.orders;
create policy "Admins update orders" on public.orders
for update to authenticated using (public.is_diamondx_admin())
with check (public.is_diamondx_admin());

drop policy if exists "Customers create orders" on public.orders;
create policy "Customers create orders" on public.orders
for insert to anon, authenticated
with check (
  char_length(player_id) between 5 and 15
  and player_id ~ '^[0-9]+$'
  and customer_phone ~ '^01[0-9]{9}$'
  and status = 'pending'
);

insert into public.products (id,name,category,price_bdt,sort_order) values
('25','25 Diamonds','diamond',null,1),
('50','50 Diamonds','diamond',null,2),
('115','115 Diamonds','diamond',null,3),
('240','240 Diamonds','diamond',null,4),
('355','355 Diamonds','diamond',null,5),
('480','480 Diamonds','diamond',null,6),
('610','610 Diamonds','diamond',null,7),
('1240','1240 Diamonds','diamond',null,8),
('weekly','Weekly Membership','membership',null,9),
('monthly','Monthly Membership','membership',null,10),
('levelup','Level Up Pass','pass',null,11)
on conflict (id) do update set name=excluded.name, category=excluded.category, sort_order=excluded.sort_order;

grant select on public.products to anon, authenticated;
grant insert on public.orders to anon, authenticated;
grant select, update on public.orders to authenticated;
grant select on public.admin_users to authenticated;
