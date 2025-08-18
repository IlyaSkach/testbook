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

-- helper: latest request per user with username
create or replace function get_latest_requests_with_user()
returns table(
  id uuid,
  user_id bigint,
  status text,
  created_at timestamptz,
  username text
) language sql stable as $$
  select distinct on (pr.user_id)
    pr.id, pr.user_id, pr.status, pr.created_at, u.username
  from purchase_requests pr
  join users u on u.user_id = pr.user_id
  order by pr.user_id, pr.created_at desc;
$$;
