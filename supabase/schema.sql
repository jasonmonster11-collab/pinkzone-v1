-- Pink Zone Supabase database schema
-- Supabase SQL Editor에서 이 파일 내용을 그대로 실행하세요.

create extension if not exists pgcrypto;

create table if not exists public.sisters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  spec text not null,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sister_id uuid references public.sisters(id) on delete set null,
  sister_name text not null,
  review_date date not null default current_date,
  title text not null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.extra_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  prompt text not null,
  memo text,
  order_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sisters enable row level security;
alter table public.reviews enable row level security;
alter table public.extra_orders enable row level security;

drop policy if exists "sisters_select_own" on public.sisters;
drop policy if exists "sisters_insert_own" on public.sisters;
drop policy if exists "sisters_update_own" on public.sisters;
drop policy if exists "sisters_delete_own" on public.sisters;

create policy "sisters_select_own" on public.sisters
for select using (auth.uid() = user_id);

create policy "sisters_insert_own" on public.sisters
for insert with check (auth.uid() = user_id);

create policy "sisters_update_own" on public.sisters
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "sisters_delete_own" on public.sisters
for delete using (auth.uid() = user_id);

drop policy if exists "reviews_select_own" on public.reviews;
drop policy if exists "reviews_insert_own" on public.reviews;
drop policy if exists "reviews_update_own" on public.reviews;
drop policy if exists "reviews_delete_own" on public.reviews;

create policy "reviews_select_own" on public.reviews
for select using (auth.uid() = user_id);

create policy "reviews_insert_own" on public.reviews
for insert with check (auth.uid() = user_id);

create policy "reviews_update_own" on public.reviews
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "reviews_delete_own" on public.reviews
for delete using (auth.uid() = user_id);

drop policy if exists "extra_orders_select_own" on public.extra_orders;
drop policy if exists "extra_orders_insert_own" on public.extra_orders;
drop policy if exists "extra_orders_update_own" on public.extra_orders;
drop policy if exists "extra_orders_delete_own" on public.extra_orders;

create policy "extra_orders_select_own" on public.extra_orders
for select using (auth.uid() = user_id);

create policy "extra_orders_insert_own" on public.extra_orders
for insert with check (auth.uid() = user_id);

create policy "extra_orders_update_own" on public.extra_orders
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "extra_orders_delete_own" on public.extra_orders
for delete using (auth.uid() = user_id);

create index if not exists sisters_user_id_created_at_idx on public.sisters(user_id, created_at desc);
create index if not exists reviews_user_id_review_date_idx on public.reviews(user_id, review_date desc);
create index if not exists extra_orders_user_id_order_date_idx on public.extra_orders(user_id, order_date desc);
