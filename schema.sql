-- Enable uuid generator if needed
create extension if not exists pgcrypto;

create table if not exists users (
  user_id bigint primary key,
  username text,
  first_name text,
  last_name text,
  created_at timestamptz default now()
);

create table if not exists purchase_requests (
  id uuid primary key default gen_random_uuid(),
  user_id bigint not null references users(user_id) on delete cascade,
  status text not null default 'pending', -- pending | approved | rejected
  created_at timestamptz default now(),
  approved_at timestamptz
);

create table if not exists user_access (
  user_id bigint primary key references users(user_id) on delete cascade,
  has_full_access boolean not null default false,
  updated_at timestamptz default now()
);
