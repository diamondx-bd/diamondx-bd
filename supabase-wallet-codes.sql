-- DiamondX-BD wallet, top-up approval, order refund and digital-code migration
-- Run this once in Supabase SQL Editor. It extends the existing products/orders/profiles tables.

alter table public.profiles
  add column if not exists wallet_balance numeric(12,2) not null default 0
  check (wallet_balance >= 0);

-- Expand product categories while preserving existing rows.
do $$
declare c record;
begin
  for c in select conname from pg_constraint
    where conrelid='public.products'::regclass and contype='c'
      and pg_get_constraintdef(oid) ilike '%category%'
  loop
    execute format('alter table public.products drop constraint %I',c.conname);
  end loop;
end $$;
alter table public.products add constraint products_category_allowed
  check (category in ('diamond','pubg','subscription','membership','pass','weekly','monthly','level_up'));

-- Add a completed state without disturbing existing order records.
do $$
declare c record;
begin
  for c in select conname from pg_constraint
    where conrelid='public.orders'::regclass and contype='c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.orders drop constraint %I',c.conname);
  end loop;
end $$;
alter table public.orders add constraint orders_status_allowed
  check (status in ('pending','approved','rejected','completed'));
-- Wallet is a valid order payment method; remove any old restrictive payment-method check.
do $
declare c record;
begin
  for c in select conname from pg_constraint
    where conrelid='public.orders'::regclass and contype='c'
      and pg_get_constraintdef(oid) ilike '%payment_method%'
  loop
    execute format('alter table public.orders drop constraint %I',c.conname);
  end loop;
end $;

create table if not exists public.wallet_topups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12,2) not null check (amount >= 50 and amount <= 50000),
  payment_method text not null check (payment_method in ('bKash','Nagad','Rocket')),
  transaction_id text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id)
);
create index if not exists wallet_topups_user_created_idx on public.wallet_topups(user_id,created_at desc);
create unique index if not exists wallet_topups_unique_transaction_idx
  on public.wallet_topups(payment_method,lower(trim(transaction_id)));

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topup_id uuid unique references public.wallet_topups(id),
  order_id uuid references public.orders(id),
  amount numeric(12,2) not null,
  kind text not null check (kind in ('topup','purchase','refund')),
  balance_after numeric(12,2) not null,
  created_at timestamptz not null default now()
);
create index if not exists wallet_transactions_user_created_idx on public.wallet_transactions(user_id,created_at desc);

create table if not exists public.digital_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  code_text text not null,
  created_at timestamptz not null default now()
);
create index if not exists digital_codes_user_created_idx on public.digital_codes(user_id,created_at desc);

alter table public.wallet_topups enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.digital_codes enable row level security;

drop policy if exists "User reads own topups" on public.wallet_topups;
create policy "User reads own topups" on public.wallet_topups for select to authenticated
  using (user_id=auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
drop policy if exists "User creates own pending topup" on public.wallet_topups;
create policy "User creates own pending topup" on public.wallet_topups for insert to authenticated
  with (user_id=auth.uid() and status='pending' and reviewed_at is null and reviewed_by is null);
drop policy if exists "Admin reads wallet ledger" on public.wallet_transactions;
create policy "User reads own wallet ledger" on public.wallet_transactions for select to authenticated
  using (user_id=auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
drop policy if exists "User reads own digital codes" on public.digital_codes;
create policy "User reads own digital codes" on public.digital_codes for select to authenticated
  using (user_id=auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));

-- Only an Admin can approve/reject a pending top-up; approval and balance credit are atomic.
create or replace function public.review_wallet_topup(p_topup_id uuid,p_status text)
returns void language plpgsql security definer set search_path=public,auth
as $$
declare t public.wallet_topups%rowtype; new_balance numeric(12,2);
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then
    raise exception 'Admin access required';
  end if;
  if p_status not in ('approved','rejected') then raise exception 'Invalid status'; end if;
  select * into t from public.wallet_topups where id=p_topup_id for update;
  if not found or t.status<>'pending' then raise exception 'Top-up is not pending'; end if;
  update public.wallet_topups set status=p_status,reviewed_at=now(),reviewed_by=auth.uid() where id=p_topup_id;
  if p_status='approved' then
    update public.profiles set wallet_balance=wallet_balance+t.amount where id=t.user_id
      returning wallet_balance into new_balance;
    if not found then raise exception 'User profile not found'; end if;
    insert into public.wallet_transactions(user_id,topup_id,amount,kind,balance_after)
      values(t.user_id,t.id,t.amount,'topup',new_balance);
  end if;
end $$;
revoke all on function public.review_wallet_topup(uuid,text) from public;
grant execute on function public.review_wallet_topup(uuid,text) to authenticated;

-- Wallet purchases debit immediately; rejected wallet orders are refunded by admin_update_order_status.
create or replace function public.create_wallet_order(p_product_id uuid,p_player_id text)
returns uuid language plpgsql security definer set search_path=public,auth
as $$
declare p public.products%rowtype; uid uuid; current_balance numeric(12,2); oid uuid; new_balance numeric(12,2);
begin
  uid:=auth.uid();
  if uid is null then raise exception 'Login required'; end if;
  if p_player_id !~ '^[0-9]{5,15}$' then raise exception 'Invalid Player ID'; end if;
  select * into p from public.products where id=p_product_id and is_active=true;
  if not found or p.price is null or p.price<=0 then raise exception 'Package unavailable or price not set'; end if;
  select wallet_balance into current_balance from public.profiles where id=uid for update;
  if current_balance is null then raise exception 'Profile not found'; end if;
  if current_balance<p.price then raise exception 'Insufficient wallet balance'; end if;
  insert into public.orders(user_id,product_id,product_name,player_id,payment_method,transaction_id,price,status)
    values(uid,p.id,p.name,p_player_id,'Wallet',null,p.price,'pending') returning id into oid;
  update public.profiles set wallet_balance=wallet_balance-p.price where id=uid returning wallet_balance into new_balance;
  insert into public.wallet_transactions(user_id,order_id,amount,kind,balance_after)
    values(uid,oid,-p.price,'purchase',new_balance);
  return oid;
end $$;
revoke all on function public.create_wallet_order(uuid,text) from public;
grant execute on function public.create_wallet_order(uuid,text) to authenticated;

create or replace function public.admin_update_order_status(p_order_id uuid,p_status text)
returns void language plpgsql security definer set search_path=public,auth
as $$
declare o public.orders%rowtype; new_balance numeric(12,2);
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then
    raise exception 'Admin access required';
  end if;
  if p_status not in ('approved','rejected','completed') then raise exception 'Invalid status'; end if;
  select * into o from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if o.status='pending' and p_status='completed' then raise exception 'Approve order before completing'; end if;
  if o.status='approved' and p_status<>'completed' then raise exception 'Approved order can only be marked completed'; end if;
  if o.status not in ('pending','approved') then raise exception 'Order cannot be changed from current status'; end if;
  if p_status='rejected' and o.payment_method='Wallet' and o.status='pending' then
    update public.profiles set wallet_balance=wallet_balance+o.price where id=o.user_id returning wallet_balance into new_balance;
    insert into public.wallet_transactions(user_id,order_id,amount,kind,balance_after)
      values(o.user_id,o.id,o.price,'refund',new_balance);
  end if;
  update public.orders set status=p_status where id=p_order_id;
end $$;
revoke all on function public.admin_update_order_status(uuid,text) from public;
grant execute on function public.admin_update_order_status(uuid,text) to authenticated;

-- Codes are assigned to a real order and can only be created by an Admin.
create or replace function public.admin_assign_code(p_order_id uuid,p_code_text text)
returns uuid language plpgsql security definer set search_path=public,auth
as $$
declare o public.orders%rowtype; cid uuid;
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then
    raise exception 'Admin access required';
  end if;
  if length(trim(p_code_text))<3 then raise exception 'Code is too short'; end if;
  select * into o from public.orders where id=p_order_id;
  if not found or o.status not in ('approved','completed') then raise exception 'Order must be approved before assigning a code'; end if;
  insert into public.digital_codes(user_id,order_id,code_text)
    values(o.user_id,o.id,trim(p_code_text)) returning id into cid;
  return cid;
end $$;
revoke all on function public.admin_assign_code(uuid,text) from public;
grant execute on function public.admin_assign_code(uuid,text) to authenticated;
